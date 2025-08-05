const express = require('express');
const mongoose = require('mongoose');
const Joi = require('joi');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const winston = require('winston');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const cron = require('node-cron');
const { collectHttpMetrics, metricsEndpoint } = require('./metrics');
require('dotenv').config();

const app = express();

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

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8081',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
  })
);
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);
app.use(express.json());

// Metrics middleware
app.use(collectHttpMetrics);

// MongoDB connection
mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/fitmanager_stats',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
);

mongoose.connection.on('connected', () => {
  logger.info('Connected to MongoDB');
  console.log('Stats Service: MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
  console.error('Stats Service: MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  console.warn('Stats Service: MongoDB disconnected');
});

// Body Metrics Schema
const bodyMetricsSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    weight: {
      type: Number,
      required: true,
      min: 20,
      max: 500,
    },
    bodyFat: {
      type: Number,
      min: 0,
      max: 100,
    },
    muscleMass: {
      type: Number,
      min: 0,
    },
    measurements: {
      chest: Number,
      waist: Number,
      hips: Number,
      biceps: Number,
      thigh: Number,
      neck: Number,
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Workout Statistics Schema
const workoutStatsSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    workoutId: {
      type: String,
      required: true,
    },
    routineId: {
      type: String,
      required: true,
    },
    duration: {
      type: Number, // in minutes
      required: true,
    },
    totalVolume: {
      type: Number, // total weight lifted
      default: 0,
    },
    totalReps: {
      type: Number,
      default: 0,
    },
    totalSets: {
      type: Number,
      default: 0,
    },
    exercisesCompleted: {
      type: Number,
      default: 0,
    },
    totalExercises: {
      type: Number,
      default: 0,
    },
    caloriesBurned: {
      type: Number,
      default: 0,
    },
    averageHeartRate: {
      type: Number,
      min: 40,
      max: 220,
    },
    maxHeartRate: {
      type: Number,
      min: 40,
      max: 220,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    muscleGroups: [
      {
        type: String,
        enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio'],
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Personal Records Schema
const personalRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    exerciseId: {
      type: String,
      required: true,
    },
    exerciseName: {
      type: String,
      required: true,
    },
    recordType: {
      type: String,
      enum: ['max_weight', 'max_reps', 'max_duration', 'max_volume'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      enum: ['kg', 'lbs', 'reps', 'seconds', 'minutes'],
      required: true,
    },
    workoutId: {
      type: String,
      required: true,
    },
    achievedAt: {
      type: Date,
      default: Date.now,
    },
    previousRecord: {
      value: Number,
      achievedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Goal Schema
const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'weight_loss',
        'weight_gain',
        'muscle_gain',
        'strength',
        'endurance',
        'flexibility',
        'body_fat',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    targetValue: {
      type: Number,
      required: true,
    },
    currentValue: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      required: true,
    },
    targetDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'paused', 'cancelled'],
      default: 'active',
    },
    completedAt: Date,
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Achievement Schema
const achievementSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'workout_streak',
        'weight_milestone',
        'pr_achievement',
        'goal_completed',
        'consistency',
        'volume_milestone',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    badgeUrl: String,
    points: {
      type: Number,
      default: 0,
    },
    data: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    unlockedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Analytics Summary Schema
const analyticsSummarySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    workoutCount: {
      type: Number,
      default: 0,
    },
    totalDuration: {
      type: Number,
      default: 0,
    },
    totalVolume: {
      type: Number,
      default: 0,
    },
    totalCalories: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    muscleGroupDistribution: {
      type: Map,
      of: Number,
    },
    streakDays: {
      type: Number,
      default: 0,
    },
    personalRecords: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const BodyMetrics = mongoose.model('BodyMetrics', bodyMetricsSchema);
const WorkoutStats = mongoose.model('WorkoutStats', workoutStatsSchema);
const PersonalRecord = mongoose.model('PersonalRecord', personalRecordSchema);
const Goal = mongoose.model('Goal', goalSchema);
const Achievement = mongoose.model('Achievement', achievementSchema);
const AnalyticsSummary = mongoose.model(
  'AnalyticsSummary',
  analyticsSummarySchema
);

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || 'your-secret-key',
    (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }
      req.user = user;
      next();
    }
  );
};

// Validation schemas
const bodyMetricsSchema_validation = Joi.object({
  weight: Joi.number().min(20).max(500).required(),
  bodyFat: Joi.number().min(0).max(100),
  muscleMass: Joi.number().min(0),
  measurements: Joi.object({
    chest: Joi.number().min(0),
    waist: Joi.number().min(0),
    hips: Joi.number().min(0),
    biceps: Joi.number().min(0),
    thigh: Joi.number().min(0),
    neck: Joi.number().min(0),
  }),
  notes: Joi.string().max(500),
});

const workoutStatsSchema_validation = Joi.object({
  workoutId: Joi.string().required(),
  routineId: Joi.string().required(),
  duration: Joi.number().min(1).required(),
  totalVolume: Joi.number().min(0),
  totalReps: Joi.number().min(0),
  totalSets: Joi.number().min(0),
  exercisesCompleted: Joi.number().min(0),
  totalExercises: Joi.number().min(0),
  caloriesBurned: Joi.number().min(0),
  averageHeartRate: Joi.number().min(40).max(220),
  maxHeartRate: Joi.number().min(40).max(220),
  rating: Joi.number().min(1).max(5),
  muscleGroups: Joi.array().items(
    Joi.string().valid(
      'chest',
      'back',
      'shoulders',
      'arms',
      'legs',
      'core',
      'cardio'
    )
  ),
});

const goalSchema_validation = Joi.object({
  type: Joi.string()
    .valid(
      'weight_loss',
      'weight_gain',
      'muscle_gain',
      'strength',
      'endurance',
      'flexibility',
      'body_fat'
    )
    .required(),
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500),
  targetValue: Joi.number().required(),
  currentValue: Joi.number().default(0),
  unit: Joi.string().required(),
  targetDate: Joi.date().required(),
});

// Routes

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'stats-service' });
});

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// Body Metrics routes
app.get('/body-metrics', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, limit = 50 } = req.query;
    const filter = { userId: req.user.id };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const metrics = await BodyMetrics.find(filter)
      .limit(limit * 1)
      .sort({ createdAt: -1 });

    res.json({ metrics });
  } catch (error) {
    logger.error('Get body metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/body-metrics', authenticateToken, async (req, res) => {
  try {
    const { error } = bodyMetricsSchema_validation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const metrics = new BodyMetrics({
      ...req.body,
      userId: req.user.id,
    });

    await metrics.save();

    logger.info(`Body metrics recorded for user ${req.user.id}`);
    res.status(201).json(metrics);
  } catch (error) {
    logger.error('Create body metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Workout Stats routes
app.post('/workout-stats', authenticateToken, async (req, res) => {
  try {
    const { error } = workoutStatsSchema_validation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const stats = new WorkoutStats({
      ...req.body,
      userId: req.user.id,
      date: new Date(),
    });

    await stats.save();

    // Check for new personal records
    await checkPersonalRecords(req.user.id, req.body);

    // Update analytics summary
    await updateAnalyticsSummary(req.user.id, stats);

    logger.info(`Workout stats recorded for user ${req.user.id}`);
    res.status(201).json(stats);
  } catch (error) {
    logger.error('Create workout stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard summary
app.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const startOfWeek = moment().startOf('week').toDate();
    const startOfMonth = moment().startOf('month').toDate();

    // Get recent body metrics
    const latestMetrics = await BodyMetrics.findOne({ userId }).sort({
      createdAt: -1,
    });

    // Get week stats
    const weekStats = await WorkoutStats.aggregate([
      { $match: { userId, date: { $gte: startOfWeek } } },
      {
        $group: {
          _id: null,
          totalWorkouts: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          totalVolume: { $sum: '$totalVolume' },
          totalCalories: { $sum: '$caloriesBurned' },
          averageRating: { $avg: '$rating' },
        },
      },
    ]);

    // Get month stats
    const monthStats = await WorkoutStats.aggregate([
      { $match: { userId, date: { $gte: startOfMonth } } },
      {
        $group: {
          _id: null,
          totalWorkouts: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          totalVolume: { $sum: '$totalVolume' },
          totalCalories: { $sum: '$caloriesBurned' },
        },
      },
    ]);

    // Get recent achievements
    const recentAchievements = await Achievement.find({ userId })
      .sort({ unlockedAt: -1 })
      .limit(5);

    // Get active goals
    const activeGoals = await Goal.find({ userId, status: 'active' }).sort({
      targetDate: 1,
    });

    // Get recent personal records
    const recentPRs = await PersonalRecord.find({ userId })
      .sort({ achievedAt: -1 })
      .limit(5);

    // Calculate workout streak
    const workoutStreak = await calculateWorkoutStreak(userId);

    res.json({
      currentMetrics: latestMetrics,
      weekStats: weekStats[0] || {},
      monthStats: monthStats[0] || {},
      recentAchievements,
      activeGoals,
      recentPRs,
      workoutStreak,
    });
  } catch (error) {
    logger.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Progress charts
app.get('/progress/:metric', authenticateToken, async (req, res) => {
  try {
    const { metric } = req.params;
    const { period = 'weekly', limit = 12 } = req.query;
    const userId = req.user.id;

    let data = [];

    switch (metric) {
      case 'weight':
        data = await BodyMetrics.find({ userId })
          .select('weight createdAt')
          .sort({ createdAt: -1 })
          .limit(limit * 1);
        break;

      case 'volume':
        data = await getVolumeProgress(userId, period, limit);
        break;

      case 'duration':
        data = await getDurationProgress(userId, period, limit);
        break;

      case 'calories':
        data = await getCaloriesProgress(userId, period, limit);
        break;

      default:
        return res.status(400).json({ error: 'Invalid metric' });
    }

    res.json({ data });
  } catch (error) {
    logger.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Goals routes
app.get('/goals', authenticateToken, async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const goals = await Goal.find({
      userId: req.user.id,
      status,
    }).sort({ targetDate: 1 });

    res.json({ goals });
  } catch (error) {
    logger.error('Get goals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/goals', authenticateToken, async (req, res) => {
  try {
    const { error } = goalSchema_validation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const goal = new Goal({
      ...req.body,
      userId: req.user.id,
    });

    await goal.save();

    logger.info(`Goal created for user ${req.user.id}: ${goal.title}`);
    res.status(201).json(goal);
  } catch (error) {
    logger.error('Create goal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/goals/:id', authenticateToken, async (req, res) => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Check if goal is completed
    if (goal.currentValue >= goal.targetValue && goal.status === 'active') {
      goal.status = 'completed';
      goal.completedAt = new Date();
      goal.progress = 100;
      await goal.save();

      // Create achievement
      await createAchievement(req.user.id, 'goal_completed', {
        title: `Goal Achieved: ${goal.title}`,
        description: `Successfully completed the goal: ${goal.title}`,
        goalId: goal._id,
        goalType: goal.type,
      });
    }

    res.json(goal);
  } catch (error) {
    logger.error('Update goal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Personal Records routes
app.get('/personal-records', authenticateToken, async (req, res) => {
  try {
    const { exerciseId, recordType } = req.query;
    const filter = { userId: req.user.id };

    if (exerciseId) filter.exerciseId = exerciseId;
    if (recordType) filter.recordType = recordType;

    const records = await PersonalRecord.find(filter).sort({ achievedAt: -1 });

    res.json({ records });
  } catch (error) {
    logger.error('Get personal records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Achievements routes
app.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const achievements = await Achievement.find({ userId: req.user.id }).sort({
      unlockedAt: -1,
    });

    res.json({ achievements });
  } catch (error) {
    logger.error('Get achievements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
async function checkPersonalRecords(userId, workoutData) {
  // Implementation would check for new personal records
  // This is a simplified version
  logger.info(`Checking personal records for user ${userId}`);
}

async function updateAnalyticsSummary(userId, stats) {
  const today = moment().startOf('day').toDate();

  await AnalyticsSummary.findOneAndUpdate(
    { userId, period: 'daily', date: today },
    {
      $inc: {
        workoutCount: 1,
        totalDuration: stats.duration,
        totalVolume: stats.totalVolume,
        totalCalories: stats.caloriesBurned,
      },
      $set: {
        averageRating: stats.rating,
      },
    },
    { upsert: true }
  );
}

async function calculateWorkoutStreak(userId) {
  const workouts = await WorkoutStats.find({ userId })
    .sort({ date: -1 })
    .select('date');

  let streak = 0;
  let currentDate = moment().startOf('day');

  for (const workout of workouts) {
    const workoutDate = moment(workout.date).startOf('day');

    if (
      workoutDate.isSame(currentDate) ||
      workoutDate.isSame(currentDate.clone().subtract(1, 'day'))
    ) {
      streak++;
      currentDate = workoutDate;
    } else {
      break;
    }
  }

  return streak;
}

async function getVolumeProgress(userId, period, limit) {
  const groupBy =
    period === 'weekly'
      ? { $dateToString: { format: '%Y-%U', date: '$date' } }
      : { $dateToString: { format: '%Y-%m', date: '$date' } };

  return await WorkoutStats.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: groupBy,
        totalVolume: { $sum: '$totalVolume' },
        date: { $first: '$date' },
      },
    },
    { $sort: { date: -1 } },
    { $limit: limit },
  ]);
}

async function getDurationProgress(userId, period, limit) {
  const groupBy =
    period === 'weekly'
      ? { $dateToString: { format: '%Y-%U', date: '$date' } }
      : { $dateToString: { format: '%Y-%m', date: '$date' } };

  return await WorkoutStats.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: groupBy,
        totalDuration: { $sum: '$duration' },
        date: { $first: '$date' },
      },
    },
    { $sort: { date: -1 } },
    { $limit: limit },
  ]);
}

async function getCaloriesProgress(userId, period, limit) {
  const groupBy =
    period === 'weekly'
      ? { $dateToString: { format: '%Y-%U', date: '$date' } }
      : { $dateToString: { format: '%Y-%m', date: '$date' } };

  return await WorkoutStats.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: groupBy,
        totalCalories: { $sum: '$caloriesBurned' },
        date: { $first: '$date' },
      },
    },
    { $sort: { date: -1 } },
    { $limit: limit },
  ]);
}

async function createAchievement(userId, type, data) {
  const achievement = new Achievement({
    userId,
    type,
    title: data.title,
    description: data.description,
    points: data.points || 10,
    data: data,
  });

  await achievement.save();
  logger.info(`Achievement unlocked for user ${userId}: ${data.title}`);
}

// Scheduled tasks
cron.schedule('0 0 * * *', async () => {
  logger.info('Running daily analytics summary task');
  // Update daily, weekly, monthly summaries
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3004;

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Stats Service running on port ${PORT}`);
  });
}

module.exports = app;
