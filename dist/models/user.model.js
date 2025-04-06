const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [30, 'First name cannot exceed 30 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [30, 'Last name cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long']
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  tasksCompleted: {
    type: Number,
    default: 0
  },
  taskCompletionRate: {
    type: Number,
    default: 0
  },
  totalTimeSpent: {
    type: Number,
    // Total minutes spent on tasks
    default: 0
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  refreshToken: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.password;
      delete ret.refreshToken;
      return ret;
    }
  }
});

/**
 * Hash the password before saving
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compare passwords
 * @param {string} candidatePassword - Password to compare
 * @returns {Promise<boolean>} True if passwords match
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Get user's full name
 * @returns {string} Full name
 */
userSchema.methods.getFullName = function () {
  return `${this.firstName} ${this.lastName}`;
};

/**
 * Update user stats after task completion
 * @param {number} taskTime - Time spent on task (minutes)
 * @param {boolean} completedOnTime - Whether task was completed on time
 */
userSchema.methods.updateStats = async function (taskTime, completedOnTime) {
  this.tasksCompleted += 1;
  this.totalTimeSpent += taskTime;

  // Update completion rate
  const newCompletionRate = (this.taskCompletionRate * (this.tasksCompleted - 1) + (completedOnTime ? 100 : 0)) / this.tasksCompleted;
  this.taskCompletionRate = Math.round(newCompletionRate * 100) / 100;
  this.lastActive = Date.now();
  await this.save();
};
const User = mongoose.model('User', userSchema);
module.exports = User;