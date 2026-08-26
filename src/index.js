// src/index.js - Updated with routes
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');
const securityMiddleware = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/authRoutes');
const orgRoutes = require('./routes/orgRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Security middleware
securityMiddleware(app);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Real Estate SaaS API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Real Estate SaaS API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      organizations: '/api/orgs',
      properties: '/api/properties (coming soon)',
      tasks: '/api/tasks (coming soon)',
      admin: '/api/admin (coming soon)',
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);

// Error handling (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis (non-blocking)
    await connectRedis();

    // Start server
    app.listen(PORT, () => {
      console.warn(`✅ Server running on port ${PORT}`);
      console.warn(`📄 Environment: ${process.env.NODE_ENV}`);
      console.warn(`🔗 API Base URL: http://localhost:${PORT}`);
      console.warn(`\n📚 Available endpoints:`);
      console.warn(`   POST   /api/auth/register`);
      console.warn(`   POST   /api/auth/login`);
      console.warn(`   POST   /api/auth/refresh`);
      console.warn(`   POST   /api/auth/logout`);
      console.warn(`   POST   /api/auth/verify-email`);
      console.warn(`   POST   /api/auth/forgot-password`);
      console.warn(`   POST   /api/auth/reset-password`);
      console.warn(`   POST   /api/orgs`);
      console.warn(`   GET    /api/orgs`);
      console.warn(`   GET    /api/orgs/:orgId`);
      console.warn(`   PUT    /api/orgs/:orgId`);
      console.warn(`   POST   /api/orgs/:orgId/members`);
      console.warn(`   GET    /api/orgs/:orgId/members`);
      console.warn(`   DELETE /api/orgs/:orgId/members/:userId`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();

module.exports = app;