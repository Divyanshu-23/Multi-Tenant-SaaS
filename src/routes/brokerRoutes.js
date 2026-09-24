const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { brokerOnly } = require('../middleware/broker');
const { User, Property, Enquiry } = require('../models');

const router = express.Router();
const propertySelect = 'title description location price propertyType images status listingType createdBy brokerIds';
router.use(auth, brokerOnly);

const assignedProperties = (userId) => ({ $or: [{ brokerIds: userId }, { createdBy: userId }] });

router.get('/dashboard', async (req, res) => {
  try {
    const properties = await Property.find(assignedProperties(req.user.id)).select('_id title location price status views createdAt').sort({ createdAt: -1 });
    const propertyIds = properties.map((property) => property._id);
    const [newLeadCount, openLeadCount, recentEnquiries] = await Promise.all([
      Enquiry.countDocuments({ propertyId: { $in: propertyIds }, status: 'new' }),
      Enquiry.countDocuments({ propertyId: { $in: propertyIds }, status: { $ne: 'closed' } }),
      Enquiry.find({ propertyId: { $in: propertyIds } }).sort({ createdAt: -1 }).limit(5)
        .populate({ path: 'propertyId', select: propertySelect })
        .populate({ path: 'userId', select: 'firstName lastName email phone' }),
    ]);
    res.json({
      success: true,
      stats: {
        listingCount: properties.length,
        activeListingCount: properties.filter((property) => ['available', 'under_negotiation'].includes(property.status)).length,
        newLeadCount,
        openLeadCount,
        totalViews: properties.reduce((total, property) => total + (property.views || 0), 0),
      },
      recentProperties: properties.slice(0, 5),
      recentEnquiries,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error loading broker dashboard' });
  }
});

router.get('/enquiries', async (req, res) => {
  const properties = await Property.find(assignedProperties(req.user.id)).select('_id');
  const enquiries = await Enquiry.find({ propertyId: { $in: properties.map((property) => property._id) } })
    .sort({ createdAt: -1 }).populate({ path: 'propertyId', select: propertySelect })
    .populate({ path: 'userId', select: 'firstName lastName email phone' });
  res.json({ success: true, count: enquiries.length, enquiries });
});

router.put('/enquiries/:id', [body('status').isIn(['new', 'contacted', 'visit_scheduled', 'closed'])], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const properties = await Property.find(assignedProperties(req.user.id)).select('_id');
  const enquiry = await Enquiry.findOneAndUpdate(
    { _id: req.params.id, propertyId: { $in: properties.map((property) => property._id) } },
    { status: req.body.status }, { new: true, runValidators: true },
  ).populate({ path: 'propertyId', select: propertySelect }).populate({ path: 'userId', select: 'firstName lastName email phone' });
  if (!enquiry) return res.status(404).json({ success: false, error: 'Enquiry not found' });
  res.json({ success: true, enquiry });
});

router.get('/profile', async (req, res) => {
  const user = await User.findById(req.user.id).select('-password -verificationToken -resetToken -resetTokenExpiry');
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
