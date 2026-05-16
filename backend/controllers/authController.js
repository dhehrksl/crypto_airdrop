const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-is-long';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ msg: 'Please enter all fields' });
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User with this email already exists' });
    user = await User.findOne({ username });
    if (user) return res.status(400).json({ msg: 'Username is already taken' });
    user = new User({ username, email, password });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    const payload = { user: { id: user.id } };
    jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, isAdmin: !!user.isAdmin } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ msg: 'Please enter all fields' });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });
    const payload = { user: { id: user.id } };
    jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, isAdmin: !!user.isAdmin } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
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
      { expiresIn: '7d' },
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
