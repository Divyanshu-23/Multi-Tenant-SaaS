// src/utils/fileUpload.js - File upload utilities
const multer = require('multer');
const path = require('path');

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
  avatar: 2 * 1024 * 1024, // 2MB
};

// Allowed MIME types
const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
};

// Multer storage configuration (in-memory)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
    }
  };
};

// Create multer instances
const uploadImage = multer({
  storage,
  fileFilter: fileFilter(ALLOWED_MIME_TYPES.image),
  limits: { fileSize: FILE_SIZE_LIMITS.image },
});

const uploadDocument = multer({
  storage,
  fileFilter: fileFilter(ALLOWED_MIME_TYPES.document),
  limits: { fileSize: FILE_SIZE_LIMITS.document },
});

const uploadAvatar = multer({
  storage,
  fileFilter: fileFilter(ALLOWED_MIME_TYPES.avatar),
  limits: { fileSize: FILE_SIZE_LIMITS.avatar },
});

// File validation helper
const validateFile = (file, type = 'image') => {
  if (!file) {
    throw new Error('No file provided');
  }

  const sizeLimit = FILE_SIZE_LIMITS[type];
  if (file.size > sizeLimit) {
    throw new Error(`File size exceeds limit of ${sizeLimit / 1024 / 1024}MB`);
  }

  const allowedTypes = ALLOWED_MIME_TYPES[type];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
  }

  return true;
};

// Get file extension
const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

// Generate unique filename
const generateFilename = (originalFilename) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const ext = getFileExtension(originalFilename);
  return `${timestamp}-${random}${ext}`;
};

module.exports = {
  uploadImage,
  uploadDocument,
  uploadAvatar,
  validateFile,
  getFileExtension,
  generateFilename,
  FILE_SIZE_LIMITS,
  ALLOWED_MIME_TYPES,
};