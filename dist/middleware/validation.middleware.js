const {
  status: httpStatus
} = require('http-status');
const Joi = require('joi');
const {
  body,
  validationResult,
  matchedData
} = require('express-validator');
const logger = require('../utils/logger');

/**
 * Validate request data against schema
 * @param {Object} schema - Joi schema
 * @param {string} property - Request property to validate (body, query, params)
 * @returns {Function} Express middleware
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const {
      error,
      value
    } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }

    // Replace request data with validated data
    req[property] = value;
    return next();
  };
};

/**
 * XSS sanitization middleware using express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const xssSanitizer = (req, res, next) => {
  try {
    // Sanitize request body fields
    if (req.body && typeof req.body === 'object') {
      for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
          // Replace potentially malicious characters
          req.body[key] = req.body[key].replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/javascript:/gi, '').replace(/onerror/gi, '').replace(/onclick/gi, '').replace(/onload/gi, '').replace(/onmouseover/gi, '');
        }
      }
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          req.query[key] = req.query[key].replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/javascript:/gi, '').replace(/onerror/gi, '').replace(/onclick/gi, '').replace(/onload/gi, '').replace(/onmouseover/gi, '');
        }
      }
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      for (const key in req.params) {
        if (typeof req.params[key] === 'string') {
          req.params[key] = req.params[key].replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/javascript:/gi, '').replace(/onerror/gi, '').replace(/onclick/gi, '').replace(/onload/gi, '').replace(/onmouseover/gi, '');
        }
      }
    }
    next();
  } catch (error) {
    logger.error('Error in XSS sanitization middleware:', error);
    next();
  }
};

/**
 * Create express-validator validation chain for registration
 */
const registerValidation = [body('firstName').trim().isLength({
  min: 2,
  max: 30
}).withMessage('First name must be between 2 and 30 characters'), body('lastName').trim().isLength({
  min: 2,
  max: 30
}).withMessage('Last name must be between 2 and 30 characters'), body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(), body('password').isLength({
  min: 8
}).withMessage('Password must be at least 8 characters long').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'), body('confirmPassword').custom((value, {
  req
}) => {
  if (value !== req.body.password) {
    throw new Error('Passwords do not match');
  }
  return true;
})];

/**
 * Middleware to handle express-validator validation results
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg
    }));
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Validation Error',
      errors: formattedErrors
    });
  }

  // Get sanitized data
  req.sanitizedData = matchedData(req);
  next();
};

/**
 * Trim string values in request data
 * @param {Array} fields - Fields to trim
 * @param {string} property - Request property to trim (body, query, params)
 * @returns {Function} Express middleware
 */
const trim = (fields = [], property = 'body') => {
  return (req, res, next) => {
    try {
      // If no fields specified, trim all string fields
      if (fields.length === 0) {
        Object.keys(req[property]).forEach(key => {
          if (typeof req[property][key] === 'string') {
            req[property][key] = req[property][key].trim();
          }
        });
      } else {
        // Trim only specified fields
        fields.forEach(field => {
          if (req[property][field] && typeof req[property][field] === 'string') {
            req[property][field] = req[property][field].trim();
          }
        });
      }
      next();
    } catch (error) {
      logger.error('Error in trim middleware:', error);
      next();
    }
  };
};
module.exports = {
  validate,
  xssSanitizer,
  registerValidation,
  handleValidationErrors,
  trim
};