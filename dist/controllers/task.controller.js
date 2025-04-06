const {
  status: httpStatus
} = require('http-status');
const taskService = require('../services/task.service');
const {
  getIO
} = require('../websockets/socket');
const logger = require('../utils/logger');
const {
  successResponse,
  errorResponse,
  paginationMeta
} = require('../utils/response');

/**
 * Create a new task
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(req.body, req.user._id);

    // If this is a group task, notify group members
    if (task.group) {
      const io = getIO();
      io.to(`group:${task.group}`).emit('group:task:created', {
        task: {
          _id: task._id,
          title: task.title,
          description: task.description,
          creator: task.creator,
          status: task.status,
          priority: task.priority,
          estimatedTime: task.estimatedTime,
          dueDate: task.dueDate,
          tags: task.tags,
          createdAt: task.createdAt
        },
        groupId: task.group
      });
    }
    return successResponse(res, httpStatus.CREATED, 'Task created successfully', {
      task
    });
  } catch (error) {
    logger.error('Error creating task:', error);
    if (error.message === 'Group not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'You must be a member of this group to create tasks') {
      return errorResponse(res, httpStatus.FORBIDDEN, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create task');
  }
};

/**
 * Get task details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const getTaskDetails = async (req, res) => {
  try {
    const {
      taskId
    } = req.params;
    const task = await taskService.getTaskDetails(taskId, req.user._id);
    return successResponse(res, httpStatus.OK, 'Task details retrieved successfully', {
      task
    });
  } catch (error) {
    logger.error('Error retrieving task details:', error);
    if (error.message === 'Task not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'You do not have permission to view this task') {
      return errorResponse(res, httpStatus.FORBIDDEN, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve task details');
  }
};

/**
 * Update a task
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const updateTask = async (req, res) => {
  try {
    const {
      taskId
    } = req.params;
    const task = await taskService.updateTask(taskId, req.body, req.user._id);

    // If this is a group task, notify group members
    if (task.group) {
      const io = getIO();
      io.to(`group:${task.group}`).emit('group:task:updated', {
        task: {
          _id: task._id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          estimatedTime: task.estimatedTime,
          dueDate: task.dueDate,
          tags: task.tags
        },
        groupId: task.group
      });
    }
    return successResponse(res, httpStatus.OK, 'Task updated successfully', {
      task
    });
  } catch (error) {
    logger.error('Error updating task:', error);
    if (error.message === 'Task not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'You do not have permission to update this task') {
      return errorResponse(res, httpStatus.FORBIDDEN, error.message);
    }
    if (error.message.includes('Cannot update a') || error.message === 'To mark task as completed, use the complete endpoint' || error.message === 'Cannot cancel a task with active timers') {
      return errorResponse(res, httpStatus.BAD_REQUEST, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update task');
  }
};

/**
 * Delete a task
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const deleteTask = async (req, res) => {
  try {
    const {
      taskId
    } = req.params;

    // Get task group ID before deletion for notification
    const task = await taskService.getTaskDetails(taskId, req.user._id);
    const groupId = task.group ? task.group._id : null;
    await taskService.deleteTask(taskId, req.user._id);

    // If this was a group task, notify group members
    if (groupId) {
      const io = getIO();
      io.to(`group:${groupId}`).emit('group:task:deleted', {
        taskId,
        groupId
      });
    }
    return successResponse(res, httpStatus.OK, 'Task deleted successfully');
  } catch (error) {
    logger.error('Error deleting task:', error);
    if (error.message === 'Task not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'You do not have permission to delete this task') {
      return errorResponse(res, httpStatus.FORBIDDEN, error.message);
    }
    if (error.message === 'Cannot delete a task with active timers') {
      return errorResponse(res, httpStatus.BAD_REQUEST, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete task');
  }
};

/**
 * List tasks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const listTasks = async (req, res) => {
  try {
    const result = await taskService.listTasks(req.query, req.user._id);
    return successResponse(res, httpStatus.OK, 'Tasks retrieved successfully', {
      tasks: result.tasks
    }, {
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error listing tasks:', error);
    if (error.message === 'Group not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'You do not have permission to view tasks in this group') {
      return errorResponse(res, httpStatus.FORBIDDEN, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to list tasks');
  }
};
module.exports = {
  createTask,
  getTaskDetails,
  updateTask,
  deleteTask,
  listTasks
};