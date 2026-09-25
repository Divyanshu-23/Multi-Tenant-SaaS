const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { customerOnly } = require('../middleware/customer');
const { User, Property, Favorite, Enquiry, SupportTicket } = require('../models');

const router = express.Router();
const propertySelect = 'title description location price propertyType images status listingType organizationId';

router.use(auth, customerOnly);

router.get('/dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('customerType customerPreferences');
    const listingType = user.customerType === 'renter' ? 'rent' : 'sale';
    const [favoriteCount, enquiryCount, openTicketCount, recentFavorites, recentEnquiries, recommendations] = await Promise.all([
      Favorite.countDocuments({ userId: req.user.id }),
      Enquiry.countDocuments({ userId: req.user.id }),
      SupportTicket.countDocuments({ userId: req.user.id, status: { $ne: 'resolved' } }),
      Favorite.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(4).populate({ path: 'propertyId', select: propertySelect }),
      Enquiry.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(4).populate({ path: 'propertyId', select: propertySelect }),
      Property.find({ listingType, status: 'available' }).sort({ createdAt: -1 }).limit(4).select(propertySelect),
    ]);

    res.json({
      success: true,
      customerType: user.customerType,
      preferences: user.customerPreferences || {},
      stats: { favoriteCount, enquiryCount, openTicketCount },
      recentFavorites,
      recentEnquiries,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error loading customer dashboard' });
  }
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
  body('customerPreferences.budgetMin').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('customerPreferences.budgetMax').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('customerPreferences.monthlyRent').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('customerPreferences.leaseDuration').optional().isIn(['6_months', '11_months', '12_months', '24_months']),
  body('customerPreferences.furnishing').optional().isIn(['unfurnished', 'semi-furnished', 'fully-furnished']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const updates = {};
  ['firstName', 'lastName', 'phone'].forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  if (req.body.customerPreferences) updates.customerPreferences = req.body.customerPreferences;
  const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true })
    .select('-password -verificationToken -resetToken -resetTokenExpiry');
  res.json({ success: true, message: 'Profile updated successfully', user });
});

router.get('/favorites', async (req, res) => {
  const favorites = await Favorite.find({ userId: req.user.id }).sort({ createdAt: -1 }).populate({ path: 'propertyId', select: propertySelect });
  res.json({ success: true, count: favorites.length, favorites });
});

router.post('/favorites', [body('propertyId').isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const property = await Property.findOne({ _id: req.body.propertyId, status: 'available' });
  if (!property) return res.status(404).json({ success: false, error: 'Available property not found' });
  try {
    const favorite = await Favorite.create({ userId: req.user.id, propertyId: property._id });
    res.status(201).json({ success: true, favorite });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, error: 'Property is already saved' });
    res.status(500).json({ success: false, error: 'Unable to save property' });
  }
});

router.delete('/favorites/:propertyId', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.propertyId)) return res.status(404).json({ success: false, error: 'Favorite not found' });
  const favorite = await Favorite.findOneAndDelete({ userId: req.user.id, propertyId: req.params.propertyId });
  if (!favorite) return res.status(404).json({ success: false, error: 'Favorite not found' });
  res.json({ success: true, message: 'Property removed from favorites' });
});

router.get('/enquiries', async (req, res) => {
  const enquiries = await Enquiry.find({ userId: req.user.id }).sort({ createdAt: -1 }).populate({ path: 'propertyId', select: propertySelect });
  res.json({ success: true, count: enquiries.length, enquiries });
});

router.post('/enquiries', [
  body('propertyId').isMongoId(),
  body('message').trim().notEmpty().isLength({ max: 2000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const property = await Property.findOne({ _id: req.body.propertyId, status: 'available' });
  if (!property) return res.status(404).json({ success: false, error: 'Available property not found' });
  const enquiryData = { userId: req.user.id, propertyId: property._id, message: req.body.message };
  if (property.organizationId) enquiryData.organizationId = property.organizationId;
  const enquiry = await Enquiry.create(enquiryData);
  res.status(201).json({ success: true, message: 'Enquiry submitted successfully', enquiry });
});

router.get('/support', async (req, res) => {
  const tickets = await SupportTicket.find({ userId: req.user.id }).sort({ createdAt: -1 });
  res.json({ success: true, count: tickets.length, tickets });
});

router.post('/support', [
  body('subject').trim().notEmpty().isLength({ max: 160 }),
  body('message').trim().notEmpty().isLength({ max: 3000 }),
  body('category').optional().isIn(['account', 'property', 'enquiry', 'technical', 'other']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const ticket = await SupportTicket.create({ userId: req.user.id, subject: req.body.subject, message: req.body.message, category: req.body.category });
  res.status(201).json({ success: true, message: 'Support request submitted successfully', ticket });
});

module.exports = router;
