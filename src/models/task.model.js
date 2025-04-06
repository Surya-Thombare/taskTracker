const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    minlength: [3, 'Task title must be at least 3 characters'],
    maxlength: [100, 'Task title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null,
  },
  assignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  estimatedTime: {
    type: Number,  // Estimated minutes to complete
    required: [true, 'Estimated time is required'],
    min: [1, 'Estimated time must be at least 1 minute'],
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
  },
  completedAt: {
    type: Date,
    default: null,
  },
  completedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: {
      type: Date,
    },
    timeSpent: {
      type: Number,  // Minutes spent
    },
    completedOnTime: {
      type: Boolean,
    },
  }],
  tags: [{
    type: String,
    maxlength: [20, 'Tag cannot exceed 20 characters'],
  }],
  activeTimers: {
    type: Number,
    default: 0,
  },
  totalTimers: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Create index for task search
 */
taskSchema.index({ title: 'text', description: 'text', tags: 'text' });

/**
 * Check if the task is overdue
 * @returns {boolean} True if task is overdue
 */
taskSchema.methods.isOverdue = function () {
  return this.dueDate < new Date() && this.status !== 'completed' && this.status !== 'cancelled';
};

/**
 * Mark task as completed by a user
 * @param {string} userId - User ID
 * @param {number} timeSpent - Time spent in minutes
 * @returns {Promise<void>}
 */
taskSchema.methods.markAsCompleted = async function (userId, timeSpent) {
  const now = new Date();
  const completedOnTime = now <= this.dueDate;

  // Add to completed by array
  this.completedBy.push({
    user: userId,
    completedAt: now,
    timeSpent,
    completedOnTime,
  });

  // Update task status if not already completed
  if (this.status !== 'completed') {
    this.status = 'completed';
    this.completedAt = now;
  }

  // Update active timers count
  this.activeTimers = Math.max(0, this.activeTimers - 1);

  await this.save();

  // Return completion data for updating user and group stats
  return {
    timeSpent,
    completedOnTime,
  };
};

/**
 * Start a timer for this task
 * @returns {Promise<void>}
 */
taskSchema.methods.startTimer = async function () {
  this.activeTimers += 1;
  this.totalTimers += 1;
  this.status = 'in-progress';

  await this.save();
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;