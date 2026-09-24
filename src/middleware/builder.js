const { User } = require('../models');

const builderOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('accountType');
    if (!user || user.accountType !== 'builder') {
      return res.status(403).json({ success: false, error: 'This feature is available to builder accounts only' });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to verify builder account' });
  }
};

module.exports = { builderOnly };
