const User = require('../models/user.model');
const Task = require('../models/task.model');
const Timer = require('../models/timer.model');
const logger = require('../utils/logger');

/**
 * Update user profile
 * @param {Object} user - User object
 * @param {Object} profileData - Profile data to update
 * @returns {Object} Updated user
 */
const updateProfile = async (user, profileData) => {
  const {
    firstName,
    lastName,
    bio,
    avatar
  } = profileData;

  // Update fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (bio !== undefined) user.bio = bio;
  if (avatar !== undefined) user.avatar = avatar;
  await user.save();
  logger.info(`User profile updated: ${user._id}`);
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    bio: user.bio,
    avatar: user.avatar
  };
};

/**
 * Change user password
 * @param {Object} user - User object
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {boolean} Success status
 */
const changePassword = async (user, currentPassword, newPassword) => {
  // Validate current password

  console.log('Current Password:', user);
  const currentUser = await User.findById(user._id).select('+password');
  if (!currentUser) {
    throw new Error('User not found');
  }
  const isCurrentPasswordValid = await currentUser.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();
  logger.info(`User password changed: ${user._id}`);
  return true;
};

/**
 * Get user's task history
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Tasks and pagination info
 */
const getTaskHistory = async (userId, options) => {
  const {
    page = 1,
    limit = 10,
    status
  } = options;

  // Build query
  const query = {
    $or: [{
      creator: userId
    }, {
      assignees: userId
    }, {
      'completedBy.user': userId
    }]
  };
  if (status) {
    query.status = status;
  }

  // Parse pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Count total tasks
  const totalTasks = await Task.countDocuments(query);

  // Get tasks
  const tasks = await Task.find(query).populate('group', 'name').sort({
    createdAt: -1
  }).skip(skip).limit(limitNum);

  // Calculate total pages
  const totalPages = Math.ceil(totalTasks / limitNum);
  return {
    tasks,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems: totalTasks,
      totalPages
    }
  };
};

/**
 * Get user's timer history
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Timers and pagination info
 */
const getTimerHistory = async (userId, options) => {
  const {
    page = 1,
    limit = 10
  } = options;

  // Parse pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Count total timers
  const totalTimers = await Timer.countDocuments({
    user: userId,
    isCompleted: true
  });

  // Get timers
  const timers = await Timer.find({
    user: userId,
    isCompleted: true
  }).populate('task', 'title').populate('group', 'name').sort({
    endTime: -1
  }).skip(skip).limit(limitNum);

  // Calculate total pages
  const totalPages = Math.ceil(totalTimers / limitNum);
  return {
    timers,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems: totalTimers,
      totalPages
    }
  };
};

/**
 * Get user's dashboard stats
 * @param {string} userId - User ID
 * @returns {Object} Dashboard stats
 */
const getDashboardStats = async userId => {
  // Get user stats
  const user = await User.findById(userId).select('tasksCompleted taskCompletionRate totalTimeSpent');

  // Get active timer if any
  const activeTimer = await Timer.findOne({
    user: userId,
    isActive: true
  }).populate('task', 'title description estimatedTime dueDate');

  // Get pending tasks
  const pendingTasks = await Task.countDocuments({
    $or: [{
      creator: userId,
      status: 'pending'
    }, {
      assignees: userId,
      status: 'pending'
    }]
  });

  // Get in-progress tasks
  const inProgressTasks = await Task.countDocuments({
    $or: [{
      creator: userId,
      status: 'in-progress'
    }, {
      assignees: userId,
      status: 'in-progress'
    }]
  });

  // Get completed tasks (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCompletedTasks = await Task.countDocuments({
    $or: [{
      creator: userId,
      status: 'completed',
      completedAt: {
        $gte: thirtyDaysAgo
      }
    }, {
      'completedBy.user': userId,
      'completedBy.completedAt': {
        $gte: thirtyDaysAgo
      }
    }]
  });

  // Get recent timers (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentTimers = await Timer.find({
    user: userId,
    isCompleted: true,
    endTime: {
      $gte: sevenDaysAgo
    }
  }).populate('task', 'title').sort({
    endTime: -1
  }).limit(5);

  // Calculate daily stats for the last 7 days
  const dailyStats = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const timers = await Timer.find({
      user: userId,
      isCompleted: true,
      endTime: {
        $gte: date,
        $lt: nextDate
      }
    });
    const totalTime = timers.reduce((sum, timer) => sum + timer.duration, 0);
    const tasksCompleted = timers.length;
    dailyStats.unshift({
      date: date.toISOString().split('T')[0],
      totalTime,
      tasksCompleted
    });
  }
  return {
    userStats: {
      tasksCompleted: user.tasksCompleted,
      taskCompletionRate: user.taskCompletionRate,
      totalTimeSpent: user.totalTimeSpent
    },
    activeTimer: activeTimer ? {
      _id: activeTimer._id,
      task: activeTimer.task,
      startTime: activeTimer.startTime,
      duration: activeTimer.calculateDuration()
    } : null,
    taskCounts: {
      pending: pendingTasks,
      inProgress: inProgressTasks,
      recentlyCompleted: recentCompletedTasks
    },
    recentTimers,
    dailyStats
  };
};
module.exports = {
  updateProfile,
  changePassword,
  getTaskHistory,
  getTimerHistory,
  getDashboardStats
};