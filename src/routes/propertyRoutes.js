// src/routes/propertyRoutes.js - Property management endpoints
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Property } = require('../models');
const { auth, orgContext } = require('../middleware/auth');
const { writeRateLimiter, readRateLimiter } = require('../middleware/rateLimiting');
const { cachePropertiesMiddleware, cachePropertyMiddleware, invalidateOnMutation } = require('../middleware/cacheMiddleware');
const { cacheProperties, cacheProperty, invalidateProperties } = require('../utils/cache');

const router = express.Router();

// Apply auth and org context to all routes
router.use(auth, orgContext);

// Organization records remain tenant-scoped; new account records are creator-scoped.
const propertyScope = (req) => req.organizationId
  ? { organizationId: req.organizationId }
  : { $or: [{ createdBy: req.user.id }, { brokerIds: req.user.id }] };

// @route   POST /api/properties - Create property
// @desc    Create a new property listing
// @access  Private (organization members)
router.post('/', writeRateLimiter, [
  body('title').notEmpty().trim().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
  body('description').notEmpty().isLength({ min: 10, max: 5000 }).withMessage('Description must be 10-5000 characters'),
  body('propertyType').isIn(['apartment', 'house', 'villa', 'plot', 'commercial', 'office', 'shop', 'warehouse', 'other']),
  body('listingType').isIn(['sale', 'rent', 'lease']),
  body('price').isInt({ min: 0 }).withMessage('Price must be a positive number'),
  body('location.address').notEmpty(),
  body('location.city').notEmpty(),
  body('location.state').notEmpty(),
  body('features.superArea').isInt({ min: 1 }).withMessage('Area must be positive'),
  body('owner.name').notEmpty(),
  body('owner.phone').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { organizationId, user } = req;
    const propertyData = {
      ...req.body,
      createdBy: user.id,
    };
    if (organizationId) propertyData.organizationId = organizationId;

    const property = await Property.create(propertyData);

    // Invalidate properties cache for this organization
    if (req.organizationId) {
      await cacheProperties.invalidate(req.organizationId);
    }

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      property: {
        id: property._id,
        title: property.title,
        price: property.price,
        location: property.location,
        propertyType: property.propertyType,
        status: property.status,
        createdAt: property.createdAt,
      },
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ success: false, error: 'Server error creating property' });
  }
});

// @route   GET /api/properties - List properties with filtering
// @desc    Get properties with advanced filtering, pagination, sorting
// @access  Private (organization members)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sortBy').optional().isIn(['price', 'createdAt', 'views', '-price', '-createdAt', '-views']),
  query('propertyType').optional(),
  query('listingType').optional().isIn(['sale', 'rent', 'lease']),
  query('status').optional().isIn(['available', 'sold', 'rented', 'under_negotiation', 'off_market']),
  query('minPrice').optional().isInt({ min: 0 }).toInt(),
  query('maxPrice').optional().isInt({ min: 0 }).toInt(),
  query('city').optional(),
  query('search').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { organizationId } = req;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { ...propertyScope(req), status: { $ne: 'off_market' } };

    if (req.query.propertyType) filter.propertyType = req.query.propertyType;
    if (req.query.listingType) filter.listingType = req.query.listingType;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.city) filter['location.city'] = { $regex: req.query.city, $options: 'i' };

    // Price range filter
    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = req.query.minPrice;
      if (req.query.maxPrice) filter.price.$lte = req.query.maxPrice;
    }

    // Full-text search
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    // Build sort
    let sortOption = { createdAt: -1 };
    if (req.query.sortBy) {
      if (req.query.sortBy.startsWith('-')) {
        sortOption = { [req.query.sortBy.slice(1)]: -1 };
      } else {
        sortOption = { [req.query.sortBy]: 1 };
      }
    }

    // Execute query
    const total = await Property.countDocuments(filter);
    const properties = await Property.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .select('title price location propertyType features status listingType views images createdAt brokerIds');

    res.json({
      success: true,
      count: properties.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      properties,
    });
  } catch (error) {
    console.error('List properties error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching properties' });
  }
});

// @route   GET /api/properties/search/query - Search properties
// @desc    Full-text search on properties
// @access  Private (organization members)
router.get('/search/query', [
  query('q').notEmpty().trim().withMessage('Search query is required'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { q } = req.query;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;
    const { organizationId } = req;

    const results = await Property.find(
      { ...propertyScope(req), $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit);

    const total = await Property.countDocuments({ ...propertyScope(req), $text: { $search: q } });

    res.json({
      success: true,
      query: q,
      count: results.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      results,
    });
  } catch (error) {
    console.error('Search properties error:', error);
    res.status(500).json({ success: false, error: 'Server error searching properties' });
  }
});

// @route   GET /api/properties/stats/overview - Property statistics
// @desc    Get property statistics for organization
// @access  Private (organization members)
router.get('/stats/overview', async (req, res) => {
  try {
    const { organizationId } = req;
    const userScope = new (require('mongoose').Types.ObjectId)(req.user.id);

    const stats = await Property.aggregate([
      { $match: organizationId
        ? { organizationId: new (require('mongoose').Types.ObjectId)(organizationId) }
        : { $or: [{ createdBy: userScope }, { brokerIds: userScope }] } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          byStatus: { $push: '$status' },
          byType: { $push: '$propertyType' },
          totalViews: { $sum: '$views' },
          totalLeads: { $sum: '$leads' },
        },
      },
    ]);

    const result = stats[0] || {
      total: 0,
      avgPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      byStatus: { available: 0, sold: 0, rented: 0, under_negotiation: 0, off_market: 0, draft: 0 },
      byType: {},
      totalViews: 0,
      totalLeads: 0,
    };

    if (Array.isArray(result.byStatus)) {
      const statusCounts = {};
      result.byStatus.forEach((status) => {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      result.byStatus = statusCounts;
    }
    if (Array.isArray(result.byType)) {
      const typeCounts = {};
      result.byType.forEach((type) => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      result.byType = typeCounts;
    }

    res.json({ success: true, stats: result });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching statistics' });
  }
});

// @route   GET /api/properties/:id - Get single property with caching
// @desc    Get detailed property information
// @access  Private (organization members)
router.get('/:id', readRateLimiter, cachePropertyMiddleware(), async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req;

    const property = await Property.findOne({ _id: id, ...propertyScope(req) })
      .populate('createdBy', 'firstName lastName email');

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Increment views
    property.views = (property.views || 0) + 1;
    await property.save();

    // Invalidate cache
    await cacheProperty.invalidate(id);
    await cacheProperties.invalidate(organizationId);

    res.json({
      success: true,
      property,
    });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ success: false, error: 'Server error fetching property' });
  }
});

// @route   PUT /api/properties/:id - Update property
// @desc    Update property details
// @access  Private (organization members)
router.put('/:id', writeRateLimiter, [
  body('title').optional().trim().isLength({ min: 5, max: 200 }),
  body('description').optional().isLength({ min: 10, max: 5000 }),
  body('price').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['available', 'sold', 'rented', 'under_negotiation', 'off_market']),
  body('propertyType').optional().isIn(['apartment', 'house', 'villa', 'plot', 'commercial', 'office', 'shop', 'warehouse', 'other']),
  body('listingType').optional().isIn(['sale', 'rent', 'lease']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { organizationId } = req;
    const updates = req.body;

    const property = await Property.findOne({ _id: id, ...propertyScope(req) });
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Update allowed fields
    const allowedFields = ['title', 'description', 'price', 'status', 'location', 'features', 'area', 'propertyType', 'listingType', 'amenities', 'owner'];
    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        property[key] = updates[key];
      }
    });

    await property.save();

    // Invalidate cache
    await cacheProperty.invalidate(id);
    await cacheProperties.invalidate(organizationId);

    res.json({
      success: true,
      message: 'Property updated successfully',
      property,
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ success: false, error: 'Server error updating property' });
  }
});

// @route   DELETE /api/properties/:id - Delete property
// @desc    Delete a property listing
// @access  Private (organization members)
router.delete('/:id', writeRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req;

    const property = await Property.findOneAndDelete({ _id: id, ...propertyScope(req) });
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Invalidate cache
    await cacheProperty.invalidate(id);
    await cacheProperties.invalidate(organizationId);

    res.json({
      success: true,
      message: 'Property deleted successfully',
    });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ success: false, error: 'Server error deleting property' });
  }
});

// @route   POST /api/properties/:id/images - Add property images via file upload
// @desc    Upload and add property images (local storage)
// @access  Private (organization members)
// @note    This route now uses file upload, not URL-based images
const { uploadImage } = require('../utils/fileUpload');
const { saveFileLocally } = require('../config/storage');

router.post('/:id/images', writeRateLimiter, uploadImage.array('images', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId, user } = req;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No image files provided' });
    }

    const property = await Property.findOne({ _id: id, ...propertyScope(req) });
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const uploadedImages = [];

    // Process each uploaded file
    for (const file of req.files) {
      // Validate file
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: 'Each image must be under 5MB' });
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' });
      }

      // Save file locally
      const fileInfo = await saveFileLocally(file, 'properties');

      // Add to property images
      const imageData = {
        url: fileInfo.url,
        filename: fileInfo.filename,
        size: fileInfo.size,
        mimetype: fileInfo.mimetype,
        isPrimary: property.images.length === 0 && uploadedImages.length === 0,
        order: property.images.length + uploadedImages.length,
        uploadedAt: new Date(),
      };

      property.images.push(imageData);
      uploadedImages.push(imageData);
    }

    await property.save();

    // Add activity log
    property.addActivity(user.id, 'uploaded_images', `${req.files.length} images uploaded`, 'images', null, { count: req.files.length });

    res.status(201).json({
      success: true,
      message: `${uploadedImages.length} images uploaded successfully`,
      images: property.images,
      uploaded: uploadedImages,
    });
  } catch (error) {
    console.error('Add images error:', error);
    res.status(500).json({ success: false, error: 'Server error adding images' });
  }
});

module.exports = router;
