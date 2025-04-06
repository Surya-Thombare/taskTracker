const { status: httpStatus } = require('http-status');
const userService = require('../services/user.service');
const logger = require('../utils/logger');
const { successResponse, errorResponse, paginationMeta } = require('../utils/response');

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const updateProfile = async (req, res) => {
  try {
    const result = await userService.updateProfile(req.user, req.body);

    return successResponse(
      res,
      httpStatus.OK,
      'Profile updated successfully',
      result
    );
  } catch (error) {
    logger.error('Error updating user profile:', error);
    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update profile',
    );
  }
};

/**
 * Change user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // console.log('Current Password:', currentPassword, newPassword);

    await userService.changePassword(req.user, currentPassword, newPassword);

    return successResponse(
      res,
      httpStatus.OK,
      'Password changed successfully',
    );
  } catch (error) {
    logger.error('Error changing password:', error);

    if (error.message === 'Current password is incorrect') {
      return errorResponse(
        res,
        httpStatus.BAD_REQUEST,
        error.message,
      );
    }

    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to change password',
    );
  }
};

/**
 * Get user's task history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const getTaskHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await userService.getTaskHistory(userId, req.query);

    return successResponse(
      res,
      httpStatus.OK,
      'Task history retrieved successfully',
      { tasks: result.tasks },
      paginationMeta(
        result.pagination.page,
        result.pagination.limit,
        result.pagination.totalItems,
        result.pagination.totalPages
      )
    );
  } catch (error) {
    logger.error('Error retrieving task history:', error);
    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to retrieve task history',
    );
  }
};

/**
 * Get user's timer history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const getTimerHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await userService.getTimerHistory(userId, req.query);

    return successResponse(
      res,
      httpStatus.OK,
      'Timer history retrieved successfully',
      { timers: result.timers },
      paginationMeta(
        result.pagination.page,
        result.pagination.limit,
        result.pagination.totalItems,
        result.pagination.totalPages
      )
    );
  } catch (error) {
    logger.error('Error retrieving timer history:', error);
    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to retrieve timer history',
    );
  }
};

/**
 * Get user's dashboard stats
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const stats = await userService.getDashboardStats(userId);

    return successResponse(
      res,
      httpStatus.OK,
      'Dashboard stats retrieved successfully',
      stats
    );
  } catch (error) {
    logger.error('Error retrieving dashboard stats:', error);
    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to retrieve dashboard stats',
    );
  }
};

module.exports = {
  updateProfile,
  changePassword,
  getTaskHistory,
  getTimerHistory,
  getDashboardStats,
};