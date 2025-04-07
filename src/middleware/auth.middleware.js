const { verifyToken, isTokenBlacklisted } = require('../config/jwt');
const User = require('../models/user.model');
const { status: httpStatus } = require('http-status');

/**
 * Authentication middleware
 * Verifies the JWT token and attaches the user to the request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
const authenticate = async (req, res, next) => {
  // console.log('retrieving user profile:', user._id);
  console.log('retrieving user profile:', req);
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    // Extract the token
    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }

    // Verify the token
    const decoded = verifyToken(token);

    // Find the user
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'User associated with this token no longer exists.',
      });
    }

    // Attach the user to the request
    req.user = user;

    // Continue
    next();
  } catch (error) {
    console.log('Error retrieving user profile:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Token expired. Please log in again.',
      });
    }

    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  authenticate,
};