// src/index.js - Updated main application file
require('dotenv').config();
const express = require('express');
const http = require('http');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { initSocket } = require('./config/socket');
const errorHandler = require('./middleware/errorHandler');
const securityMiddleware = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/authRoutes');
const orgRoutes = require('./routes/orgRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const taskRoutes = require('./routes/taskRoutes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.IO
initSocket(server);

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
    version: '1.0.0',
  });
});

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Real Estate SaaS API',
    version: '1.0.0',
    features: {
      authentication: 'JWT auth, registration, password reset',
      multi_tenancy: 'Organization-based data isolation',
      properties: 'CRUD, filtering, search, pagination',
      tasks: 'Task/lead management, real-time updates',
      real_time: 'WebSocket notifications',
    },
    endpoints: {
      auth: '/api/auth',
      organizations: '/api/orgs',
      properties: '/api/properties',
      tasks: '/api/tasks',
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/tasks', taskRoutes);

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
    server.listen(PORT, () => {
      console.warn(`✅ Server running on port ${PORT}`);
      console.warn(`📄 Environment: ${process.env.NODE_ENV}`);
      console.warn(`🔗 API Base URL: http://localhost:${PORT}`);
      console.warn(`⚡ WebSocket URL: ws://localhost:${PORT}`);
      console.warn(`\n📚 Available endpoints:`);
      console.warn(`   POST   /api/auth/register          - Register user`);
      console.warn(`   POST   /api/auth/login             - Login user`);
      console.warn(`   POST   /api/auth/refresh           - Refresh token`);
      console.warn(`   POST   /api/orgs                   - Create organization`);
      console.warn(`   GET    /api/orgs                   - List user's orgs`);
      console.warn(`   GET    /api/orgs/:orgId            - Get org details`);
      console.warn(`   PUT    /api/orgs/:orgId            - Update organization`);
      console.warn(`   POST   /api/orgs/:orgId/members    - Invite member`);
      console.warn(`   GET    /api/orgs/:orgId/members    - List members`);
      console.warn(`   DELETE /api/orgs/:orgId/members/:userId - Remove member`);
      console.warn(`\n   Properties:`);
      console.warn(`   POST   /api/properties             - Create property`);
      console.warn(`   GET    /api/properties             - List properties`);
      console.warn(`   GET    /api/properties/:id         - Get property`);
      console.warn(`   PUT    /api/properties/:id         - Update property`);
      console.warn(`   DELETE /api/properties/:id         - Delete property`);
      console.warn(`   POST   /api/properties/:id/images  - Add images`);
      console.warn(`   GET    /api/properties/search/query - Full-text search`);
      console.warn(`   GET    /api/properties/stats/overview - Statistics`);
      console.warn(`\n   Tasks (Real-time):`);
      console.warn(`   POST   /api/tasks                  - Create task/lead`);
      console.warn(`   GET    /api/tasks                  - List tasks`);
      console.warn(`   GET    /api/tasks/:id              - Get task details`);
      console.warn(`   PUT    /api/tasks/:id              - Update task`);
      console.warn(`   DELETE /api/tasks/:id              - Delete task`);
      console.warn(`   POST   /api/tasks/:id/comments     - Add comment`);
      console.warn(`\n🔌 WebSocket Events:`);
      console.warn(`   - task_created    - New task created`);
      console.warn(`   - task_updated    - Task status/priority changed`);
      console.warn(`   - task_deleted    - Task removed`);
      console.warn(`   - comment_added   - New comment on task`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();

module.exports = { app, server };