require('dotenv').config();
const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const {
  setupSocketIO
} = require('./websockets/socket');
const {
  connectToMongoDB
} = require('./config/database');
const {
  connectToRedis
} = require('./config/redis');

// Create HTTP server
const server = http.createServer(app);

// WebSocket setup
setupSocketIO(server);

// Get port from environment and store in Express
const port = process.env.PORT || 3000;
app.set('port', port);

// Connect to MongoDB
connectToMongoDB().then(() => {
  logger.info('MongoDB connection established');

  // Connect to Redis
  return connectToRedis();
}).then(() => {
  logger.info('Redis connection established');

  // Start the server
  server.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
}).catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  logger.error('Unhandled rejection:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});