const { status: httpStatus } = require('http-status');
const logger = require('../utils/logger');

/**
 * Convert error to API error
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
const errorConverter = (err, req, res, next) => {
  // Convert Mongoose errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message,
    }));

    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Validation Error',
      errors,
    });
  }

  // Convert MongoDB duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];

    return res.status(httpStatus.CONFLICT).json({
      success: false,
      message: `Duplicate value: ${value} for field: ${field}`,
    });
  }

  // Continue to error handler
  next(err);
};

/**
 * Global error handler
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('API Error:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // Set status code
  const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;

  // Send error response
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  errorConverter,
  errorHandler,
};