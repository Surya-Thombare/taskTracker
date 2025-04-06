const Joi = require('joi');
const {
  body,
  query,
  param
} = require('express-validator');
const {
  validate,
  registerValidation,
  handleValidationErrors
} = require('../middleware/validation.middleware');

/**
 * User login validation schema
 */
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

/**
 * Group creation validation schema
 */
const createGroupSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  description: Joi.string().max(500),
  isPublic: Joi.boolean().default(false)
});

/**
 * Task creation validation schema
 */
const createTaskSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000),
  groupId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
  estimatedTime: Joi.number().min(1).required(),
  dueDate: Joi.date().greater('now').required(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  tags: Joi.array().items(Joi.string().max(20)).max(5)
});

/**
 * Task update validation schema
 */
const updateTaskSchema = Joi.object({
  title: Joi.string().min(3).max(100),
  description: Joi.string().max(1000),
  estimatedTime: Joi.number().min(1),
  dueDate: Joi.date().greater('now'),
  priority: Joi.string().valid('low', 'medium', 'high'),
  status: Joi.string().valid('pending', 'in-progress', 'completed', 'cancelled'),
  tags: Joi.array().items(Joi.string().max(20)).max(5)
});

/**
 * Task timer start validation schema
 */
const startTimerSchema = Joi.object({
  taskId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  socketId: Joi.string()
});

/**
 * Pagination validation schema
 */
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

/**
 * Express-validator validation chains for user profile update
 */
const updateProfileValidation = [body('firstName').optional().trim().isLength({
  min: 2,
  max: 30
}).withMessage('First name must be between 2 and 30 characters'), body('lastName').optional().trim().isLength({
  min: 2,
  max: 30
}).withMessage('Last name must be between 2 and 30 characters'), body('bio').optional().trim().isLength({
  max: 500
}).withMessage('Bio cannot exceed 500 characters'), body('avatar').optional().isURL().withMessage('Avatar must be a valid URL')];

/**
 * Express-validator validation chains for changing password
 */
const changePasswordValidation = [body('currentPassword').notEmpty().withMessage('Current password is required'), body('newPassword').isLength({
  min: 8
}).withMessage('New password must be at least 8 characters long').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')];

/**
 * Express-validator validation chains for group creation
 */
const createGroupValidation = [body('name').trim().isLength({
  min: 3,
  max: 50
}).withMessage('Group name must be between 3 and 50 characters'), body('description').optional().trim().isLength({
  max: 500
}).withMessage('Description cannot exceed 500 characters'), body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean value')];

/**
 * Express-validator validation chains for pagination
 */
const paginationValidation = [query('page').optional().isInt({
  min: 1
}).withMessage('Page must be a positive integer'), query('limit').optional().isInt({
  min: 1,
  max: 100
}).withMessage('Limit must be between 1 and 100'), query('sortBy').optional().isString().withMessage('sortBy must be a string'), query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be either "asc" or "desc"')];
module.exports = {
  loginSchema,
  createGroupSchema,
  createTaskSchema,
  updateTaskSchema,
  startTimerSchema,
  paginationSchema,
  registerValidation,
  updateProfileValidation,
  changePasswordValidation,
  createGroupValidation,
  paginationValidation,
  validate,
  handleValidationErrors
};