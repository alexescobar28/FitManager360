const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
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

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify email configuration
transporter.verify((error, success) => {
  if (error) {
    logger.error('Email configuration error:', error);
  } else {
    logger.info('Email server is ready to send messages');
  }
});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
});

// MongoDB connection
mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/fitmanager_auth',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  }
);

mongoose.connection.on('connected', () => {
  logger.info('Connected to MongoDB');
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  console.warn('MongoDB disconnected');
});

// User Schema
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profile: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      age: { type: Number, min: 13, max: 120 },
      gender: { type: String, enum: ['male', 'female', 'other'] },
      height: { type: Number, min: 50, max: 300 }, // in cm
      weight: { type: Number, min: 20, max: 500 }, // in kg
      fitnessLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
      },
      goals: [{ type: String }],
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'trainer'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
  },
  {
    timestamps: true,
  }
);

// Virtual for account locking
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Handle login attempts
userSchema.methods.incLoginAttempts = function () {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }

  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
  });
};

const User = mongoose.model('User', userSchema);

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  profile: Joi.object({
    firstName: Joi.string().max(50),
    lastName: Joi.string().max(50),
    age: Joi.number().min(13).max(120),
    gender: Joi.string().valid('male', 'female', 'other'),
    height: Joi.number().min(50).max(300),
    weight: Joi.number().min(20).max(500),
    fitnessLevel: Joi.string().valid('beginner', 'intermediate', 'advanced'),
    goals: Joi.array().items(Joi.string()),
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
    },
    process.env.JWT_SECRET || 'your-secret-key',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    }
  );
};

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    );
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
// Routes

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'auth-service' });
});

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// Register
app.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', {
      username: req.body.username,
      email: req.body.email,
      hasProfile: !!req.body.profile
    });

    const { error } = registerSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { username, email, password, profile } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create new user
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const user = new User({
      username,
      email,
      password,
      profile: profile || {},
      emailVerificationToken,
    });

    await user.save();
    console.log('User created successfully:', user._id);

    // Generate token
    const token = generateToken(user);

    logger.info(`User registered: ${email}`);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Registration error details:', error);
    logger.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login
app.post('/login', authLimiter, async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        error:
          'Account temporarily locked due to too many failed login attempts',
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user);

    logger.info(`User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password
app.post('/forgot-password', async (req, res) => {
  try {
    const { error } = forgotPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send password reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'Recuperación de Contraseña - FitManager360',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1976d2; margin: 0;">FitManager360</h1>
            <p style="color: #666; margin: 5px 0;">Tu plataforma de fitness personal</p>
          </div>
          
          <div style="background: #f5f5f5; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Recuperación de Contraseña</h2>
            <p style="color: #666; line-height: 1.6;">
              Has solicitado restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #1976d2; color: white; padding: 15px 30px; text-decoration: none; 
                        border-radius: 5px; display: inline-block; font-weight: bold;">
                Restablecer Contraseña
              </a>
            </div>
            
            <p style="color: #999; font-size: 14px; line-height: 1.5;">
              Si no puedes hacer clic en el botón, copia y pega el siguiente enlace en tu navegador:<br>
              <a href="${resetUrl}" style="color: #1976d2; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px;">
            <p><strong>Importante:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Este enlace expirará en 1 hora por seguridad</li>
              <li>Si no solicitaste este cambio, puedes ignorar este correo</li>
              <li>Tu contraseña actual permanecerá sin cambios hasta que completes el proceso</li>
            </ul>
            
            <p style="text-align: center; margin-top: 30px;">
              © 2025 FitManager360. Todos los derechos reservados.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent to: ${email}`);
      
      res.json({
        message: 'Si el correo electrónico existe, recibirás un enlace de recuperación en breve.',
      });
    } catch (emailError) {
      logger.error('Error sending password reset email:', emailError);
      // Don't reveal email sending errors to client for security
      res.json({
        message: 'Si el correo electrónico existe, recibirás un enlace de recuperación en breve.',
      });
    }
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password
app.post('/reset-password', async (req, res) => {
  try {
    const { error } = resetPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { token, newPassword } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.info(`Password reset completed for: ${user.email}`);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token
app.get('/verify-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    );
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Update profile
app.put('/profile', authenticateToken, async (req, res) => {
  try {
    logger.info(`Profile update request for user: ${req.user.id}`);
    
    const user = await User.findById(req.user.id);

    if (!user) {
      logger.warn(`User not found for profile update: ${req.user.id}`);
      return res.status(404).json({ error: 'User not found' });
    }

    // Update profile fields
    if (req.body.profile) {
      user.profile = { ...user.profile, ...req.body.profile };
      logger.info(`Updating profile for user ${req.user.id}:`, req.body.profile);
    }

    await user.save();
    logger.info(`Profile updated successfully for user: ${req.user.id}`);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    logger.error('Profile update error:', error);
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

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`Auth Service running on port ${PORT}`);
});

module.exports = app;
