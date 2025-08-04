const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const winston = require('winston');
const compression = require('compression');
const http = require('http');
const socketIo = require('socket.io');
const { collectHttpMetrics, metricsEndpoint } = require('./metrics');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:8081',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    methods: ['GET', 'POST'],
  },
});

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console(),
  ],
});

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8081',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(compression());
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// JSON parsing middleware
app.use(express.json());

// Metrics middleware
app.use(collectHttpMetrics);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'api-gateway',
    message: 'FitManager360 API Gateway is running',
    endpoints: ['/health', '/auth', '/routines', '/chat', '/stats', '/metrics'],
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'API Gateway is running' });
});

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// Service configurations
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'https://fitmanager-auth.onrender.com',
  routines:
    process.env.ROUTINE_SERVICE_URL ||
    'https://fitmanager-routine.onrender.com',
  chat: process.env.CHAT_SERVICE_URL || 'https://fitmanager-chat.onrender.com',
  stats:
    process.env.STATS_SERVICE_URL || 'https://fitmanager-stats.onrender.com',
};

// Generic proxy function - FIXED VERSION
const proxyRequest = async (req, res, serviceUrl, serviceName) => {
  try {
    console.log(
      `[${serviceName}] Incoming request: ${req.method} ${req.originalUrl}`
    );
    console.log(`[${serviceName}] Request body:`, req.body);

    let targetPath;

    // Usar req.url si fue modificada (por ejemplo, para admin), si no usar originalUrl
    const effectiveUrl = req.url || req.originalUrl;

    // Special handling for auth service - remove /auth prefix completely
    if (serviceName === 'auth') {
      if (effectiveUrl.includes(`/api/auth/`)) {
        // /api/auth/login -> /login
        targetPath = effectiveUrl.replace('/api/auth', '');
      } else if (effectiveUrl === '/api/auth') {
        // /api/auth -> / (root)
        targetPath = '/';
      }
    } else if (serviceName === 'chat') {
      // Elimina '/api/chat' sin agregar prefijos adicionales
      if (effectiveUrl.includes(`/api/chat/`)) {
        const remainingPath = effectiveUrl.split(`/api/chat/`)[1];
        targetPath = `/${remainingPath}`; // 🔧 sin /chat extra
      } else if (effectiveUrl === `/api/chat`) {
        targetPath = '/';
      }
    } else if (serviceName === 'stats') {
      // Para stats service, eliminar el prefijo /api/stats completamente
      if (effectiveUrl.includes(`/api/stats/`)) {
        // /api/stats/body-metrics -> /body-metrics
        const remainingPath = effectiveUrl.split(`/api/stats/`)[1];
        targetPath = `/${remainingPath}`;
      } else if (effectiveUrl === '/api/stats') {
        // /api/stats -> / (root)
        targetPath = '/';
      }
    } else {
      // For other services, keep the service name in the path
      targetPath = effectiveUrl.replace(
        `/api/${serviceName}`,
        `/${serviceName}`
      );

      if (effectiveUrl.includes(`/api/${serviceName}/`)) {
        // Extract everything after `/api/${serviceName}/`
        const remainingPath = effectiveUrl.split(`/api/${serviceName}/`)[1];
        targetPath = `/${serviceName}/${remainingPath}`;
      } else if (effectiveUrl === `/api/${serviceName}`) {
        // Exact match for `/api/serviceName` -> `/${serviceName}`
        targetPath = `/${serviceName}`;
      }
    }

    const url = serviceUrl + targetPath;

    logger.info(`${serviceName} service request: ${req.method} ${url}`);
    console.log(`[${serviceName}] Final URL: ${url}`);

    // Clean headers to avoid issues with axios
    const cleanHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': req.headers['user-agent'] || 'API Gateway',
      Accept: req.headers['accept'] || 'application/json',
    };
    // Include Authorization header if present
    if (req.headers.authorization) {
      cleanHeaders['Authorization'] = req.headers.authorization;
    }

    // LOGS DETALLADOS PARA DEPURACIÓN
    logger.info(`[DEBUG] req.originalUrl: ${req.originalUrl}`);
    logger.info(`[DEBUG] req.url: ${req.url}`);
    logger.info(`[DEBUG] targetPath: ${targetPath}`);
    logger.info(`[DEBUG] url final: ${url}`);
    logger.info(`[DEBUG] cleanHeaders: ${JSON.stringify(cleanHeaders)}`);

    const config = {
      method: req.method,
      url: url,
      headers: cleanHeaders,
      timeout: 30000,
    };

    // Add body for POST, PUT, PATCH requests
    if (req.body && Object.keys(req.body).length > 0) {
      config.data = req.body;
    }

    const response = await axios(config);

    logger.info(`${serviceName} service response: ${response.status}`);
    console.log(`[${serviceName}] Response status: ${response.status}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`[${serviceName}] Error details:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
    });
    logger.error(`${serviceName} service error:`, error.message);

    if (error.response) {
      console.log(`[${serviceName}] Error response:`, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log(`[${serviceName}] Service unavailable`);
      res.status(503).json({ error: `${serviceName} service unavailable` });
    } else {
      console.log(`[${serviceName}] Internal server error:`, error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// Auth service routes
app.all('/api/auth/*', (req, res) => {
  proxyRequest(req, res, services.auth, 'auth');
});

app.all('/api/auth', (req, res) => {
  proxyRequest(req, res, services.auth, 'auth');
});

// Routines service routes (general)
app.all(/^\/api\/routines(\/.*)?$/, (req, res) => {
  proxyRequest(req, res, services.routines, 'routines');
});

// Exercises service routes (redirige a routine-service)
app.all(/^\/api\/exercises(\/.*)?$/, (req, res) => {
  proxyRequest(req, res, services.routines, 'exercises');
});
// Exercises service routes (redirige a workout-logs)
app.all(/^\/api\/workout-logs(\/.*)?$/, (req, res) => {
  proxyRequest(req, res, services.routines, 'workout-logs');
});

// Chat service routes
app.all('/api/chat/*', (req, res) => {
  proxyRequest(req, res, services.chat, 'chat');
});

app.all('/api/chat', (req, res) => {
  proxyRequest(req, res, services.chat, 'chat');
});

// Stats service routes
app.all(/^\/api\/stats(\/.*)?$/, (req, res) => {
  proxyRequest(req, res, services.stats, 'stats');
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('New client connected');

  socket.on('join_room', (room) => {
    socket.join(room);
    logger.info(`Client joined room: ${room}`);
  });

  socket.on('leave_room', (room) => {
    socket.leave(room);
    logger.info(`Client left room: ${room}`);
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('API Gateway error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});
