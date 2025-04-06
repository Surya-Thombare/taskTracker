const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB
 * @returns {Promise<void>}
 */
const connectToMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tasktrack';
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true
    };
    await mongoose.connect(mongoURI, options);

    // Log successful connection
    logger.info('Connected to MongoDB');

    // Handle MongoDB connection errors after initial connection
    mongoose.connection.on('error', err => {
      logger.error('MongoDB connection error:', err);
    });

    // Handle MongoDB disconnection
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Handle MongoDB reconnection
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Gracefully close MongoDB connection on app termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed due to app termination');
        process.exit(0);
      } catch (err) {
        logger.error('Error closing MongoDB connection:', err);
        process.exit(1);
      }
    });
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    throw err;
  }
};
module.exports = {
  connectToMongoDB
};