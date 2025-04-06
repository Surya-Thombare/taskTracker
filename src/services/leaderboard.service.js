const User = require('../models/user.model');
const Group = require('../models/group.model');
const Task = require('../models/task.model');
const Timer = require('../models/timer.model');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Generate group leaderboard
 * @param {string} groupId - Group ID
 * @param {Object} options - Leaderboard options
 * @returns {Array} Leaderboard data
 */
const generateGroupLeaderboard = async (groupId, options = {}) => {
  const { timeFrame = 'all' } = options;

  // Find group
  const group = await Group.findById(groupId);

  if (!group) {
    throw new Error('Group not found');
  }

  // Get all members and leaders
  const userIds = [...group.members, ...group.leaders];

  // Get all tasks in this group
  const tasks = await Task.find({ group: groupId });
  const taskIds = tasks.map(task => task._id);

  // Define time frame filter
  const timeFilter = {};

  if (timeFrame === 'week') {
    // Last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    timeFilter.endTime = { $gte: sevenDaysAgo };
  } else if (timeFrame === 'month') {
    // Last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    timeFilter.endTime = { $gte: thirtyDaysAgo };
  }

  // Get all completed timers for tasks in this group
  const timers = await Timer.find({
    task: { $in: taskIds },
    user: { $in: userIds },
    isCompleted: true,
    ...timeFilter,
  });

  // Group timers by user
  const userStats = {};

  for (const timer of timers) {
    const userId = timer.user.toString();

    if (!userStats[userId]) {
      userStats[userId] = {
        tasksCompleted: 0,
        totalTime: 0,
        tasksCompletedOnTime: 0,
      };
    }

    userStats[userId].tasksCompleted += 1;
    userStats[userId].totalTime += timer.duration;
    userStats[userId].tasksCompletedOnTime += timer.completedOnTime ? 1 : 0;
  }

  // Get user details
  const users = await User.find({ _id: { $in: userIds } })
    .select('firstName lastName avatar');

  // Combine user data with stats
  const leaderboard = users.map(user => {
    const userId = user._id.toString();
    const stats = userStats[userId] || {
      tasksCompleted: 0,
      totalTime: 0,
      tasksCompletedOnTime: 0,
    };

    const completionRate = stats.tasksCompleted > 0
      ? Math.round((stats.tasksCompletedOnTime / stats.tasksCompleted) * 100)
      : 0;

    return {
      user: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        avatar: user.avatar,
      },
      tasksCompleted: stats.tasksCompleted,
      totalTime: stats.totalTime,
      completionRate,
      isLeader: group.leaders.includes(user._id),
    };
  });

  // Sort by tasks completed (descending)
  return leaderboard.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
};

/**
 * Generate global leaderboard (across all public groups)
 * @param {Object} options - Leaderboard options
 * @returns {Array} Leaderboard data
 */
const generateGlobalLeaderboard = async (options = {}) => {
  const { timeFrame = 'month', limit = 10 } = options;

  // Define time frame filter
  const timeFilter = {};

  if (timeFrame === 'week') {
    // Last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    timeFilter.endTime = { $gte: sevenDaysAgo };
  } else if (timeFrame === 'month') {
    // Last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    timeFilter.endTime = { $gte: thirtyDaysAgo };
  } else if (timeFrame === 'year') {
    // Last 365 days
    const yearAgo = new Date();
    yearAgo.setDate(yearAgo.getDate() - 365);
    timeFilter.endTime = { $gte: yearAgo };
  }

  // Try to get from Redis cache
  const redisClient = getRedisClient();
  const cacheKey = `leaderboard:global:${timeFrame}`;

  try {
    const cachedLeaderboard = await redisClient.get(cacheKey);

    if (cachedLeaderboard) {
      return JSON.parse(cachedLeaderboard).slice(0, limit);
    }
  } catch (error) {
    logger.error('Error getting leaderboard from cache:', error);
  }

  // Find public groups
  const publicGroups = await Group.find({ isPublic: true }).select('_id');
  const publicGroupIds = publicGroups.map(group => group._id);

  // Aggregate timer data for users in public groups
  const pipeline = [
    {
      $match: {
        group: { $in: publicGroupIds },
        isCompleted: true,
        ...timeFilter,
      },
    },
    {
      $group: {
        _id: '$user',
        tasksCompleted: { $sum: 1 },
        totalTime: { $sum: '$duration' },
        tasksCompletedOnTime: {
          $sum: { $cond: ['$completedOnTime', 1, 0] },
        },
      },
    },
    {
      $sort: { tasksCompleted: -1 },
    },
    {
      $limit: limit * 2, // Get more than needed for filtering
    },
  ];

  const timerStats = await Timer.aggregate(pipeline);

  // Get user details
  const userIds = timerStats.map(stat => stat._id);
  const users = await User.find({ _id: { $in: userIds } })
    .select('firstName lastName avatar');

  // Create user map for quick lookups
  const userMap = {};
  users.forEach(user => {
    userMap[user._id.toString()] = user;
  });

  // Combine user data with stats
  const leaderboard = timerStats.map(stat => {
    const user = userMap[stat._id.toString()];

    // Skip if user not found
    if (!user) return null;

    const completionRate = stat.tasksCompleted > 0
      ? Math.round((stat.tasksCompletedOnTime / stat.tasksCompleted) * 100)
      : 0;

    return {
      user: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        avatar: user.avatar,
      },
      tasksCompleted: stat.tasksCompleted,
      totalTime: stat.totalTime,
      completionRate,
    };
  }).filter(Boolean); // Remove null entries

  // Cache in Redis (expire after 1 hour)
  try {
    await redisClient.set(cacheKey, JSON.stringify(leaderboard), {
      EX: 60 * 60, // 1 hour
    });
  } catch (error) {
    logger.error('Error caching leaderboard:', error);
  }

  // Return limited results
  return leaderboard.slice(0, limit);
};

module.exports = {
  generateGroupLeaderboard,
  generateGlobalLeaderboard,
};