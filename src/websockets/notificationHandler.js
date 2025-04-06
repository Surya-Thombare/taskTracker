const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');

/**
 * Handle notification-related socket events
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @returns {void}
 */
const notificationHandler = (io, socket) => {
  /**
   * Subscribe to group updates
   * @param {Object} data - Group data
   * @param {Function} callback - Acknowledgement callback
   * @returns {void}
   */
  socket.on('group:subscribe', async (data, callback) => {
    try {
      const { groupId } = data;

      // Join the group room
      socket.join(`group:${groupId}`);

      logger.info(`User ${socket.user._id} subscribed to group ${groupId}`);

      callback({ success: true });
    } catch (error) {
      logger.error('Error subscribing to group:', error);
      callback({ success: false, message: 'Failed to subscribe to group' });
    }
  });

  /**
   * Unsubscribe from group updates
   * @param {Object} data - Group data
   * @param {Function} callback - Acknowledgement callback
   * @returns {void}
   */
  socket.on('group:unsubscribe', async (data, callback) => {
    try {
      const { groupId } = data;

      // Leave the group room
      socket.leave(`group:${groupId}`);

      logger.info(`User ${socket.user._id} unsubscribed from group ${groupId}`);

      callback({ success: true });
    } catch (error) {
      logger.error('Error unsubscribing from group:', error);
      callback({ success: false, message: 'Failed to unsubscribe from group' });
    }
  });

  /**
   * Send a notification to a user
   * @param {string} userId - User ID
   * @param {string} type - Notification type
   * @param {Object} data - Notification data
   * @returns {void}
   */
  const sendUserNotification = (userId, type, data) => {
    io.to(`user:${userId}`).emit('notification', {
      type,
      timestamp: new Date(),
      ...data,
    });
  };

  /**
   * Send a notification to a group
   * @param {string} groupId - Group ID
   * @param {string} type - Notification type
   * @param {Object} data - Notification data
   * @returns {void}
   */
  const sendGroupNotification = (groupId, type, data) => {
    io.to(`group:${groupId}`).emit('group:notification', {
      type,
      timestamp: new Date(),
      groupId,
      ...data,
    });
  };

  // Expose notification methods
  socket.notifyUser = sendUserNotification;
  socket.notifyGroup = sendGroupNotification;
};

// Export the handler and helper functions
module.exports = notificationHandler;