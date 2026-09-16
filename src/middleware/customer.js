const { User } = require('../models');

const customerTypes = new Set(['customer', 'buyer', 'renter']);

const customerOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('accountType');
    if (!user || !customerTypes.has(user.accountType)) {
      return res.status(403).json({ success: false, error: 'This feature is available to customer accounts only' });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Unable to verify customer account' });
  }
};

module.exports = { customerOnly };
