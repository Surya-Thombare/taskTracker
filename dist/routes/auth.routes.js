const express = require('express');
const {
  register,
  login,
  refreshToken,
  logout,
  getProfile
} = require('../controllers/auth.controller');
const {
  authenticate
} = require('../middleware/auth.middleware');
const {
  validate,
  registerValidation,
  handleValidationErrors,
  loginSchema
} = require('../utils/validators');
const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', registerValidation, handleValidationErrors, register);

/**
 * @route POST /api/auth/login
 * @desc Login a user
 * @access Public
 */
router.post('/login', validate(loginSchema), login);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh-token', refreshToken);

/**
 * @route POST /api/auth/logout
 * @desc Logout a user
 * @access Private
 */
router.post('/logout', authenticate, logout);

/**
 * @route GET /api/auth/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile', authenticate, getProfile);
module.exports = router;