const mongoose = require('mongoose');
const timerSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  duration: {
    type: Number,
    // Duration in minutes
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedOnTime: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
});

/**
 * Calculate the current timer duration
 * @returns {number} Duration in minutes
 */
timerSchema.methods.calculateDuration = function () {
  const endTime = this.endTime || new Date();
  const durationMs = endTime - this.startTime;
  return Math.round(durationMs / (1000 * 60));
};

/**
 * Complete the timer
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Timer completion data
 */
timerSchema.methods.complete = async function (notes = '') {
  const now = new Date();
  this.endTime = now;
  this.isActive = false;
  this.isCompleted = true;
  this.duration = this.calculateDuration();
  if (notes) {
    this.notes = notes;
  }

  // Get the task to check if completed on time
  const Task = mongoose.model('Task');
  const task = await Task.findById(this.task);
  if (task) {
    this.completedOnTime = now <= task.dueDate;
  }
  await this.save();
  return {
    duration: this.duration,
    completedOnTime: this.completedOnTime
  };
};

/**
 * Get timer status data for real-time updates
 * @returns {Object} Timer status data
 */
timerSchema.methods.getStatusData = function () {
  return {
    _id: this._id,
    taskId: this.task,
    userId: this.user,
    startTime: this.startTime,
    isActive: this.isActive,
    isCompleted: this.isCompleted,
    duration: this.calculateDuration()
  };
};
const Timer = mongoose.model('Timer', timerSchema);
module.exports = Timer;