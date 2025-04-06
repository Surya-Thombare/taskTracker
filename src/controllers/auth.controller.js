const { status: httpStatus } = require('http-status');
const authService = require('../services/auth.service');
const { blacklistToken } = require('../config/jwt');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const register = async (req, res) => {
  try {
    const result = await authService.register(req.body);

    return successResponse(
      res,
      // httpStatus.CREATED,
      201,
      'User registered successfully',
      result
    );
  } catch (error) {
    logger.error('Error registering user:', error);

    if (error.message === 'User with this email already exists') {
      return errorResponse(
        res,
        httpStatus.CONFLICT,
        error.message
      );
    }

    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to register user',
    );
  }
};

/**
 * Login a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    return successResponse(
      res,
      httpStatus.OK,
      'Login successful',
      result
    );
  } catch (error) {
    logger.error('Error logging in user:', error);

    if (error.message === 'Invalid email or password') {
      return errorResponse(
        res,
        httpStatus.UNAUTHORIZED,
        error.message
      );
    }

    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to login',
    );
  }
};

/**
 * Refresh access token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    const result = await authService.refreshToken(token);

    return successResponse(
      res,
      httpStatus.OK,
      'Token refreshed successfully',
      result
    );
  } catch (error) {
    logger.error('Error refreshing token:', error);

    if (error.message === 'Refresh token is required' ||
      error.message === 'Invalid refresh token' ||
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError') {
      return errorResponse(
        res,
        httpStatus.UNAUTHORIZED,
        'Invalid or expired refresh token',
      );
    }

    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to refresh token',
    );
  }
};

/**
 * Logout a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return errorResponse(
        res,
        httpStatus.BAD_REQUEST,
        'Access token is required',
      );
    }

    // Blacklist the token
    await blacklistToken(token, Math.floor(Date.now() / 1000) + 60 * 60); // 1 hour

    // Clear refresh token using service
    await authService.logout(req.user);

    return successResponse(
      res,
      httpStatus.OK,
      'Logout successful',
    );
  } catch (error) {
    logger.error('Error logging out user:', error);
    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to logout',
    );
  }
};

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response
 */
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    // Send response
    return successResponse(
      res,
      httpStatus.OK,
      'Profile retrieved successfully',
      {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
        groups: user.groups,
        tasksCompleted: user.tasksCompleted,
        taskCompletionRate: user.taskCompletionRate,
        totalTimeSpent: user.totalTimeSpent,
        joinedAt: user.joinedAt,
        lastActive: user.lastActive,
      }
    );
  } catch (error) {
    logger.error('Error retrieving user profile:', error);
    return errorResponse(
      res,
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to retrieve profile',
    );
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
};