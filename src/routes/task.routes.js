const express = require('express');
const {
  createTask,
  getTaskDetails,
  updateTask,
  deleteTask,
  listTasks,
} = require('../controllers/task.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate, createTaskSchema, updateTaskSchema, paginationSchema } = require('../utils/validators');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route POST /api/tasks
 * @desc Create a new task
 * @access Private
 */
router.post('/', validate(createTaskSchema), createTask);

/**
 * @route GET /api/tasks
 * @desc List tasks
 * @access Private
 */
router.get('/', validate(paginationSchema, 'query'), listTasks);

/**
 * @route GET /api/tasks/:taskId
 * @desc Get task details
 * @access Private
 */
router.get('/:taskId', getTaskDetails);

/**
 * @route PATCH /api/tasks/:taskId
 * @desc Update a task
 * @access Private
 */
router.patch('/:taskId', validate(updateTaskSchema), updateTask);

/**
 * @route DELETE /api/tasks/:taskId
 * @desc Delete a task
 * @access Private
 */
router.delete('/:taskId', deleteTask);

module.exports = router;