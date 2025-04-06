const {
  createClient
} = require('redis');
const logger = require('../utils/logger');
let redisClient = null;

/**
 * Connect to Redis
 * @returns {Promise<void>}
 */
const connectToRedis = async () => {
  try {
    // Configure Redis client
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || 6379;
    const redisPassword = process.env.REDIS_PASSWORD || '';
    const url = redisPassword ? `redis://:${redisPassword}@${redisHost}:${redisPort}` : `redis://${redisHost}:${redisPort}`;
    redisClient = createClient({
      url,
      socket: {
        reconnectStrategy: retries => {
          // Exponential backoff with a maximum delay of 10 seconds
          const delay = Math.min(Math.pow(2, retries) * 100, 10000);
          logger.info(`Redis reconnecting in ${delay}ms...`);
          return delay;
        }
      }
    });

    // Redis event listeners
    redisClient.on('connect', () => {
      logger.info('Redis client connecting');
    });
    redisClient.on('ready', () => {
      logger.info('Redis client connected and ready');
    });
    redisClient.on('error', err => {
      logger.error('Redis client error:', err);
    });
    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });
    redisClient.on('end', () => {
      logger.warn('Redis client connection closed');
    });

    // Connect to Redis
    await redisClient.connect();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      if (redisClient) {
        await redisClient.quit();
        logger.info('Redis connection closed due to app termination');
      }
    });
    return redisClient;
  } catch (err) {
    logger.error('Redis connection error:', err);
    throw err;
  }
};

/**
 * Get Redis client
 * @returns {RedisClient} Redis client
 */
const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};
module.exports = {
  connectToRedis,
  getRedisClient
};