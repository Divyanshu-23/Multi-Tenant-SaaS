// src/routes/uploadRoutes.js - File upload endpoints for local storage
const express = require('express');
const { uploadImage, uploadDocument, uploadAvatar, validateFile } = require('../utils/fileUpload');
const { saveFileLocally, deleteLocalFile } = require('../config/storage');
const { auth, orgContext, requireOrgContext } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { uploadRateLimiter } = require('../middleware/rateLimiting');

const router = express.Router();
router.use(auth, orgContext, requireOrgContext);

// @route   POST /api/uploads/property/:id/image - Add property image
router.post('/property/:id/image', uploadRateLimiter, checkPermission('canEditProperty'), uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const Property = require('../models').Property;
    const property = await Property.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Validate file
    try {
      validateFile(req.file, 'image');
    } catch (validationError) {
      return res.status(400).json({ success: false, error: validationError.message });
    }

    // Save file locally
    const fileInfo = await saveFileLocally(req.file, 'properties');

    // Add image to property
    property.images.push({
      url: fileInfo.url,
      filename: fileInfo.filename,
      size: fileInfo.size,
      mimetype: fileInfo.mimetype,
    });
    await property.save();

    // Add activity log
    const user = req.user;
    property.addActivity(user.id, 'uploaded_image', 'Image uploaded', 'images', null, { url: fileInfo.url });

    res.status(201).json({
      success: true,
      message: 'Property image uploaded successfully',
      image: fileInfo,
      property,
    });
  } catch (error) {
    console.error('Upload property image error:', error);
    res.status(500).json({ success: false, error: 'Server error uploading image' });
  }
});

// @route   DELETE /api/uploads/property/:propertyId/image/:imageId - Delete property image
router.delete('/property/:propertyId/image/:imageId', uploadRateLimiter, checkPermission('canEditProperty'), async (req, res) => {
  try {
    const Property = require('../models').Property;
    const property = await Property.findOne({ _id: req.params.propertyId, organizationId: req.organizationId });
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const imageIndex = property.images.findIndex(img => img._id.toString() === req.params.imageId);
    if (imageIndex === -1) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    const image = property.images[imageIndex];

    // Delete file from local storage
    const deleted = await deleteLocalFile(image.url);
    if (!deleted) {
      console.warn('File not found for deletion:', image.url);
    }

    // Remove image from property
    property.images.splice(imageIndex, 1);
    await property.save();

    // Add activity log
    const user = req.user;
    property.addActivity(user.id, 'deleted_image', 'Image deleted', 'images', { url: image.url }, null);

    res.json({
      success: true,
      message: 'Property image deleted successfully',
      deletedImage: image,
    });
  } catch (error) {
    console.error('Delete property image error:', error);
    res.status(500).json({ success: false, error: 'Server error deleting image' });
  }
});

// @route   POST /api/uploads/task/:id/attachment - Add task attachment/document
router.post('/task/:id/attachment', uploadRateLimiter, checkPermission('canEditTask'), uploadDocument.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No document file provided' });
    }

    const Task = require('../models').Task;
    const task = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Validate file
    try {
      validateFile(req.file, 'document');
    } catch (validationError) {
      return res.status(400).json({ success: false, error: validationError.message });
    }

    // Save file locally
    const fileInfo = await saveFileLocally(req.file, 'documents');

    // Add attachment to task
    task.attachments.push({
      url: fileInfo.url,
      filename: fileInfo.filename,
      originalName: req.file.originalname,
      size: fileInfo.size,
      mimetype: fileInfo.mimetype,
      uploadedAt: new Date(),
    });
    await task.save();

    // Add activity log
    const user = req.user;
    task.addActivity(user.id, 'added_attachment', 'Attachment added');

    res.status(201).json({
      success: true,
      message: 'Task attachment uploaded successfully',
      attachment: fileInfo,
      task,
    });
  } catch (error) {
    console.error('Upload task attachment error:', error);
    res.status(500).json({ success: false, error: 'Server error uploading attachment' });
  }
});

// @route   DELETE /api/uploads/task/:taskId/attachment/:attachmentId - Delete task attachment
router.delete('/task/:taskId/attachment/:attachmentId', uploadRateLimiter, checkPermission('canEditTask'), async (req, res) => {
  try {
    const Task = require('../models').Task;
    const task = await Task.findOne({ _id: req.params.taskId, organizationId: req.organizationId });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const attachmentIndex = task.attachments.findIndex(att => att._id.toString() === req.params.attachmentId);
    if (attachmentIndex === -1) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    const attachment = task.attachments[attachmentIndex];

    // Delete file from local storage
    const deleted = await deleteLocalFile(attachment.url);
    if (!deleted) {
      console.warn('File not found for deletion:', attachment.url);
    }

    // Remove attachment from task
    task.attachments.splice(attachmentIndex, 1);
    await task.save();

    // Add activity log
    const user = req.user;
    task.addActivity(user.id, 'removed_attachment', 'Attachment removed');

    res.json({
      success: true,
      message: 'Task attachment deleted successfully',
      deletedAttachment: attachment,
    });
  } catch (error) {
    console.error('Delete task attachment error:', error);
    res.status(500).json({ success: false, error: 'Server error deleting attachment' });
  }
});

// @route   POST /api/uploads/user/avatar - Upload user avatar
router.post('/user/avatar', uploadRateLimiter, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No avatar image provided' });
    }

    // Validate file
    try {
      validateFile(req.file, 'avatar');
    } catch (validationError) {
      return res.status(400).json({ success: false, error: validationError.message });
    }

    const User = require('../models').User;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Delete old avatar if exists
    if (user.avatar) {
      await deleteLocalFile(user.avatar);
    }

    // Save new avatar locally
    const fileInfo = await saveFileLocally(req.file, 'avatars');

    // Update user
    user.avatar = fileInfo.url;
    await user.save();

    res.json({
      success: true,
      message: 'User avatar uploaded successfully',
      avatar: fileInfo,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Upload user avatar error:', error);
    res.status(500).json({ success: false, error: 'Server error uploading avatar' });
  }
});

// @route   GET /api/uploads/health - Check upload system health
router.get('/health', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { UPLOAD_DIR } = require('../config/storage');

    // Check if upload directories exist and are writable
    const folders = ['properties', 'tasks', 'avatars', 'documents'];
    const dirStatus = {};

    folders.forEach((folder) => {
      const dir = path.join(UPLOAD_DIR, folder);
      try {
        const exists = fs.existsSync(dir);
        const writable = exists ? true : false;
        dirStatus[folder] = { exists, writable, path: dir };
      } catch (err) {
        dirStatus[folder] = { exists: false, writable: false, error: err.message, path: dir };
      }
    });

    res.json({
      success: true,
      uploadSystem: 'Local File Storage',
      directories: dirStatus,
      health: 'healthy',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Upload health check error:', error);
    res.status(500).json({ success: false, error: 'Server error checking upload health' });
  }
});

module.exports = router;