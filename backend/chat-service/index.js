const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const winston = require('winston');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { collectHttpMetrics, metricsEndpoint } = require('./metrics');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

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
    new winston.transports.Console()
  ]
});

// Socket.io configuration
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:8081",
      process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:8081",
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json());

// Metrics middleware
app.use(collectHttpMetrics);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fitmanager_chat', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

mongoose.connection.on('connected', () => {
  logger.info('Connected to MongoDB');
  console.log('Chat Service: MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
  console.error('Chat Service: MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  console.warn('Chat Service: MongoDB disconnected');
});

// Chat Room Schema
const chatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['public', 'private', 'direct'],
    default: 'public'
  },
  participants: [{
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    }
  }],
  createdBy: {
    type: String,
    required: true
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Message Schema
const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true,
    index: true
  },
  senderId: {
    type: String,
    required: true
  },
  senderUsername: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  reactions: [{
    userId: String,
    username: String,
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }
}, {
  timestamps: true
});

// Online Users Schema
const onlineUserSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  socketId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['online', 'away', 'busy'],
    default: 'online'
  },
  currentRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
const Message = mongoose.model('Message', messageSchema);
const OnlineUser = mongoose.model('OnlineUser', onlineUserSchema);

// JWT middleware for HTTP routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Validation schemas
const createRoomSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  description: Joi.string().max(200),
  type: Joi.string().valid('public', 'private', 'direct').default('public')
});

const sendMessageSchema = Joi.object({
  roomId: Joi.string().required(),
  content: Joi.string().min(1).max(1000).required(),
  messageType: Joi.string().valid('text', 'image', 'file').default('text'),
  replyTo: Joi.string().optional()
});

// HTTP Routes

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'chat-service' });
});

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// Get chat rooms
app.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const filter = {
      $or: [
        { type: 'public' },
        { 'participants.userId': req.user.id }
      ]
    };

    if (type) {
      filter.type = type;
    }

    const rooms = await ChatRoom.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ lastActivity: -1 });

    const total = await ChatRoom.countDocuments(filter);

    res.json({
      rooms,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    logger.error('Get rooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create chat room
app.post('/rooms', authenticateToken, async (req, res) => {
  try {
    const { error } = createRoomSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const room = new ChatRoom({
      ...req.body,
      createdBy: req.user.id,
      participants: [{
        userId: req.user.id,
        username: req.user.username,
        role: 'admin'
      }]
    });

    await room.save();

    logger.info(`Chat room created: ${room.name} by user ${req.user.id}`);
    res.status(201).json(room);
  } catch (error) {
    logger.error('Create room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join chat room
app.post('/rooms/:roomId/join', authenticateToken, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is already in room
    const existingParticipant = room.participants.find(p => p.userId === req.user.id);
    if (existingParticipant) {
      return res.status(400).json({ error: 'Already in room' });
    }

    // Add user to room
    room.participants.push({
      userId: req.user.id,
      username: req.user.username
    });

    await room.save();

    logger.info(`User ${req.user.id} joined room ${room.name}`);
    res.json({ message: 'Joined room successfully' });
  } catch (error) {
    logger.error('Join room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages for a room
app.get('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    // Check if user is in room
    const room = await ChatRoom.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isParticipant = room.participants.some(p => p.userId === req.user.id);
    if (!isParticipant && room.type !== 'public') {
      return res.status(403).json({ error: 'Not authorized to view messages' });
    }

    const messages = await Message.find({ 
      roomId: req.params.roomId,
      deleted: false
    })
      .populate('replyTo')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Message.countDocuments({ 
      roomId: req.params.roomId,
      deleted: false
    });

    // Devolver directamente el array para que el frontend pueda usar .map()
    res.json(messages.reverse()); // Reverse to show oldest first
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get online users
app.get('/users/online', authenticateToken, async (req, res) => {
  try {
    const onlineUsers = await OnlineUser.find({ 
      status: 'online',
      userId: { $ne: req.user.id } // Exclude current user
    })
      .select('userId username status currentRoom lastSeen')
      .sort({ lastSeen: -1 });

    // Devolver directamente el array para que el frontend pueda usar .map()
    res.json(onlineUsers);
  } catch (error) {
    logger.error('Get online users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start private chat with another user
app.post('/users/:userId/chat', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'Cannot start chat with yourself' });
    }

    // Check if target user exists and is online
    const targetUser = await OnlineUser.findOne({ userId: targetUserId });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found or offline' });
    }

    // Create a consistent room name for the conversation
    const participants = [currentUserId, targetUserId].sort();
    const roomName = `direct_${participants[0]}_${participants[1]}`;

    // Check if direct chat room already exists
    let room = await ChatRoom.findOne({
      name: roomName,
      type: 'direct'
    });

    if (!room) {
      // Create new direct chat room
      room = new ChatRoom({
        name: roomName,
        description: `Direct chat between ${req.user.username} and ${targetUser.username}`,
        type: 'direct',
        createdBy: currentUserId,
        participants: [
          {
            userId: currentUserId,
            username: req.user.username,
            role: 'member'
          },
          {
            userId: targetUserId,
            username: targetUser.username,
            role: 'member'
          }
        ]
      });

      await room.save();
      logger.info(`Direct chat created between ${req.user.username} and ${targetUser.username}`);
    }

    res.json({
      roomId: room._id,
      roomName: room.name,
      participants: room.participants,
      targetUser: {
        userId: targetUser.userId,
        username: targetUser.username,
        status: targetUser.status
      }
    });
  } catch (error) {
    logger.error('Start private chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's direct chats
app.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const conversations = await ChatRoom.find({
      type: 'direct',
      'participants.userId': req.user.id
    })
      .populate({
        path: 'lastMessage',
        model: 'Message'
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ lastActivity: -1 });

    // Format conversations to show the other participant
    const formattedConversations = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => p.userId !== req.user.id);
      return {
        id: conv._id,
        _id: conv._id,
        name: conv.name,
        type: conv.type,
        otherUser: otherParticipant,
        lastMessage: conv.lastMessage,
        lastActivity: conv.lastActivity,
        createdAt: conv.createdAt
      };
    });

    const total = await ChatRoom.countDocuments({
      type: 'direct',
      'participants.userId': req.user.id
    });

    // Devolver directamente el array para que el frontend pueda usar .map()
    res.json(formattedConversations);
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket Authentication
io.use(async (socket, next) => {
  logger.info('Socket authentication middleware executed');
  try {
    const token = socket.handshake.auth.token;
    logger.info(`Socket authentication attempt - Token present: ${!!token}`);
    
    if (!token) {
      logger.warn('Socket authentication failed - No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    // Log first 50 characters of token for debugging
    logger.info(`Socket authentication - Token (first 50 chars): ${token.substring(0, 50)}`);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    logger.info(`Socket authentication - JWT decoded successfully. Fields: ${Object.keys(decoded).join(', ')}`);
    logger.info(`Socket authentication - User ID: ${decoded.id}, Username: ${decoded.username}`);
    
    socket.userId = decoded.id;
    socket.username = decoded.username;
    logger.info(`Socket authentication successful for user: ${socket.username}`);
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error.message);
    logger.error('Socket authentication - JWT_SECRET being used:', process.env.JWT_SECRET ? 'Present' : 'Missing');
    next(new Error('Authentication error: ' + error.message));
  }
});

// Broadcast online users with debounce and rate limiting
let broadcastTimeout;
let lastBroadcastTime = 0;
const MIN_BROADCAST_INTERVAL = 1000; // Minimum 1 second between broadcasts

const broadcastOnlineUsers = async () => {
  clearTimeout(broadcastTimeout);
  
  const now = Date.now();
  const timeSinceLastBroadcast = now - lastBroadcastTime;
  
  if (timeSinceLastBroadcast < MIN_BROADCAST_INTERVAL) {
    // Schedule broadcast for later
    const delay = MIN_BROADCAST_INTERVAL - timeSinceLastBroadcast;
    broadcastTimeout = setTimeout(broadcastOnlineUsers, delay);
    return;
  }
  
  broadcastTimeout = setTimeout(async () => {
    try {
      // Clean up users who are marked as online but don't have active socket connections
      const connectedSocketIds = Array.from(io.sockets.sockets.keys());
      await OnlineUser.updateMany(
        { 
          status: 'online',
          socketId: { $nin: connectedSocketIds }
        },
        { 
          status: 'offline',
          lastSeen: new Date()
        }
      );
      
      const onlineUsers = await OnlineUser.find({ 
        status: 'online'
      }).select('userId username status lastSeen');
      
      logger.info(`Broadcasting online users list to ALL clients. Count: ${onlineUsers.length}`);
      logger.info(`Online users: ${onlineUsers.map(u => u.username).join(', ')}`);
      
      io.emit('online-users-list', onlineUsers);
      lastBroadcastTime = Date.now();
      
      logger.info(`Broadcast complete. Sent to all connected clients.`);
    } catch (error) {
      logger.error(`Error broadcasting online users: ${error.message}`);
    }
  }, 500); // 500ms debounce
};

// WebSocket Connection Handling
io.on('connection', async (socket) => {
  logger.info(`User ${socket.username} connected`);

  try {
    // Add user to online users (with rate limiting)
    await OnlineUser.findOneAndUpdate(
      { userId: socket.userId },
      {
        userId: socket.userId,
        username: socket.username,
        socketId: socket.id,
        status: 'online',
        lastSeen: new Date()
      },
      { upsert: true }
    );

    // Get all online users and send to new user
    const onlineUsers = await OnlineUser.find({ 
      status: 'online'
    }).select('userId username status lastSeen');

    logger.info(`User ${socket.username} connected. Online users count: ${onlineUsers.length}`);
    
    // Use the centralized broadcast function (with rate limiting)
    await broadcastOnlineUsers();

    // Join user rooms
    const userRooms = await ChatRoom.find({
      'participants.userId': socket.userId
    });

    userRooms.forEach(room => {
      socket.join(room._id.toString());
    });

    // Handle joining a room
    socket.on('join-room', async (roomId) => {
      try {
        const room = await ChatRoom.findById(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if user is participant
        const isParticipant = room.participants.some(p => p.userId === socket.userId);
        if (!isParticipant && room.type !== 'public') {
          socket.emit('error', { message: 'Not authorized to join room' });
          return;
        }

        socket.join(roomId);
        
        // Update user's current room
        await OnlineUser.findOneAndUpdate(
          { userId: socket.userId },
          { currentRoom: roomId }
        );

        // Notify room about user joining
        socket.to(roomId).emit('user-joined-room', {
          userId: socket.userId,
          username: socket.username,
          roomId
        });

        logger.info(`User ${socket.username} joined room ${roomId}`);
      } catch (error) {
        logger.error('Join room error:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle leaving a room
    socket.on('leave-room', async (roomId) => {
      try {
        socket.leave(roomId);
        
        // Update user's current room
        await OnlineUser.findOneAndUpdate(
          { userId: socket.userId },
          { $unset: { currentRoom: 1 } }
        );

        // Notify room about user leaving
        socket.to(roomId).emit('user-left-room', {
          userId: socket.userId,
          username: socket.username,
          roomId
        });

        logger.info(`User ${socket.username} left room ${roomId}`);
      } catch (error) {
        logger.error('Leave room error:', error);
      }
    });

    // Handle sending messages
    socket.on('send-message', async (data) => {
      try {
        const { error } = sendMessageSchema.validate(data);
        if (error) {
          socket.emit('error', { message: error.details[0].message });
          return;
        }

        const { roomId, content, messageType = 'text', replyTo } = data;

        // Verify user is in room
        const room = await ChatRoom.findById(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const isParticipant = room.participants.some(p => p.userId === socket.userId);
        if (!isParticipant && room.type !== 'public') {
          socket.emit('error', { message: 'Not authorized to send message' });
          return;
        }

        // Create message
        const message = new Message({
          roomId,
          senderId: socket.userId,
          senderUsername: socket.username,
          content,
          messageType,
          replyTo: replyTo || undefined
        });

        await message.save();
        await message.populate('replyTo');

        // Update room's last activity and last message
        room.lastActivity = new Date();
        room.lastMessage = message._id;
        await room.save();

        // Broadcast message to room
        io.to(roomId).emit('new-message', {
          id: message._id,
          roomId,
          senderId: socket.userId,
          senderUsername: socket.username,
          content,
          messageType,
          replyTo: message.replyTo,
          createdAt: message.createdAt
        });

        logger.info(`Message sent by ${socket.username} in room ${roomId}`);
      } catch (error) {
        logger.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message reactions
    socket.on('add-reaction', async (data) => {
      try {
        const { messageId, emoji } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Check if user already reacted with this emoji
        const existingReaction = message.reactions.find(
          r => r.userId === socket.userId && r.emoji === emoji
        );

        if (existingReaction) {
          // Remove reaction
          message.reactions = message.reactions.filter(
            r => !(r.userId === socket.userId && r.emoji === emoji)
          );
        } else {
          // Add reaction
          message.reactions.push({
            userId: socket.userId,
            username: socket.username,
            emoji
          });
        }

        await message.save();

        // Broadcast reaction update
        io.to(message.roomId.toString()).emit('reaction-updated', {
          messageId,
          reactions: message.reactions
        });

        logger.info(`Reaction ${emoji} ${existingReaction ? 'removed' : 'added'} by ${socket.username}`);
      } catch (error) {
        logger.error('Add reaction error:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      const { roomId, isTyping } = data;
      socket.to(roomId).emit('user-typing', {
        userId: socket.userId,
        username: socket.username,
        isTyping
      });
    });

    // Handle status updates
    socket.on('update-status', async (status) => {
      try {
        await OnlineUser.findOneAndUpdate(
          { userId: socket.userId },
          { status }
        );

        socket.broadcast.emit('user-status-changed', {
          userId: socket.userId,
          username: socket.username,
          status
        });

        logger.info(`User ${socket.username} status changed to ${status}`);
      } catch (error) {
        logger.error('Update status error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      try {
        logger.info(`User ${socket.username} disconnecting...`);
        
        await OnlineUser.findOneAndUpdate(
          { userId: socket.userId },
          { 
            status: 'offline',
            lastSeen: new Date()
          }
        );

        // Use the centralized broadcast function
        await broadcastOnlineUsers();

        logger.info(`User ${socket.username} disconnected and status updated to offline`);
      } catch (error) {
        logger.error('Disconnect error:', error);
      }
    });

  } catch (error) {
    logger.error('Socket connection error:', error);
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

const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  logger.info(`Chat Service running on port ${PORT}`);
});

module.exports = { app, server };
