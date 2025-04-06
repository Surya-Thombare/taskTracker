const User = require('../models/user.model');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../config/jwt');
const logger = require('../utils/logger');

/**
 * Register a new user
 * @param {Object} userData - User data
 * @returns {Object} User and tokens
 */
const register = async userData => {
  // Check if user already exists
  const existingUser = await User.findOne({
    email: userData.email
  });
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Create new user
  const user = new User(userData);
  await user.save();

  // Generate tokens
  const accessToken = generateAccessToken({
    id: user._id
  });
  const refreshToken = generateRefreshToken({
    id: user._id
  });

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();
  logger.info(`User registered: ${user._id}`);
  return {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    },
    tokens: {
      accessToken,
      refreshToken
    }
  };
};

/**
 * Login a user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Object} User and tokens
 */
const login = async (email, password) => {
  // Find user by email
  const user = await User.findOne({
    email
  });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Compare passwords
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }

  // Generate tokens
  const accessToken = generateAccessToken({
    id: user._id
  });
  const refreshToken = generateRefreshToken({
    id: user._id
  });

  // Save refresh token
  user.refreshToken = refreshToken;
  user.lastActive = Date.now();
  await user.save();
  logger.info(`User logged in: ${user._id}`);
  return {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      groups: user.groups
    },
    tokens: {
      accessToken,
      refreshToken
    }
  };
};

/**
 * Refresh access token
 * @param {string} refreshToken - Refresh token
 * @returns {Object} New access token
 */
const refreshToken = async refreshToken => {
  if (!refreshToken) {
    throw new Error('Refresh token is required');
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Find user
  const user = await User.findById(decoded.id);
  if (!user || user.refreshToken !== refreshToken) {
    throw new Error('Invalid refresh token');
  }

  // Generate new access token
  const accessToken = generateAccessToken({
    id: user._id
  });
  logger.info(`Token refreshed for user: ${user._id}`);
  return {
    accessToken
  };
};

/**
 * Logout a user
 * @param {Object} user - User object
 * @returns {void}
 */
const logout = async user => {
  // Clear refresh token
  user.refreshToken = null;
  await user.save();
  logger.info(`User logged out: ${user._id}`);
};
module.exports = {
  register,
  login,
  refreshToken,
  logout
};