const express = require('express');
const { query, validationResult } = require('express-validator');
const { Property } = require('../models');

const router = express.Router();

const publicFields = 'title description location price propertyType features area amenities images status listingType createdAt organizationId';

router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('propertyType').optional(),
  query('listingType').optional().isIn(['sale', 'rent', 'lease']),
  query('city').optional().trim(),
  query('minPrice').optional().isInt({ min: 0 }).toInt(),
  query('maxPrice').optional().isInt({ min: 0 }).toInt(),
  query('q').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const filter = { status: 'available' };
    if (req.query.propertyType) filter.propertyType = req.query.propertyType;
    if (req.query.listingType) filter.listingType = req.query.listingType;
    if (req.query.city) filter['location.city'] = { $regex: req.query.city, $options: 'i' };
    if (req.query.q) filter.$text = { $search: req.query.q };
    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = req.query.minPrice;
      if (req.query.maxPrice) filter.price.$lte = req.query.maxPrice;
    }

    const [total, properties] = await Promise.all([
      Property.countDocuments(filter),
      Property.find(filter)
        .select(publicFields)
        .populate('organizationId', 'name slug')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({ success: true, count: properties.length, pagination: { total, page, limit, pages: Math.ceil(total / limit) }, properties });
  } catch (error) {
    console.error('Public property listing error:', error);
    res.status(500).json({ success: false, error: 'Server error loading public properties' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findOneAndUpdate(
      { _id: req.params.id, status: 'available' },
      { $inc: { views: 1 } },
      { new: true },
    ).select(publicFields).populate('organizationId', 'name slug');

    if (!property) return res.status(404).json({ success: false, error: 'Public property not found' });
    res.json({ success: true, property });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Public property not found' });
  }
});

module.exports = router;
