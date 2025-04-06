const express = require('express');
const {
  startTimer,
  completeTimer,
  getActiveTimer,
  listTaskTimers,
} = require('../controllers/timer.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, startTimerSchema, paginationSchema } = require('../utils/validators');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route POST /api/timers/start
 * @desc Start a timer for a task
 * @access Private
 */
router.post('/start', validate(startTimerSchema), startTimer);

/**
 * @route POST /api/timers/complete
 * @desc Complete the active timer
 * @access Private
 */
router.post('/complete', completeTimer);

/**
 * @route GET /api/timers/active
 * @desc Get the user's active timer
 * @access Private
 */
router.get('/active', getActiveTimer);

/**
 * @route GET /api/timers/task/:taskId
 * @desc List timers for a task
 * @access Private
 */
router.get('/task/:taskId', validate(paginationSchema, 'query'), listTaskTimers);

module.exports = router;