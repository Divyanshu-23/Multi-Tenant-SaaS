const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { builderOnly } = require('../middleware/builder');
const { User } = require('../models');

const router = express.Router();
router.use(auth, builderOnly);

router.get('/profile', async (req, res) => {
  const user = await User.findById(req.user.id).select('-password -verificationToken -resetToken -resetTokenExpiry');
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true, user });
});

router.put('/profile', [
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('phone').optional({ checkFalsy: true }).matches(/^\d{10}$/),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const updates = {};
  ['firstName', 'lastName', 'phone'].forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
  const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true })
    .select('-password -verificationToken -resetToken -resetTokenExpiry');
  res.json({ success: true, user });
});

module.exports = router;
