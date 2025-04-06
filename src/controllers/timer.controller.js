const { status: httpStatus } = require('http-status');
const timerService = require('../services/timer.service');
const Task = require('../models/task.model');
const { getIO } = require('../websockets/socket');
const logger = require('../utils/logger');
const { successResponse, errorResponse, paginationMeta } = require('../utils/response');

/**
 * Start a timer for a task
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const startTimer = async (req, res) => {
  try {
    const { taskId } = req.body;
    const timerData = await timerService.startTimer(taskId, req.user._id);

    // Notify via WebSocket
    const io = getIO();
    const socket = io.sockets.sockets.get(req.body.socketId);

    if (socket) {
      socket.emit('timer:started', timerData);

      // Get task to check if belongs to a group
      const task = await Task.findById(taskId);

      // Notify group room if task belongs to a group
      if (task && task.group) {
        io.to(`group:${task.group}`).emit('group:timer:started', {
          ...timerData,
          user: {
            _id: req.user._id,
            name: `${req.user.firstName} ${req.user.lastName}`,
          },
          group: task.group,
        });
      }
    }

    return successResponse(
      res,
      httpStatus.CREATED,
      'Timer started successfully',
      { timer: timerData }
    );
  } catch (error) {
    logger.error('Error starting timer:', error);

    if (error.message === 'Task not found') {
      return errorResponse(
        res,
        httpStatus.NOT_FOUND,
        error.message
      );
    }

    if (error.message === 'You already have an active timer. Complete it before starting a new one.' ||
      error.message.includes('Cannot start timer for a') ||
      error.message === 'You do not have permission to work on this task') {
      return errorResponse(
        res,
        httpStatus.BAD_REQUEST,
        error.message
      );
    }

    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to start timer',
    );
  }
};

/**
 * Complete a timer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const completeTimer = async (req, res) => {
  try {
    const { notes } = req.body;
    const timerData = await timerService.completeTimer(req.user._id, notes);

    // Notify via WebSocket
    const io = getIO();
    const socket = io.sockets.sockets.get(req.body.socketId);

    if (socket) {
      socket.emit('timer:completed', timerData);

      // Get the task to check if it belongs to a group
      const task = await Task.findById(timerData.task._id);

      // Notify group room if task belongs to a group
      if (task && task.group) {
        io.to(`group:${task.group}`).emit('group:timer:completed', {
          ...timerData,
          user: {
            _id: req.user._id,
            name: `${req.user.firstName} ${req.user.lastName}`,
          },
          group: task.group,
        });
      }
    }

    return successResponse(
      res,
      httpStatus.OK,
      'Timer completed successfully',
      { timer: timerData }
    );
  } catch (error) {
    logger.error('Error completing timer:', error);

    if (error.message === 'No active timer found' || error.message === 'Task not found') {
      return errorResponse(
        res,
        httpStatus.NOT_FOUND,
        error.message
      );
    }

    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to complete timer',
    );
  }
};

/**
 * Get active timer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const getActiveTimer = async (req, res) => {
  try {
    const timer = await timerService.getActiveTimer(req.user._id);

    return successResponse(
      res,
      httpStatus.OK,
      timer ? 'Active timer retrieved successfully' : 'No active timer found',
      { timer }
    );
  } catch (error) {
    logger.error('Error retrieving active timer:', error);
    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to retrieve active timer',
    );
  }
};

/**
 * List task timers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const listTaskTimers = async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await timerService.listTaskTimers(taskId, req.user._id, req.query);

    return successResponse(
      res,
      httpStatus.OK,
      'Task timers retrieved successfully',
      { timers: result.timers },
      {
        pagination: result.pagination
      }
    );
  } catch (error) {
    logger.error('Error listing task timers:', error);

    if (error.message === 'Task not found') {
      return errorResponse(
        res,
        httpStatus.NOT_FOUND,
        error.message
      );
    }

    if (error.message === 'You do not have permission to view this task') {
      return errorResponse(
        res,
        httpStatus.FORBIDDEN,
        error.message
      );
    }

    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to list task timers',
    );
  }
};

module.exports = {
  startTimer,
  completeTimer,
  getActiveTimer,
  listTaskTimers,
};