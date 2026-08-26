// src/config/socket.js - Socket.IO configuration for Real-Time Updates
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('./env');

let io = null;

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.token;
    if (!token) return next(new Error('Authentication error: Token required'));

    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.warn(`⚡ Socket Connected: ${socket.id} (User: ${socket.userId})`);

    // Join organization room for tenant isolation
    socket.on('join_org', (orgId) => {
      socket.join(`org_${orgId}`);
      console.warn(`User ${socket.userId} joined room org_${orgId}`);
    });

    socket.on('leave_org', (orgId) => {
      socket.leave(`org_${orgId}`);
    });

    socket.on('disconnect', () => {
      console.warn(`❌ Socket Disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

const notifyOrg = (orgId, event, data) => {
  if (io) io.to(`org_${orgId}`).emit(event, data);
};

module.exports = { initSocket, getIO, notifyOrg };