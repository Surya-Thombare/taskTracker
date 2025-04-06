const {
  status: httpStatus
} = require('http-status');
const groupService = require('../services/group.service');
const {
  getIO
} = require('../websockets/socket');
const logger = require('../utils/logger');
const {
  successResponse,
  errorResponse
} = require('../utils/response');

/**
 * Create a new group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const createGroup = async (req, res) => {
  try {
    const group = await groupService.createGroup(req.body, req.user._id);
    return successResponse(res, httpStatus.CREATED, 'Group created successfully', {
      group
    });
  } catch (error) {
    logger.error('Error creating group:', error);
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create group');
  }
};

/**
 * Get group details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const getGroupDetails = async (req, res) => {
  try {
    const {
      groupId
    } = req.params;
    const result = await groupService.getGroupDetails(groupId, req.user._id);
    return successResponse(res, httpStatus.OK, 'Group details retrieved successfully', result);
  } catch (error) {
    logger.error('Error retrieving group details:', error);
    if (error.message === 'Group not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'You do not have permission to view this group') {
      return errorResponse(res, httpStatus.FORBIDDEN, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve group details');
  }
};

/**
 * Update group details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const updateGroup = async (req, res) => {
  try {
    const {
      groupId
    } = req.params;
    const group = await groupService.updateGroup(groupId, req.body, req.user._id);

    // Notify group members
    const io = getIO();
    io.to(`group:${groupId}`).emit('group:updated', {
      groupId,
      name: group.name,
      description: group.description,
      isPublic: group.isPublic,
      avatar: group.avatar
    });
    return successResponse(res, httpStatus.OK, 'Group updated successfully', {
      group
    });
  } catch (error) {
    logger.error('Error updating group:', error);
    if (error.message === 'Group not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'Only group leaders can update group details') {
      return errorResponse(res, httpStatus.FORBIDDEN, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update group');
  }
};

/**
 * Add a member to a group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const addMember = async (req, res) => {
  try {
    const {
      groupId
    } = req.params;
    const {
      email
    } = req.body;
    const user = await groupService.addMember(groupId, email, req.user._id);

    // Notify group members
    const io = getIO();
    io.to(`group:${groupId}`).emit('group:member:added', {
      groupId,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });

    // Notify added user
    io.to(`user:${user._id}`).emit('user:group:added', {
      group: {
        _id: groupId,
        name: req.group ? req.group.name : 'New Group'
      }
    });
    return successResponse(res, httpStatus.OK, 'Member added successfully', {
      user
    });
  } catch (error) {
    logger.error('Error adding member to group:', error);
    if (error.message === 'Group not found' || error.message === 'User not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'Only group leaders can add members' || error.message === 'User is already a member of this group') {
      return errorResponse(res, httpStatus.BAD_REQUEST, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to add member');
  }
};

/**
 * Remove a member from a group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const removeMember = async (req, res) => {
  try {
    const {
      groupId,
      memberId
    } = req.params;
    await groupService.removeMember(groupId, memberId, req.user._id);

    // Notify group members
    const io = getIO();
    io.to(`group:${groupId}`).emit('group:member:removed', {
      groupId,
      userId: memberId
    });

    // Notify removed user
    io.to(`user:${memberId}`).emit('user:group:removed', {
      groupId
    });
    return successResponse(res, httpStatus.OK, 'Member removed successfully');
  } catch (error) {
    logger.error('Error removing member from group:', error);
    if (error.message === 'Group not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message.includes('Only group leaders can remove members') || error.message === 'User is not a member of this group' || error.message === 'Cannot remove a leader. Demote to member first') {
      return errorResponse(res, httpStatus.BAD_REQUEST, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to remove member');
  }
};

/**
 * Promote a member to leader
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const promoteMember = async (req, res) => {
  try {
    const {
      groupId,
      memberId
    } = req.params;
    const user = await groupService.promoteMember(groupId, memberId, req.user._id);

    // Notify group members
    const io = getIO();
    io.to(`group:${groupId}`).emit('group:member:promoted', {
      groupId,
      user
    });

    // Notify promoted user
    io.to(`user:${memberId}`).emit('user:promoted', {
      groupId,
      groupName: req.group ? req.group.name : 'Group'
    });
    return successResponse(res, httpStatus.OK, 'Member promoted to leader successfully', {
      user
    });
  } catch (error) {
    logger.error('Error promoting member to leader:', error);
    if (error.message === 'Group not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'Only group leaders can promote members' || error.message === 'User is not a member of this group' || error.message === 'User is already a leader') {
      return errorResponse(res, httpStatus.BAD_REQUEST, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to promote member');
  }
};

/**
 * Demote a leader to member
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const demoteLeader = async (req, res) => {
  try {
    const {
      groupId,
      leaderId
    } = req.params;
    const user = await groupService.demoteLeader(groupId, leaderId, req.user._id);

    // Notify group members
    const io = getIO();
    io.to(`group:${groupId}`).emit('group:leader:demoted', {
      groupId,
      user
    });

    // Notify demoted user
    io.to(`user:${leaderId}`).emit('user:demoted', {
      groupId,
      groupName: req.group ? req.group.name : 'Group'
    });
    return successResponse(res, httpStatus.OK, 'Leader demoted to member successfully', {
      user
    });
  } catch (error) {
    logger.error('Error demoting leader to member:', error);
    if (error.message === 'Group not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'Only group leaders can demote leaders' || error.message === 'User is not a leader' || error.message === 'Cannot demote the group creator' || error.message === 'Cannot demote yourself') {
      return errorResponse(res, httpStatus.BAD_REQUEST, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to demote leader');
  }
};

/**
 * Join a group using invite code
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const joinGroup = async (req, res) => {
  try {
    const {
      inviteCode
    } = req.body;
    const group = await groupService.joinGroup(inviteCode, req.user._id);

    // Notify group members
    const io = getIO();

    // Get user details for notification
    const user = {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      avatar: req.user.avatar
    };
    io.to(`group:${group._id}`).emit('group:member:joined', {
      groupId: group._id,
      user
    });
    return successResponse(res, httpStatus.OK, 'Joined group successfully', {
      group
    });
  } catch (error) {
    logger.error('Error joining group:', error);
    if (error.message === 'Invalid invite code') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'You are already a member of this group') {
      return errorResponse(res, httpStatus.BAD_REQUEST, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to join group');
  }
};

/**
 * Generate a new invite code for a group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const regenerateInviteCode = async (req, res) => {
  try {
    const {
      groupId
    } = req.params;
    const result = await groupService.regenerateInviteCode(groupId, req.user._id);
    return successResponse(res, httpStatus.OK, 'Invite code regenerated successfully', result);
  } catch (error) {
    logger.error('Error regenerating invite code:', error);
    if (error.message === 'Group not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'Only group leaders can regenerate invite code') {
      return errorResponse(res, httpStatus.FORBIDDEN, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to regenerate invite code');
  }
};

/**
 * Get group leaderboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const getLeaderboard = async (req, res) => {
  try {
    const {
      groupId
    } = req.params;
    const leaderboard = await groupService.getLeaderboard(groupId, req.user._id);
    return successResponse(res, httpStatus.OK, 'Leaderboard retrieved successfully', {
      leaderboard
    });
  } catch (error) {
    logger.error('Error retrieving leaderboard:', error);
    if (error.message === 'Group not found') {
      return errorResponse(res, httpStatus.NOT_FOUND, error.message);
    }
    if (error.message === 'You do not have permission to view this group') {
      return errorResponse(res, httpStatus.FORBIDDEN, error.message);
    }
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve leaderboard');
  }
};

/**
 * List user's groups
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const listUserGroups = async (req, res) => {
  try {
    const result = await groupService.listUserGroups(req.user._id);
    return successResponse(res, httpStatus.OK, 'Groups retrieved successfully', result);
  } catch (error) {
    logger.error('Error listing user groups:', error);
    return errorResponse(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to list groups');
  }
};
module.exports = {
  createGroup,
  getGroupDetails,
  updateGroup,
  addMember,
  removeMember,
  promoteMember,
  demoteLeader,
  joinGroup,
  regenerateInviteCode,
  getLeaderboard,
  listUserGroups
};