const express = require('express');
const mongoose = require('mongoose');
const Joi = require('joi');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const winston = require('winston');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
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

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', apiLimiter);

// MongoDB connection
mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/fitmanager_routines',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
);

mongoose.connection.on('connected', () => {
  logger.info('Connected to MongoDB');
  console.log('Routine Service: MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
  console.error('Routine Service: MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  console.warn('Routine Service: MongoDB disconnected');
});

// Exercise Schema
const exerciseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    muscleGroups: [
      {
        type: String,
        enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio'],
      },
    ],
    equipment: [
      {
        type: String,
        enum: [
          'bodyweight',
          'dumbbells',
          'barbell',
          'machine',
          'cable',
          'resistance_band',
          'kettlebell',
        ],
      },
    ],
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    instructions: [String],
    tips: [String],
    imageUrl: String,
    videoUrl: String,
  },
  {
    timestamps: true,
  }
);

// Workout Exercise Schema (for routine exercises with sets/reps)
const workoutExerciseSchema = new mongoose.Schema({
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true,
  },
  sets: [
    {
      reps: Number,
      weight: Number,
      duration: Number, // in seconds
      rest: Number, // rest time in seconds
      completed: {
        type: Boolean,
        default: false,
      },
    },
  ],
  notes: String,
  order: {
    type: Number,
    default: 0,
  },
});

// Routine Schema
const routineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    exercises: [workoutExerciseSchema],
    tags: [String],
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    estimatedDuration: {
      type: Number, // in minutes
      default: 30,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      enum: [
        'strength',
        'cardio',
        'flexibility',
        'sports',
        'rehabilitation',
        'weight_loss',
        'muscle_gain',
      ],
      default: 'strength',
    },
    equipment: [
      {
        type: String,
        enum: [
          'bodyweight',
          'dumbbells',
          'barbell',
          'machine',
          'cable',
          'resistance_band',
          'kettlebell',
        ],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Workout Log Schema
const workoutLogSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    routine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Routine',
      required: true,
    },
    exercises: [
      {
        exercise: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Exercise',
          required: true,
        },
        sets: [
          {
            reps: Number,
            weight: Number,
            duration: Number,
            rest: Number,
            completed: Boolean,
          },
        ],
        notes: String,
      },
    ],
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: Date,
    duration: Number, // in minutes
    notes: String,
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
  },
  {
    timestamps: true,
  }
);

const Exercise = mongoose.model('Exercise', exerciseSchema);
const Routine = mongoose.model('Routine', routineSchema);
const WorkoutLog = mongoose.model('WorkoutLog', workoutLogSchema);

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
const routineSchema_validation = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500),
  exercises: Joi.array().items(
    Joi.object({
      exercise: Joi.string().required(),
      sets: Joi.array().items(
        Joi.object({
          reps: Joi.number().min(1).max(1000),
          weight: Joi.number().min(0).max(1000),
          duration: Joi.number().min(1).max(3600),
          rest: Joi.number().min(0).max(600),
        })
      ),
      notes: Joi.string().max(500),
      order: Joi.number().min(0),
    })
  ),
  tags: Joi.array().items(Joi.string()),
  difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced'),
  estimatedDuration: Joi.number().min(1).max(480),
  isPublic: Joi.boolean(),
  category: Joi.string().valid(
    'strength',
    'cardio',
    'flexibility',
    'sports',
    'rehabilitation',
    'weight_loss',
    'muscle_gain'
  ),
  equipment: Joi.array().items(
    Joi.string().valid(
      'bodyweight',
      'dumbbells',
      'barbell',
      'machine',
      'cable',
      'resistance_band',
      'kettlebell'
    )
  ),
});

const exerciseSchema_validation = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500),
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
  equipment: Joi.array().items(
    Joi.string().valid(
      'bodyweight',
      'dumbbells',
      'barbell',
      'machine',
      'cable',
      'resistance_band',
      'kettlebell'
    )
  ),
  difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced'),
  instructions: Joi.array().items(Joi.string()),
  tips: Joi.array().items(Joi.string()),
  imageUrl: Joi.string().uri(),
  videoUrl: Joi.string().uri(),
});

const workoutLogSchema_validation = Joi.object({
  routine: Joi.string().required(),
  exercises: Joi.array().items(
    Joi.object({
      exercise: Joi.string().required(),
      sets: Joi.array().items(
        Joi.object({
          reps: Joi.number().min(1).max(1000),
          weight: Joi.number().min(0).max(1000),
          duration: Joi.number().min(1).max(3600),
          rest: Joi.number().min(0).max(600),
          completed: Joi.boolean(),
        })
      ),
      notes: Joi.string().max(500),
    })
  ),
  endTime: Joi.date(),
  duration: Joi.number().min(1).max(480),
  notes: Joi.string().max(500),
  rating: Joi.number().min(1).max(5),
});

// Routes

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'routine-service' });
});

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// Exercise routes
// Estadísticas de ejercicios (debe ir antes que /exercises/:id)
app.get('/exercises/stats', authenticateToken, async (req, res) => {
  try {
    // Estadísticas generales
    const totalExercises = await Exercise.countDocuments();

    // Ejercicios por grupo muscular (ignorar vacíos/nulos)
    const muscleGroupStats = await Exercise.aggregate([
      { $match: { muscleGroups: { $exists: true, $ne: [] } } },
      { $unwind: '$muscleGroups' },
      { $match: { muscleGroups: { $ne: null, $ne: '' } } },
      { $group: { _id: '$muscleGroups', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Ejercicios por dificultad (ignorar vacíos/nulos)
    const difficultyStats = await Exercise.aggregate([
      { $match: { difficulty: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Ejercicios por equipo (ignorar vacíos/nulos)
    const equipmentStats = await Exercise.aggregate([
      { $match: { equipment: { $exists: true, $ne: [] } } },
      { $unwind: '$equipment' },
      { $match: { equipment: { $ne: null, $ne: '' } } },
      { $group: { _id: '$equipment', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Ejercicios más recientes (ignorar los que no tengan nombre)
    const recentExercises = await Exercise.find({
      name: { $exists: true, $ne: null, $ne: '' },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name difficulty muscleGroups createdAt');

    res.json({
      totalExercises,
      stats: {
        byMuscleGroup: muscleGroupStats,
        byDifficulty: difficultyStats,
        byEquipment: equipmentStats,
      },
      recentExercises,
    });
  } catch (error) {
    logger.error('Admin exercise stats error:', error);
    // Log detallado para depuración
    if (error && error.stack) {
      console.error('STACK TRACE:', error.stack);
    }
    if (error && error.message) {
      console.error('ERROR MESSAGE:', error.message);
    }
    res
      .status(500)
      .json({ error: 'Internal server error', details: error.message });
  }
});
// ...existing code...
app.get('/exercises', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      muscleGroup,
      equipment,
      difficulty,
      search,
    } = req.query;
    const filter = {};

    if (muscleGroup) filter.muscleGroups = muscleGroup;
    if (equipment) filter.equipment = equipment;
    if (difficulty) filter.difficulty = difficulty;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const exercises = await Exercise.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Exercise.countDocuments(filter);

    res.json({
      exercises,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    logger.error('Get exercises error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/exercises/:id', authenticateToken, async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    res.json(exercise);
  } catch (error) {
    logger.error('Get exercise error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/exercises', authenticateToken, async (req, res) => {
  try {
    const { error } = exerciseSchema_validation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const exercise = new Exercise(req.body);
    await exercise.save();

    logger.info(`Exercise created: ${exercise.name} by user ${req.user.id}`);
    res.status(201).json(exercise);
  } catch (error) {
    logger.error('Create exercise error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk create exercises (for seeding)
app.post('/exercises/bulk', authenticateToken, async (req, res) => {
  try {
    if (!Array.isArray(req.body.exercises)) {
      return res.status(400).json({ error: 'exercises must be an array' });
    }

    const exercises = [];
    for (const exerciseData of req.body.exercises) {
      const { error } = exerciseSchema_validation.validate(exerciseData);
      if (error) {
        return res.status(400).json({ 
          error: `Validation error for exercise "${exerciseData.name}": ${error.details[0].message}` 
        });
      }
      exercises.push(exerciseData);
    }

    const createdExercises = await Exercise.insertMany(exercises);
    logger.info(`Bulk created ${createdExercises.length} exercises`);
    
    res.status(201).json({
      message: `Successfully created ${createdExercises.length} exercises`,
      exercises: createdExercises
    });
  } catch (error) {
    logger.error('Bulk create exercises error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Seed default exercises
app.post('/exercises/seed', authenticateToken, async (req, res) => {
  try {
    // Check if exercises already exist
    const existingCount = await Exercise.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({ 
        error: 'Exercises already exist in database',
        count: existingCount 
      });
    }

    const defaultExercises = [
      // Chest exercises
      {
        name: 'Press de Banca',
        description: 'Ejercicio fundamental para el desarrollo del pecho, realizado acostado en un banco con barra.',
        muscleGroups: ['chest'],
        equipment: ['barbell'],
        difficulty: 'intermediate',
        instructions: [
          'Acuéstate en el banco con los pies firmes en el suelo',
          'Agarra la barra con las manos separadas al ancho de los hombros',
          'Baja la barra controladamente hasta el pecho',
          'Empuja la barra hacia arriba hasta extender completamente los brazos'
        ],
        tips: [
          'Mantén los omóplatos retraídos',
          'No rebotes la barra en el pecho',
          'Controla la respiración: inhala al bajar, exhala al subir'
        ]
      },
      {
        name: 'Flexiones de Pecho',
        description: 'Ejercicio básico de peso corporal para fortalecer pecho, hombros y tríceps.',
        muscleGroups: ['chest', 'arms'],
        equipment: ['bodyweight'],
        difficulty: 'beginner',
        instructions: [
          'Colócate en posición de plancha con las manos al ancho de los hombros',
          'Mantén el cuerpo recto desde la cabeza hasta los pies',
          'Baja el cuerpo hasta que el pecho casi toque el suelo',
          'Empuja hacia arriba hasta la posición inicial'
        ],
        tips: [
          'Mantén el core activado',
          'No dejes caer las caderas',
          'Controla el movimiento en ambas fases'
        ]
      },
      {
        name: 'Aperturas con Mancuernas',
        description: 'Ejercicio de aislamiento para el pecho usando mancuernas.',
        muscleGroups: ['chest'],
        equipment: ['dumbbells'],
        difficulty: 'intermediate',
        instructions: [
          'Acuéstate en un banco con una mancuerna en cada mano',
          'Extiende los brazos hacia arriba con las palmas enfrentadas',
          'Baja las mancuernas en arco amplio hasta sentir estiramiento en el pecho',
          'Regresa a la posición inicial contrayendo el pecho'
        ],
        tips: [
          'Mantén una ligera flexión en los codos',
          'Controla el peso en todo el rango de movimiento',
          'No bajes demasiado para evitar lesiones'
        ]
      },

      // Back exercises
      {
        name: 'Dominadas',
        description: 'Ejercicio de peso corporal para desarrollar la espalda y bíceps.',
        muscleGroups: ['back', 'arms'],
        equipment: ['bodyweight'],
        difficulty: 'advanced',
        instructions: [
          'Cuelga de una barra con agarre pronado, manos al ancho de los hombros',
          'Activa el core y mantén las piernas ligeramente flexionadas',
          'Tira del cuerpo hacia arriba hasta que la barbilla pase la barra',
          'Baja controladamente hasta la posición inicial'
        ],
        tips: [
          'Evita balancearte',
          'Inicia el movimiento con los músculos de la espalda',
          'Si no puedes hacer dominadas completas, usa bandas de resistencia'
        ]
      },
      {
        name: 'Remo con Barra',
        description: 'Ejercicio compuesto para desarrollar la espalda media y baja.',
        muscleGroups: ['back'],
        equipment: ['barbell'],
        difficulty: 'intermediate',
        instructions: [
          'De pie con los pies al ancho de los hombros, sostén la barra',
          'Inclínate hacia adelante manteniendo la espalda recta',
          'Tira de la barra hacia el abdomen bajo',
          'Baja la barra controladamente'
        ],
        tips: [
          'Mantén el core activado',
          'No uses impulso',
          'Aprieta los omóplatos al tirar'
        ]
      },
      {
        name: 'Jalones al Pecho',
        description: 'Ejercicio en máquina para desarrollar el dorsal ancho.',
        muscleGroups: ['back'],
        equipment: ['machine'],
        difficulty: 'beginner',
        instructions: [
          'Siéntate en la máquina con los muslos asegurados',
          'Agarra la barra con agarre amplio',
          'Tira de la barra hacia el pecho superior',
          'Regresa controladamente a la posición inicial'
        ],
        tips: [
          'Inclínate ligeramente hacia atrás',
          'Enfócate en usar los músculos de la espalda',
          'No uses impulso'
        ]
      },

      // Leg exercises
      {
        name: 'Sentadillas',
        description: 'Ejercicio fundamental para el desarrollo de las piernas y glúteos.',
        muscleGroups: ['legs'],
        equipment: ['bodyweight'],
        difficulty: 'beginner',
        instructions: [
          'De pie con los pies al ancho de los hombros',
          'Baja como si fueras a sentarte en una silla',
          'Mantén el pecho erguido y las rodillas alineadas con los pies',
          'Baja hasta que los muslos estén paralelos al suelo',
          'Empuja a través de los talones para volver arriba'
        ],
        tips: [
          'Mantén el peso en los talones',
          'No dejes que las rodillas se vayan hacia adentro',
          'Mantén el core activado'
        ]
      },
      {
        name: 'Peso Muerto',
        description: 'Ejercicio compuesto que trabaja toda la cadena posterior.',
        muscleGroups: ['legs', 'back'],
        equipment: ['barbell'],
        difficulty: 'advanced',
        instructions: [
          'De pie con la barra frente a ti, pies al ancho de caderas',
          'Agáchate y agarra la barra con las manos al ancho de los hombros',
          'Mantén la espalda recta y levanta la barra extendiendo caderas y rodillas',
          'Termina de pie con los hombros hacia atrás'
        ],
        tips: [
          'Mantén la barra cerca del cuerpo',
          'No redondees la espalda',
          'Inicia el movimiento con las caderas'
        ]
      },
      {
        name: 'Zancadas',
        description: 'Ejercicio unilateral para piernas y glúteos.',
        muscleGroups: ['legs'],
        equipment: ['bodyweight'],
        difficulty: 'beginner',
        instructions: [
          'De pie con los pies juntos',
          'Da un paso largo hacia adelante',
          'Baja hasta que ambas rodillas estén a 90 grados',
          'Empuja con la pierna delantera para volver a la posición inicial'
        ],
        tips: [
          'Mantén el torso erguido',
          'No dejes que la rodilla delantera pase los dedos del pie',
          'Alterna las piernas'
        ]
      },

      // Shoulder exercises
      {
        name: 'Press Militar',
        description: 'Ejercicio para desarrollar los hombros y core.',
        muscleGroups: ['shoulders'],
        equipment: ['barbell'],
        difficulty: 'intermediate',
        instructions: [
          'De pie con los pies al ancho de los hombros',
          'Sostén la barra a la altura de los hombros',
          'Empuja la barra directamente hacia arriba',
          'Baja controladamente a la posición inicial'
        ],
        tips: [
          'Mantén el core activado',
          'No arquees excesivamente la espalda',
          'Empuja la cabeza ligeramente hacia adelante al final del movimiento'
        ]
      },
      {
        name: 'Elevaciones Laterales',
        description: 'Ejercicio de aislamiento para el deltoides medio.',
        muscleGroups: ['shoulders'],
        equipment: ['dumbbells'],
        difficulty: 'beginner',
        instructions: [
          'De pie con una mancuerna en cada mano a los lados',
          'Levanta los brazos hacia los lados hasta la altura de los hombros',
          'Mantén una ligera flexión en los codos',
          'Baja controladamente'
        ],
        tips: [
          'No uses impulso',
          'Mantén los hombros hacia abajo',
          'Controla el movimiento en ambas direcciones'
        ]
      },

      // Arm exercises
      {
        name: 'Curl de Bíceps',
        description: 'Ejercicio básico para el desarrollo de los bíceps.',
        muscleGroups: ['arms'],
        equipment: ['dumbbells'],
        difficulty: 'beginner',
        instructions: [
          'De pie con una mancuerna en cada mano, brazos a los lados',
          'Mantén los codos pegados al torso',
          'Flexiona los brazos llevando las mancuernas hacia los hombros',
          'Baja controladamente'
        ],
        tips: [
          'No balancees el cuerpo',
          'Mantén los codos fijos',
          'Controla la fase excéntrica'
        ]
      },
      {
        name: 'Extensiones de Tríceps',
        description: 'Ejercicio para desarrollar la parte posterior de los brazos.',
        muscleGroups: ['arms'],
        equipment: ['dumbbells'],
        difficulty: 'beginner',
        instructions: [
          'Acostado en un banco, sostén una mancuerna con ambas manos sobre el pecho',
          'Baja la mancuerna detrás de la cabeza flexionando solo los codos',
          'Extiende los brazos para volver a la posición inicial'
        ],
        tips: [
          'Mantén los codos fijos',
          'No uses peso excesivo',
          'Controla el movimiento'
        ]
      },
      {
        name: 'Fondos en Paralelas',
        description: 'Ejercicio de peso corporal para tríceps y pecho inferior.',
        muscleGroups: ['arms', 'chest'],
        equipment: ['bodyweight'],
        difficulty: 'intermediate',
        instructions: [
          'Sujétate en las barras paralelas con los brazos extendidos',
          'Baja el cuerpo flexionando los codos',
          'Empuja hacia arriba hasta extender completamente los brazos'
        ],
        tips: [
          'Mantén el cuerpo ligeramente inclinado hacia adelante',
          'No bajes demasiado para evitar lesiones en los hombros',
          'Controla el movimiento'
        ]
      },

      // Core exercises
      {
        name: 'Plancha',
        description: 'Ejercicio isométrico para fortalecer el core.',
        muscleGroups: ['core'],
        equipment: ['bodyweight'],
        difficulty: 'beginner',
        instructions: [
          'Colócate en posición de flexión pero apoyado en los antebrazos',
          'Mantén el cuerpo recto desde la cabeza hasta los pies',
          'Mantén la posición el tiempo indicado',
          'Respira normalmente durante el ejercicio'
        ],
        tips: [
          'No dejes caer las caderas',
          'Mantén el cuello neutro',
          'Aprieta los glúteos y abdominales'
        ]
      },
      {
        name: 'Abdominales Crunch',
        description: 'Ejercicio básico para los músculos abdominales.',
        muscleGroups: ['core'],
        equipment: ['bodyweight'],
        difficulty: 'beginner',
        instructions: [
          'Acuéstate boca arriba con las rodillas flexionadas',
          'Coloca las manos detrás de la cabeza',
          'Levanta los hombros del suelo contrayendo los abdominales',
          'Baja controladamente'
        ],
        tips: [
          'No tires del cuello',
          'Enfócate en la contracción abdominal',
          'Exhala al subir'
        ]
      },
      {
        name: 'Mountain Climbers',
        description: 'Ejercicio dinámico que combina cardio y fortalecimiento del core.',
        muscleGroups: ['core', 'cardio'],
        equipment: ['bodyweight'],
        difficulty: 'intermediate',
        instructions: [
          'Comienza en posición de plancha alta',
          'Lleva una rodilla hacia el pecho',
          'Cambia rápidamente de pierna',
          'Mantén un ritmo constante'
        ],
        tips: [
          'Mantén las caderas estables',
          'No dejes que las caderas suban',
          'Mantén el core activado'
        ]
      },

      // Cardio exercises
      {
        name: 'Burpees',
        description: 'Ejercicio de cuerpo completo que combina fuerza y cardio.',
        muscleGroups: ['cardio'],
        equipment: ['bodyweight'],
        difficulty: 'intermediate',
        instructions: [
          'De pie, baja a posición de cuclillas',
          'Coloca las manos en el suelo y salta los pies hacia atrás',
          'Haz una flexión',
          'Salta los pies hacia adelante y salta hacia arriba'
        ],
        tips: [
          'Mantén un ritmo constante',
          'Modifica el ejercicio si es necesario',
          'Respira de manera controlada'
        ]
      },
      {
        name: 'Jumping Jacks',
        description: 'Ejercicio cardiovascular básico.',
        muscleGroups: ['cardio'],
        equipment: ['bodyweight'],
        difficulty: 'beginner',
        instructions: [
          'De pie con los pies juntos y brazos a los lados',
          'Salta separando los pies y levantando los brazos sobre la cabeza',
          'Salta de nuevo para volver a la posición inicial',
          'Repite de manera continua'
        ],
        tips: [
          'Mantén un ritmo constante',
          'Aterriza suavemente',
          'Mantén el core activado'
        ]
      },

      // Functional exercises
      {
        name: 'Thrusters',
        description: 'Ejercicio funcional que combina sentadilla y press de hombros.',
        muscleGroups: ['legs', 'shoulders'],
        equipment: ['dumbbells'],
        difficulty: 'intermediate',
        instructions: [
          'De pie con mancuernas a la altura de los hombros',
          'Haz una sentadilla completa',
          'Al subir, empuja las mancuernas hacia arriba',
          'Baja las mancuernas mientras bajas a la siguiente sentadilla'
        ],
        tips: [
          'Usa el impulso de las piernas para ayudar con el press',
          'Mantén el core activado',
          'Controla el ritmo'
        ]
      },
      {
        name: 'Kettlebell Swings',
        description: 'Ejercicio dinámico para desarrollar potencia y resistencia.',
        muscleGroups: ['legs', 'back', 'core'],
        equipment: ['kettlebell'],
        difficulty: 'intermediate',
        instructions: [
          'De pie con los pies al ancho de los hombros, kettlebell entre las piernas',
          'Flexiona las caderas y agarra la kettlebell',
          'Impulsa las caderas hacia adelante para balancear la kettlebell',
          'Deja que la kettlebell baje entre las piernas y repite'
        ],
        tips: [
          'El movimiento viene de las caderas, no de los brazos',
          'Mantén la espalda recta',
          'Aprieta los glúteos en la parte superior del movimiento'
        ]
      }
    ];

    const createdExercises = await Exercise.insertMany(defaultExercises);
    logger.info(`Seeded ${createdExercises.length} default exercises`);
    
    res.status(201).json({
      message: `Successfully seeded ${createdExercises.length} exercises`,
      exercises: createdExercises
    });
  } catch (error) {
    logger.error('Seed exercises error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Routine routes
app.get('/routines', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, category, difficulty, isPublic } = req.query;
    const filter = { 
      userId: req.user.id,
      isActive: true 
    };

    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (isPublic !== undefined) filter.isPublic = isPublic === 'true';

    logger.info(`Fetching routines for user: ${req.user.id}, filter:`, filter);

    const routines = await Routine.find(filter)
      .populate('exercises.exercise')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Routine.countDocuments(filter);

    logger.info(`Found ${routines.length} routines for user ${req.user.id}`);

    res.json({
      routines,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    logger.error('Get routines error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/routines/:id', authenticateToken, async (req, res) => {
  try {
    const routine = await Routine.findOne({
      _id: req.params.id,
      $or: [{ userId: req.user.id }, { isPublic: true }],
    }).populate('exercises.exercise');

    if (!routine) {
      return res.status(404).json({ error: 'Routine not found' });
    }

    res.json(routine);
  } catch (error) {
    logger.error('Get routine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/routines', authenticateToken, async (req, res) => {
  try {
    const { error } = routineSchema_validation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const routine = new Routine({
      ...req.body,
      userId: req.user.id,
    });

    await routine.save();
    await routine.populate('exercises.exercise');

    logger.info(`Routine created: ${routine.name} by user ${req.user.id}`);
    res.status(201).json(routine);
  } catch (error) {
    logger.error('Create routine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/routines/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = routineSchema_validation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const routine = await Routine.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    ).populate('exercises.exercise');

    if (!routine) {
      return res.status(404).json({ error: 'Routine not found' });
    }

    logger.info(`Routine updated: ${routine.name} by user ${req.user.id}`);
    res.json(routine);
  } catch (error) {
    logger.error('Update routine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/routines/:id', authenticateToken, async (req, res) => {
  try {
    logger.info(
      `Intentando eliminar rutina. userId: ${
        req.user && req.user.id
      }, routineId: ${req.params.id}`
    );
    const routine = await Routine.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!routine) {
      logger.warn(
        `No se encontró rutina para eliminar. userId: ${
          req.user && req.user.id
        }, routineId: ${req.params.id}`
      );
      return res.status(404).json({ error: 'Routine not found' });
    }

    logger.info(`Routine deleted: ${routine.name} by user ${req.user.id}`);
    res.json({ message: 'Routine deleted successfully' });
  } catch (error) {
    logger.error('Delete routine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Workout log routes
app.get('/workout-logs', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    const filter = { userId: req.user.id };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const logs = await WorkoutLog.find(filter)
      .populate('routine')
      .populate('exercises.exercise')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await WorkoutLog.countDocuments(filter);

    res.json({
      logs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    logger.error('Get workout logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/workout-logs', authenticateToken, async (req, res) => {
  try {
    const { error } = workoutLogSchema_validation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const log = new WorkoutLog({
      ...req.body,
      userId: req.user.id,
    });

    await log.save();
    await log.populate('routine');
    await log.populate('exercises.exercise');

    logger.info(`Workout log created by user ${req.user.id}`);
    res.status(201).json(log);
  } catch (error) {
    logger.error('Create workout log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get popular routines
app.get('/routines/popular', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const routines = await Routine.find({ isPublic: true })
      .populate('exercises.exercise')
      .limit(limit * 1)
      .sort({ createdAt: -1 });

    res.json({ routines });
  } catch (error) {
    logger.error('Get popular routines error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  logger.info(`Routine Service running on port ${PORT}`);
});

module.exports = app;