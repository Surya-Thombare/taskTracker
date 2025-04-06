const {
  Server
} = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const {
  verifyToken
} = require('../config/jwt');
const logger = require('../utils/logger');
const timerHandler = require('./timerHandler');
const notificationHandler = require('./notificationHandler');
let io;

/**
 * Setup Socket.IO server
 * @param {Object} server - HTTP server
 * @returns {Object} Socket.IO server instance
 */
const setupSocketIO = server => {
  // Initialize Socket.IO
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = verifyToken(token);

      // Find the user
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }

      // Attach user to socket
      socket.user = user;

      // Update last active timestamp
      user.lastActive = Date.now();
      await user.save();
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Handle connections
  io.on('connection', socket => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user._id})`);

    // Join user's personal room
    socket.join(`user:${socket.user._id}`);

    // Join group rooms if user is member of any groups
    if (socket.user.groups && socket.user.groups.length > 0) {
      socket.user.groups.forEach(groupId => {
        socket.join(`group:${groupId}`);
      });
    }

    // Setup timer handlers
    timerHandler(io, socket);

    // Setup notification handlers
    notificationHandler(io, socket);

    // Handle disconnections
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id} (User: ${socket.user._id})`);
    });
  });
  return io;
};

/**
 * Get Socket.IO instance
 * @returns {Object} Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};
module.exports = {
  setupSocketIO,
  getIO
};