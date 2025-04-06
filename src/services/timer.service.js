const Timer = require('../models/timer.model');
const Task = require('../models/task.model');
const User = require('../models/user.model');
const Group = require('../models/group.model');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Start a timer for a task
 * @param {string} taskId - Task ID
 * @param {string} userId - User ID
 * @returns {Object} Timer data
 */
const startTimer = async (taskId, userId) => {
  // Check if user already has an active timer
  const activeTimer = await Timer.findOne({
    user: userId,
    isActive: true,
  });

  if (activeTimer) {
    throw new Error('You already have an active timer. Complete it before starting a new one.');
  }

  // Find the task
  const task = await Task.findById(taskId);

  if (!task) {
    throw new Error('Task not found');
  }

  // Check if task is completed or cancelled
  if (task.status === 'completed' || task.status === 'cancelled') {
    throw new Error(`Cannot start timer for a ${task.status} task`);
  }

  // Check if user has access to the task
  const isCreator = task.creator.toString() === userId.toString();
  const isAssignee = task.assignees.includes(userId);

  let hasAccess = isCreator || isAssignee;

  // If task belongs to a group, check if user is a member or leader
  if (task.group && !hasAccess) {
    const group = await Group.findById(task.group);

    if (group) {
      const isGroupLeader = group.leaders.includes(userId);
      const isGroupMember = group.members.includes(userId);

      hasAccess = isGroupLeader || isGroupMember;
    }
  }

  if (!hasAccess) {
    throw new Error('You do not have permission to work on this task');
  }

  // Create a new timer
  const timer = new Timer({
    task: taskId,
    user: userId,
    group: task.group,
    startTime: new Date(),
    isActive: true,
  });

  await timer.save();

  // Update task status and timer counts
  await task.startTimer();

  // Add user to task assignees if not already assigned
  if (!isAssignee) {
    task.assignees.push(userId);
    await task.save();
  }

  // Store timer ID in Redis
  const redisClient = getRedisClient();
  await redisClient.set(`timer:${userId}:${taskId}`, timer._id.toString());

  logger.info(`Timer started: ${timer._id} for task: ${task._id} by user: ${userId}`);

  // Prepare timer data
  return {
    _id: timer._id,
    task: {
      _id: task._id,
      title: task.title,
      description: task.description,
      estimatedTime: task.estimatedTime,
      dueDate: task.dueDate,
    },
    startTime: timer.startTime,
    isActive: true,
  };
};

/**
 * Complete a timer
 * @param {string} userId - User ID
 * @param {string} notes - Optional notes
 * @returns {Object} Timer completion data
 */
const completeTimer = async (userId, notes = '') => {
  // Find the active timer for this user
  const timer = await Timer.findOne({
    user: userId,
    isActive: true,
  });

  if (!timer) {
    throw new Error('No active timer found');
  }

  // Find the task
  const task = await Task.findById(timer.task);

  if (!task) {
    throw new Error('Task not found');
  }

  // Complete the timer
  const result = await timer.complete(notes);

  // Mark task as completed by this user
  const completionData = await task.markAsCompleted(userId, result.duration);

  // Update user stats
  const user = await User.findById(userId);
  await user.updateStats(result.duration, result.completedOnTime);

  // Update group stats if task belongs to a group
  if (task.group) {
    const group = await Group.findById(task.group);
    if (group) {
      await group.updateStats(result.duration);
    }
  }

  // Remove timer from Redis
  const redisClient = getRedisClient();
  await redisClient.del(`timer:${userId}:${timer.task}`);

  logger.info(`Timer completed: ${timer._id} for task: ${task._id} by user: ${userId}`);

  // Prepare response data
  return {
    _id: timer._id,
    task: {
      _id: task._id,
      title: task.title,
      status: task.status,
    },
    startTime: timer.startTime,
    endTime: timer.endTime,
    duration: result.duration,
    completedOnTime: result.completedOnTime,
    notes: timer.notes,
    isActive: false,
    isCompleted: true,
  };
};

/**
 * Get active timer for a user
 * @param {string} userId - User ID
 * @returns {Object|null} Active timer or null
 */
const getActiveTimer = async (userId) => {
  // Find active timer for the user
  const timer = await Timer.findOne({
    user: userId,
    isActive: true,
  }).populate('task', 'title description estimatedTime dueDate');

  if (!timer) {
    return null;
  }

  // Calculate current duration
  const duration = timer.calculateDuration();

  // Prepare timer data
  return {
    _id: timer._id,
    task: timer.task,
    startTime: timer.startTime,
    duration,
    isActive: true,
  };
};

/**
 * List timers for a task
 * @param {string} taskId - Task ID
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Timers and pagination info
 */
const listTaskTimers = async (taskId, userId, options) => {
  const { page = 1, limit = 10 } = options;

  // Find task
  const task = await Task.findById(taskId);

  if (!task) {
    throw new Error('Task not found');
  }

  // Check if user has access to view the task's timers
  const isCreator = task.creator.toString() === userId.toString();
  const isAssignee = task.assignees.includes(userId);

  let hasAccess = isCreator || isAssignee;

  // If task belongs to a group, check if user is a member or leader
  if (task.group && !hasAccess) {
    const group = await Group.findById(task.group);

    if (group) {
      const isGroupLeader = group.leaders.includes(userId);
      const isGroupMember = group.members.includes(userId);

      hasAccess = isGroupLeader || isGroupMember;
    }
  }

  if (!hasAccess) {
    throw new Error('You do not have permission to view this task');
  }

  // Parse pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Count total timers
  const totalTimers = await Timer.countDocuments({ task: taskId });

  // Get timers
  const timers = await Timer.find({ task: taskId })
    .populate('user', 'firstName lastName avatar')
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(limitNum);

  // Calculate total pages
  const totalPages = Math.ceil(totalTimers / limitNum);

  return {
    timers,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems: totalTimers,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
};

module.exports = {
  startTimer,
  completeTimer,
  getActiveTimer,
  listTaskTimers,
};