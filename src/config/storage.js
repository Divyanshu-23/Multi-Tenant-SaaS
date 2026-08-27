// src/config/storage.js - Local File Storage System
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure upload directories exist
const ensureUploadDirs = () => {
  const folders = ['properties', 'tasks', 'avatars', 'documents'];
  folders.forEach((folder) => {
    const dir = path.join(UPLOAD_DIR, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize directories
ensureUploadDirs();

// Save file locally
const saveFileLocally = async (file, folder = 'properties') => {
  try {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${safeName}`;
    const targetDir = path.join(UPLOAD_DIR, folder);
    const filePath = path.join(targetDir, filename);

    // Save buffer to file
    fs.writeFileSync(filePath, file.buffer);

    // Return URL path (accessible via static file server)
    const relativeUrl = `/uploads/${folder}/${filename}`;

    return {
      url: relativeUrl,
      filename,
      filePath,
      size: file.size,
      mimetype: file.mimetype,
    };
  } catch (error) {
    console.error('Local save error:', error);
    throw new Error('Failed to save file locally');
  }
};

// Delete local file
const deleteLocalFile = async (relativeUrl) => {
  try {
    if (!relativeUrl) return false;
    const filePath = path.join(__dirname, '../../', relativeUrl);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Local delete error:', error);
    return false;
  }
};

module.exports = { saveFileLocally, deleteLocalFile, UPLOAD_DIR };