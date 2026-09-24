const { User } = require('../models');

const brokerOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('accountType');
    if (!user || user.accountType !== 'broker') {
      return res.status(403).json({ success: false, error: 'This feature is available to broker accounts only' });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to verify broker account' });
  }
};

module.exports = { brokerOnly };
