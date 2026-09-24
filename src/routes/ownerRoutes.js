const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { ownerOnly } = require('../middleware/owner');
const { User, Property, Enquiry } = require('../models');

const router = express.Router();
const propertySelect = 'title description location price propertyType images status listingType createdBy';

router.use(auth, ownerOnly);

router.get('/dashboard', async (req, res) => {
  try {
    const properties = await Property.find({ createdBy: req.user.id }).select('_id title location price status views createdAt').sort({ createdAt: -1 });
    const propertyIds = properties.map((property) => property._id);
    const [enquiryCount, recentEnquiries] = await Promise.all([
      Enquiry.countDocuments({ propertyId: { $in: propertyIds } }),
      Enquiry.find({ propertyId: { $in: propertyIds } })
        .sort({ createdAt: -1 }).limit(5)
        .populate({ path: 'propertyId', select: propertySelect })
        .populate({ path: 'userId', select: 'firstName lastName email phone' }),
    ]);

    res.json({
      success: true,
      stats: {
        propertyCount: properties.length,
        activeListingCount: properties.filter((property) => ['available', 'under_negotiation'].includes(property.status)).length,
        totalViews: properties.reduce((total, property) => total + (property.views || 0), 0),
        enquiryCount,
      },
      recentProperties: properties.slice(0, 5),
      recentEnquiries,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error loading owner dashboard' });
  }
});

router.get('/enquiries', async (req, res) => {
  try {
    const properties = await Property.find({ createdBy: req.user.id }).select('_id');
    const enquiries = await Enquiry.find({ propertyId: { $in: properties.map((property) => property._id) } })
      .sort({ createdAt: -1 })
      .populate({ path: 'propertyId', select: propertySelect })
      .populate({ path: 'userId', select: 'firstName lastName email phone' });
    res.json({ success: true, count: enquiries.length, enquiries });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error loading owner enquiries' });
  }
});

router.get('/brokers', async (req, res) => {
  const properties = await Property.find({ createdBy: req.user.id }).select('brokerIds').populate('brokerIds', 'firstName lastName email phone');
  const brokers = [...new Map(properties.flatMap((property) => property.brokerIds).map((broker) => [String(broker._id), broker])).values()];
  res.json({ success: true, brokers });
});

router.put('/properties/:id/brokers', [
  param('id').isMongoId(),
  body('brokerEmail').isEmail().normalizeEmail(),
  body('action').isIn(['assign', 'revoke']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const property = await Property.findOne({ _id: req.params.id, createdBy: req.user.id });
  if (!property) return res.status(404).json({ success: false, error: 'Owned property not found' });
  const broker = await User.findOne({ email: req.body.brokerEmail, accountType: 'broker', isActive: true }).select('firstName lastName email phone');
  if (!broker) return res.status(404).json({ success: false, error: 'Active broker account not found' });
  const brokerId = String(broker._id);
  const assigned = property.brokerIds.some((id) => String(id) === brokerId);
  if (req.body.action === 'assign' && !assigned) property.brokerIds.push(broker._id);
  if (req.body.action === 'revoke') property.brokerIds = property.brokerIds.filter((id) => String(id) !== brokerId);
  await property.save();
  res.json({ success: true, message: req.body.action === 'assign' ? 'Broker assigned to property' : 'Broker removed from property', broker, property });
});

router.put('/enquiries/:id', [
  body('status').isIn(['new', 'contacted', 'visit_scheduled', 'closed']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const properties = await Property.find({ createdBy: req.user.id }).select('_id');
  const enquiry = await Enquiry.findOneAndUpdate(
    { _id: req.params.id, propertyId: { $in: properties.map((property) => property._id) } },
    { status: req.body.status },
    { new: true, runValidators: true },
  ).populate({ path: 'propertyId', select: propertySelect }).populate({ path: 'userId', select: 'firstName lastName email phone' });
  if (!enquiry) return res.status(404).json({ success: false, error: 'Enquiry not found' });
  res.json({ success: true, enquiry });
});

router.get('/profile', async (req, res) => {
  const user = await User.findById(req.user.id).select('-password -verificationToken -resetToken -resetTokenExpiry');
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true, user });
});

router.put('/profile', [
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('phone').optional({ checkFalsy: true }).matches(/^\d{10}$/).withMessage('Phone number must contain exactly 10 digits'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const updates = {};
  ['firstName', 'lastName', 'phone'].forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true })
    .select('-password -verificationToken -resetToken -resetTokenExpiry');
  res.json({ success: true, message: 'Profile updated successfully', user });
});

module.exports = router;
