const { User } = require('../models');

const ownerOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('accountType');
    if (!user || user.accountType !== 'owner') {
      return res.status(403).json({ success: false, error: 'This feature is available to owner accounts only' });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to verify owner account' });
  }
};

module.exports = { ownerOnly };
