const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { isValidEmail, validatePassword, validateUsername } = require('./_validators');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-is-long';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const registerUser = async (req, res, next) => {
  try {
    let { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'missing_fields', msg: '사용자명, 이메일, 비밀번호를 모두 입력해주세요.' });
    }

    // 정규화 — 중복 비교/저장 모두에 같은 키 적용 (대소문자/공백 차이로 중복 우회 방지)
    email = String(email).trim().toLowerCase();
    username = String(username).trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email', msg: '이메일 형식이 올바르지 않습니다.' });
    }
    const un = validateUsername(username);
    if (!un.ok) {
      return res.status(400).json({
        error: 'invalid_username',
        reason: un.error,
        msg: '사용자명은 3-20자, 영숫자/언더스코어/하이픈만 사용 가능합니다.',
      });
    }
    const pw = validatePassword(password);
    if (!pw.ok) {
      return res.status(400).json({
        error: 'weak_password',
        reason: pw.error,
        msg: '비밀번호는 최소 8자, 영문/숫자를 각 1자 이상 포함해야 합니다.',
      });
    }

    // 중복 사전 체크 (사용자 친화적 메시지). race 통과 시 unique index가 최종 방어.
    if (await User.findOne({ email })) {
      return res.status(400).json({ error: 'email_taken', msg: '이미 사용 중인 이메일입니다.' });
    }
    if (await User.findOne({ username })) {
      return res.status(400).json({ error: 'username_taken', msg: '이미 사용 중인 사용자명입니다.' });
    }

    const newUser = new User({ username, email, password });
    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(password, salt);

    try {
      await newUser.save();
    } catch (err) {
      // race condition: 두 요청이 동시에 통과해 unique index가 한쪽을 거절
      if (err && err.code === 11000) {
        const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
        return res.status(400).json({ error: 'duplicate', field, msg: `이미 사용 중인 ${field}입니다.` });
      }
      throw err;
    }

    const payload = { user: { id: newUser.id } };
    jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }, (err, token) => {
      if (err) return next(err);
      res.json({
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          isAdmin: !!newUser.isAdmin,
        },
      });
    });
  } catch (err) {
    next(err); // 글로벌 errorHandler로 위임 — 응답 형식/스택 처리 일관성
  }
};

const loginUser = async (req, res, next) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'missing_fields', msg: '이메일과 비밀번호를 모두 입력해주세요.' });
    }
    // 가입 시 lowercase로 저장되므로 검색도 동일하게 정규화
    email = String(email).trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(400).json({ error: 'invalid_credentials', msg: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'invalid_credentials', msg: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const payload = { user: { id: user.id } };
    jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }, (err, token) => {
      if (err) return next(err);
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, isAdmin: !!user.isAdmin } });
    });
  } catch (err) {
    next(err);
  }
};

const googleSignIn = async (req, res) => {
  const { idToken } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture: avatarUrl } = payload;

    let user = await User.findOne({ googleId });

    if (!user) {
      // If user doesn't exist, check if an account with this email already exists
      if (email) {
          const existingUser = await User.findOne({ email });
          if (existingUser) {
              // Link Google ID to existing email account
              existingUser.googleId = googleId;
              existingUser.avatarUrl = existingUser.avatarUrl || avatarUrl;
              user = await existingUser.save();
          }
      }

      // If still no user, create a new one
      if (!user) {
        user = await new User({
            googleId,
            email,
            username: name,
            avatarUrl,
        }).save();
      }
    }

    // Create JWT payload
    const jwtPayload = {
      user: {
        id: user.id,
      },
    };

    // Sign token
    jwt.sign(
      jwtPayload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
            isAdmin: !!user.isAdmin,
          },
        });
      }
    );
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    res.status(401).json({ msg: 'Google Sign-In failed. Invalid token.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  googleSignIn,
};
