const User = require('../models/User');

// authMiddleware 이후에 연결. req.user.id에서 사용자 조회 후 isAdmin 검증.
module.exports = async function (req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    const user = await User.findById(req.user.id).select('isAdmin');
    if (!user || !user.isAdmin) {
      return res.status(403).json({ msg: 'Admin only' });
    }
    next();
  } catch (err) {
    console.error('adminMiddleware error:', err.message);
    res.status(500).send('Server Error');
  }
};
