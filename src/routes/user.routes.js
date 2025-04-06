const express = require('express');
const {
  updateProfile,
  changePassword,
  getTaskHistory,
  getTimerHistory,
  getDashboardStats
} = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, paginationSchema } = require('../utils/validators');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route PATCH /api/users/profile
 * @desc Update user profile
 * @access Private
 */
router.patch('/profile', updateProfile);

/**
 * @route POST /api/users/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/change-password', changePassword);

/**
 * @route GET /api/users/tasks
 * @desc Get user's task history
 * @access Private
 */
router.get('/tasks', validate(paginationSchema, 'query'), getTaskHistory);

/**
 * @route GET /api/users/timers
 * @desc Get user's timer history
 * @access Private
 */
router.get('/timers', validate(paginationSchema, 'query'), getTimerHistory);

/**
 * @route GET /api/users/dashboard
 * @desc Get user's dashboard stats
 * @access Private
 */
router.get('/dashboard', getDashboardStats);

module.exports = router;