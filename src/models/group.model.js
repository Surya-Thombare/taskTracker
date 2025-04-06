const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    minlength: [3, 'Group name must be at least 3 characters'],
    maxlength: [50, 'Group name cannot exceed 50 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
  avatar: {
    type: String,
    default: null,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  leaders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  }],
  completedTasks: {
    type: Number,
    default: 0,
  },
  totalTasks: {
    type: Number,
    default: 0,
  },
  totalTimeSpent: {
    type: Number,  // Total minutes spent on tasks
    default: 0,
  },
  inviteCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Generate invite code for the group
 */
groupSchema.pre('save', function (next) {
  if (!this.inviteCode) {
    // Generate a random 8-character invite code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';

    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    this.inviteCode = code;
  }

  next();
});

/**
 * Generate leaderboard data for the group
 * @returns {Promise<Array>} Leaderboard data
 */
groupSchema.methods.generateLeaderboard = async function () {
  const User = mongoose.model('User');
  const Task = mongoose.model('Task');
  const Timer = mongoose.model('Timer');

  // Get all members and leaders
  const userIds = [...this.members, ...this.leaders];

  // Get all timers for tasks in this group
  const tasks = await Task.find({ group: this._id });
  const taskIds = tasks.map(task => task._id);

  const timers = await Timer.find({
    task: { $in: taskIds },
    user: { $in: userIds },
    isCompleted: true,
  });

  // Group timers by user
  const userStats = {};

  for (const timer of timers) {
    if (!userStats[timer.user]) {
      userStats[timer.user] = {
        tasksCompleted: 0,
        totalTime: 0,
        tasksCompletedOnTime: 0,
      };
    }

    userStats[timer.user].tasksCompleted += 1;
    userStats[timer.user].totalTime += timer.duration;
    userStats[timer.user].tasksCompletedOnTime += timer.completedOnTime ? 1 : 0;
  }

  // Get user details
  const users = await User.find({ _id: { $in: userIds } })
    .select('firstName lastName avatar');

  // Combine user data with stats
  const leaderboard = users.map(user => {
    const stats = userStats[user._id] || {
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
      isLeader: this.leaders.includes(user._id),
    };
  });

  // Sort by tasks completed (descending)
  return leaderboard.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
};

/**
 * Update group stats after task completion
 * @param {number} taskTime - Time spent on task (minutes)
 */
groupSchema.methods.updateStats = async function (taskTime) {
  this.completedTasks += 1;
  this.totalTimeSpent += taskTime;
  this.lastActive = Date.now();

  await this.save();
};

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;