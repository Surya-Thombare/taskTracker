const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { status: httpStatus } = require('http-status');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const groupRoutes = require('./routes/group.routes');
const taskRoutes = require('./routes/task.routes');
const timerRoutes = require('./routes/timer.routes');

const allowedOrigins = [
  'http://localhost:3000',
  'https://task-tracker-frontend-ruby.vercel.app'
];

// Import middleware
const { errorHandler, errorConverter } = require('./middleware/error.middleware');
const { xssSanitizer } = require('./middleware/validation.middleware');

// Create Express app
const app = express();

// Set security HTTP headers
app.use(helmet());

// Parse JSON request body
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded request body
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// XSS Sanitization middleware
app.use(xssSanitizer);

// Enable CORS
app.use(cors({
  origin: allowedOrigins,
}));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));


// Compress responses
app.use(compression());

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later',
});
app.use('/api', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(httpStatus.OK).send({ status: 'ok' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/timers', timerRoutes);

// 404 error handling
app.use((req, res, next) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Error handling middleware
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;