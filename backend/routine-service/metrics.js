const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: process.env.SERVICE_NAME || 'fitmanager-service'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [1, 5, 15, 50, 100, 200, 300, 400, 500, 1000, 2000, 5000]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestErrors = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'status_code']
});

const serviceUptime = new client.Gauge({
  name: 'service_uptime_seconds',
  help: 'Service uptime in seconds'
});

const serviceStatus = new client.Gauge({
  name: 'service_up',
  help: 'Service status (1 = up, 0 = down)'
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(httpRequestErrors);
register.registerMetric(serviceUptime);
register.registerMetric(serviceStatus);

// Set service as up when metrics are initialized
serviceStatus.set(1);

// Update uptime every 10 seconds
const startTime = Date.now();
setInterval(() => {
  serviceUptime.set((Date.now() - startTime) / 1000);
}, 10000);

// Middleware function to collect HTTP metrics
const collectHttpMetrics = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();
    
    // Record metrics
    httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      duration
    );
    
    httpRequestTotal.inc({ method, route, status_code: statusCode });
    
    // Count errors (4xx and 5xx status codes)
    if (res.statusCode >= 400) {
      httpRequestErrors.inc({ method, route, status_code: statusCode });
    }
  });
  
  next();
};

// Metrics endpoint
const metricsEndpoint = async (req, res) => {
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
};

module.exports = {
  register,
  collectHttpMetrics,
  metricsEndpoint,
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    httpRequestErrors,
    serviceUptime,
    serviceStatus
  }
};
