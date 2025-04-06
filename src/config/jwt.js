const jwt = require('jsonwebtoken');
const { getRedisClient } = require('./redis');
const logger = require('../utils/logger');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

/**
 * Generate access token
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Generate refresh token
 * @param {Object} payload - Token payload
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    logger.error('JWT verification error:', error);
    throw error;
  }
};

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object} Decoded token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    logger.error('JWT refresh verification error:', error);
    throw error;
  }
};

/**
 * Store token in Redis blacklist (for logout)
 * @param {string} token - JWT token to blacklist
 * @param {number} exp - Expiration time in seconds
 * @returns {Promise<void>}
 */
const blacklistToken = async (token, exp) => {
  try {
    const redisClient = getRedisClient();
    const tokenExp = exp - Math.floor(Date.now() / 1000);
    await redisClient.set(`bl_${token}`, 'blacklisted', { EX: tokenExp });
  } catch (error) {
    logger.error('Error blacklisting token:', error);
    throw error;
  }
};

/**
 * Check if token is blacklisted
 * @param {string} token - JWT token to check
 * @returns {Promise<boolean>} True if blacklisted
 */
const isTokenBlacklisted = async (token) => {
  try {
    const redisClient = getRedisClient();
    const result = await redisClient.get(`bl_${token}`);
    return result !== null;
  } catch (error) {
    logger.error('Error checking blacklisted token:', error);
    throw error;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  blacklistToken,
  isTokenBlacklisted,
};