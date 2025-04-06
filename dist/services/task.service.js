const Task = require('../models/task.model');
const Group = require('../models/group.model');
const logger = require('../utils/logger');

/**
 * Create a new task
 * @param {Object} taskData - Task data
 * @param {string} userId - Creator ID
 * @returns {Object} Created task
 */
const createTask = async (taskData, userId) => {
  const {
    title,
    description,
    groupId,
    estimatedTime,
    dueDate,
    priority,
    tags
  } = taskData;

  // Create task payload
  const newTaskData = {
    title,
    description,
    creator: userId,
    estimatedTime,
    dueDate,
    priority: priority || 'medium',
    tags: tags || []
  };

  // If groupId is provided, validate and add to task
  if (groupId) {
    // Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Check if user is a member or leader of the group
    const isLeader = group.leaders.includes(userId);
    const isMember = group.members.includes(userId);
    if (!isLeader && !isMember) {
      throw new Error('You must be a member of this group to create tasks');
    }
    newTaskData.group = groupId;

    // Update group total tasks count
    group.totalTasks += 1;
    await group.save();
  }

  // Create task
  const task = new Task(newTaskData);
  await task.save();
  logger.info(`Task created: ${task._id} by user: ${userId}`);
  return task;
};

/**
 * Get task details
 * @param {string} taskId - Task ID
 * @param {string} userId - User ID
 * @returns {Object} Task details
 */
const getTaskDetails = async (taskId, userId) => {
  // Find task
  const task = await Task.findById(taskId).populate('creator', 'firstName lastName avatar').populate('group', 'name isPublic').populate('assignees', 'firstName lastName avatar').populate('completedBy.user', 'firstName lastName avatar');
  if (!task) {
    throw new Error('Task not found');
  }

  // Check if user has access to this task
  const isCreator = task.creator._id.toString() === userId.toString();
  const isAssignee = task.assignees.some(assignee => assignee._id.toString() === userId.toString());
  const isCompletedBy = task.completedBy.some(entry => entry.user._id.toString() === userId.toString());
  let hasAccess = isCreator || isAssignee || isCompletedBy;

  // If task belongs to a group, check if user is a member or leader
  if (task.group && !hasAccess) {
    const group = await Group.findById(task.group._id);
    if (group) {
      const isGroupLeader = group.leaders.includes(userId);
      const isGroupMember = group.members.includes(userId);
      const isPublicGroup = group.isPublic;
      hasAccess = isGroupLeader || isGroupMember || isPublicGroup;
    }
  }
  if (!hasAccess) {
    throw new Error('You do not have permission to view this task');
  }
  return task;
};

/**
 * Update a task
 * @param {string} taskId - Task ID
 * @param {Object} updateData - Update data
 * @param {string} userId - User ID
 * @returns {Object} Updated task
 */
const updateTask = async (taskId, updateData, userId) => {
  // Find task
  const task = await Task.findById(taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  // Check if user has permission to update this task
  let hasPermission = task.creator.toString() === userId.toString();

  // If task belongs to a group, check if user is a leader
  if (task.group && !hasPermission) {
    const group = await Group.findById(task.group);
    if (group) {
      hasPermission = group.leaders.includes(userId);
    }
  }
  if (!hasPermission) {
    throw new Error('You do not have permission to update this task');
  }

  // Cannot update completed or cancelled tasks
  if (task.status === 'completed' || task.status === 'cancelled') {
    throw new Error(`Cannot update a ${task.status} task`);
  }

  // Update fields
  const {
    title,
    description,
    estimatedTime,
    dueDate,
    priority,
    status,
    tags
  } = updateData;
  if (title) task.title = title;
  if (description !== undefined) task.description = description;
  if (estimatedTime) task.estimatedTime = estimatedTime;
  if (dueDate) task.dueDate = new Date(dueDate);
  if (priority) task.priority = priority;
  if (tags) task.tags = tags;

  // Handle status updates separately
  if (status && status !== task.status) {
    if (status === 'completed') {
      // For 'completed' status, use markAsCompleted method instead
      throw new Error('To mark task as completed, use the complete endpoint');
    } else if (status === 'cancelled' && task.activeTimers > 0) {
      throw new Error('Cannot cancel a task with active timers');
    } else {
      task.status = status;
    }
  }
  await task.save();
  logger.info(`Task updated: ${task._id} by user: ${userId}`);
  return task;
};

/**
 * Delete a task
 * @param {string} taskId - Task ID
 * @param {string} userId - User ID
 * @returns {boolean} Success status
 */
const deleteTask = async (taskId, userId) => {
  // Find task
  const task = await Task.findById(taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  // Check if user has permission to delete this task
  let hasPermission = task.creator.toString() === userId.toString();

  // If task belongs to a group, check if user is a leader
  if (task.group && !hasPermission) {
    const group = await Group.findById(task.group);
    if (group) {
      hasPermission = group.leaders.includes(userId);
    }
  }
  if (!hasPermission) {
    throw new Error('You do not have permission to delete this task');
  }

  // Cannot delete tasks with active timers
  if (task.activeTimers > 0) {
    throw new Error('Cannot delete a task with active timers');
  }

  // If task belongs to a group, update group total tasks count
  if (task.group) {
    const group = await Group.findById(task.group);
    if (group) {
      if (task.status === 'completed') {
        group.completedTasks = Math.max(0, group.completedTasks - 1);
      }
      group.totalTasks = Math.max(0, group.totalTasks - 1);
      await group.save();
    }
  }

  // Delete task
  await task.deleteOne();
  logger.info(`Task deleted: ${task._id} by user: ${userId}`);
  return true;
};

/**
 * List tasks
 * @param {Object} queryOptions - Query options
 * @param {string} userId - User ID
 * @returns {Object} Tasks and pagination info
 */
const listTasks = async (queryOptions, userId) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    status,
    priority,
    groupId,
    search
  } = queryOptions;

  // Parse pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Build query
  const query = {};

  // If groupId is provided, filter by group
  if (groupId) {
    // Check if user has access to this group
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    const isLeader = group.leaders.includes(userId);
    const isMember = group.members.includes(userId);
    const isPublicGroup = group.isPublic;
    if (!isLeader && !isMember && !isPublicGroup) {
      throw new Error('You do not have permission to view tasks in this group');
    }
    query.group = groupId;
  } else {
    // Only show tasks created by the user or assigned to the user
    query.$or = [{
      creator: userId
    }, {
      assignees: userId
    }];
  }

  // Add filters
  if (status) {
    query.status = status;
  }
  if (priority) {
    query.priority = priority;
  }

  // Add search
  if (search) {
    query.$text = {
      $search: search
    };
  }

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Count total tasks
  const totalTasks = await Task.countDocuments(query);

  // Get tasks
  const tasks = await Task.find(query).populate('creator', 'firstName lastName avatar').populate('group', 'name').sort(sortOptions).skip(skip).limit(limitNum);

  // Calculate total pages
  const totalPages = Math.ceil(totalTasks / limitNum);
  return {
    tasks,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems: totalTasks,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    }
  };
};
module.exports = {
  createTask,
  getTaskDetails,
  updateTask,
  deleteTask,
  listTasks
};