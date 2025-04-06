const {
  status: httpStatus
} = require('http-status');
const Group = require('../models/group.model');

/**
 * Check if user is a group leader
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
const isGroupLeader = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.body.groupId;
    if (!groupId) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    // Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if the user is a leader
    const isLeader = group.leaders.includes(req.user._id);
    if (!isLeader) {
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        message: 'Only group leaders can perform this action'
      });
    }

    // Attach the group to the request
    req.group = group;

    // Continue
    next();
  } catch (error) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error checking group leadership'
    });
  }
};

/**
 * Check if user is a group member
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
const isGroupMember = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.body.groupId;
    if (!groupId) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    // Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if the user is a member
    const isMember = group.members.includes(req.user._id) || group.leaders.includes(req.user._id);
    if (!isMember) {
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        message: 'You must be a member of this group to perform this action'
      });
    }

    // Attach the group to the request
    req.group = group;

    // Continue
    next();
  } catch (error) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error checking group membership'
    });
  }
};
module.exports = {
  isGroupLeader,
  isGroupMember
};