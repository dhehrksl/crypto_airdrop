const jwt = require('jsonwebtoken');

// fallback 약한 시크릿은 토큰 위조 위험. 부팅 시 자가 진단(server.js)이 production을
// fatal 처리하지만, dev에서도 명시적 설정을 강제해 실수로 약한 키가 운영에 흘러드는 것을 차단.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required (see docs/security.md)');
}

module.exports = function (req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');

  // Check if not token
  if (!authHeader) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Check if token is in the correct format 'Bearer <token>'
  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    return res.status(401).json({ msg: 'Token is not valid' });
  }

  const token = tokenParts[1];

  // Verify token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
