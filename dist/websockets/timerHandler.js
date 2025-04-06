const Task = require('../models/task.model');
const Timer = require('../models/timer.model');
const User = require('../models/user.model');
const Group = require('../models/group.model');
const logger = require('../utils/logger');
const {
  getRedisClient
} = require('../config/redis');

/**
 * Handle timer-related socket events
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket connection
 * @returns {void}
 */
const timerHandler = (io, socket) => {
  /**
   * Start a new timer for a task
   * @param {Object} data - Timer data
   * @param {Function} callback - Acknowledgement callback
   * @returns {void}
   */
  socket.on('timer:start', async (data, callback) => {
    try {
      const {
        taskId
      } = data;

      // Find the task
      const task = await Task.findById(taskId);
      if (!task) {
        return callback({
          success: false,
          message: 'Task not found'
        });
      }

      // Check if task is completed or cancelled
      if (task.status === 'completed' || task.status === 'cancelled') {
        return callback({
          success: false,
          message: `Cannot start timer for a ${task.status} task`
        });
      }

      // Create a new timer
      const timer = new Timer({
        task: taskId,
        user: socket.user._id,
        group: task.group,
        startTime: new Date(),
        isActive: true
      });
      await timer.save();

      // Update task status
      await task.startTimer();

      // Store timer ID in Redis with user ID
      const redisClient = getRedisClient();
      await redisClient.set(`timer:${socket.user._id}:${taskId}`, timer._id.toString());

      // Notify relevant rooms about the timer
      const timerData = {
        _id: timer._id,
        task: {
          _id: task._id,
          title: task.title
        },
        user: {
          _id: socket.user._id,
          name: socket.user.getFullName()
        },
        startTime: timer.startTime,
        isActive: true
      };

      // Notify user's room
      socket.emit('timer:started', timerData);

      // Notify group room if task belongs to a group
      if (task.group) {
        io.to(`group:${task.group}`).emit('group:timer:started', {
          ...timerData,
          group: task.group
        });
      }
      logger.info(`Timer started: ${timer._id} for task: ${task._id} by user: ${socket.user._id}`);
      callback({
        success: true,
        timer: timerData
      });
    } catch (error) {
      logger.error('Error starting timer:', error);
      callback({
        success: false,
        message: 'Failed to start timer'
      });
    }
  });

  /**
   * Complete a timer
   * @param {Object} data - Timer data
   * @param {Function} callback - Acknowledgement callback
   * @returns {void}
   */
  socket.on('timer:complete', async (data, callback) => {
    try {
      const {
        taskId,
        notes
      } = data;

      // Get timer ID from Redis
      const redisClient = getRedisClient();
      const timerId = await redisClient.get(`timer:${socket.user._id}:${taskId}`);
      if (!timerId) {
        return callback({
          success: false,
          message: 'No active timer found for this task'
        });
      }

      // Find the timer
      const timer = await Timer.findById(timerId);
      if (!timer || !timer.isActive) {
        return callback({
          success: false,
          message: 'Timer not found or already completed'
        });
      }

      // Complete the timer
      const result = await timer.complete(notes);

      // Find the task
      const task = await Task.findById(taskId);
      if (!task) {
        return callback({
          success: false,
          message: 'Task not found'
        });
      }

      // Mark task as completed by this user
      const completionData = await task.markAsCompleted(socket.user._id, result.duration);

      // Update user stats
      await socket.user.updateStats(result.duration, result.completedOnTime);

      // Update group stats if task belongs to a group
      if (task.group) {
        const group = await Group.findById(task.group);
        if (group) {
          await group.updateStats(result.duration);
        }
      }

      // Remove timer from Redis
      await redisClient.del(`timer:${socket.user._id}:${taskId}`);

      // Prepare response data
      const timerData = {
        _id: timer._id,
        task: {
          _id: task._id,
          title: task.title,
          status: task.status
        },
        user: {
          _id: socket.user._id,
          name: socket.user.getFullName()
        },
        startTime: timer.startTime,
        endTime: timer.endTime,
        duration: result.duration,
        completedOnTime: result.completedOnTime,
        isActive: false,
        isCompleted: true
      };

      // Notify user's room
      socket.emit('timer:completed', timerData);

      // Notify group room if task belongs to a group
      if (task.group) {
        io.to(`group:${task.group}`).emit('group:timer:completed', {
          ...timerData,
          group: task.group
        });
      }
      logger.info(`Timer completed: ${timer._id} for task: ${task._id} by user: ${socket.user._id}`);
      callback({
        success: true,
        timer: timerData
      });
    } catch (error) {
      logger.error('Error completing timer:', error);
      callback({
        success: false,
        message: 'Failed to complete timer'
      });
    }
  });

  /**
   * Get active timer for a user
   * @param {Function} callback - Acknowledgement callback
   * @returns {void}
   */
  socket.on('timer:get:active', async callback => {
    try {
      // Find active timer for the user
      const timer = await Timer.findOne({
        user: socket.user._id,
        isActive: true
      }).populate('task', 'title description estimatedTime dueDate');
      if (!timer) {
        return callback({
          success: true,
          timer: null
        });
      }

      // Get timer status data
      const timerData = {
        _id: timer._id,
        task: timer.task,
        startTime: timer.startTime,
        duration: timer.calculateDuration(),
        isActive: true
      };
      callback({
        success: true,
        timer: timerData
      });
    } catch (error) {
      logger.error('Error getting active timer:', error);
      callback({
        success: false,
        message: 'Failed to get active timer'
      });
    }
  });
};
module.exports = timerHandler;