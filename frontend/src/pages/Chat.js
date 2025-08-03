import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  TextField,
  Button,
  Paper,
  Divider,
  Badge,
  Chip,
  IconButton,
  InputAdornment,
  Fade,
  Zoom,
  Alert,
  Skeleton,
  Container,
} from '@mui/material';
import {
  Send,
  Circle,
  Search,
  EmojiEmotions,
  AttachFile,
  MoreVert,
  PersonAdd,
  Refresh,
} from '@mui/icons-material';
import axios from 'axios';

const Chat = () => {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const {
    socket,
    messages: contextMessages,
    onlineUsers: contextOnlineUsers,
  } = useSocket();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUser({
          id: payload.id,
          userId: payload.id,
          email: payload.email,
          username: payload.username || payload.email,
        });
      } catch (error) {
        console.error('Error parsing token:', error);
        setError('Error de autenticación');
      }
    }
  }, []);

  useEffect(() => {
    if (contextOnlineUsers && Array.isArray(contextOnlineUsers)) {
      setOnlineUsers(contextOnlineUsers);
    }
  }, [contextOnlineUsers]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      if (activeConversation && message.roomId === activeConversation.id) {
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === message.id);
          if (!exists) {
            return [...prev, message];
          }
          return prev;
        });
      }
    };

    const handleUserTyping = (data) => {
      if (data.userId !== currentUser?.id) {
        setIsTyping(data.isTyping);
        if (data.isTyping) {
          setTimeout(() => setIsTyping(false), 3000);
        }
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleUserTyping);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('user-typing', handleUserTyping);
    };
  }, [socket, activeConversation, currentUser]);

  useEffect(() => {
    fetchConversations();
    setLoading(false);
  }, []);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const conversations = Array.isArray(response.data) ? response.data : [];
      setConversations(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Error al cargar las conversaciones');
      setConversations([]);
    }
  };

  const startConversation = async (userId) => {
    try {
      setError('');

      // Verificar si el usuario está intentando chatear consigo mismo
      if (userId === currentUser?.id || userId === currentUser?.userId) {
        setError('❌ No puedes iniciar una conversación contigo mismo');
        return;
      }

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/chat/users/${userId}/chat`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const conversation = response.data;
      const normalizedConversation = {
        ...conversation,
        id: conversation.roomId || conversation.id,
      };
      setActiveConversation(normalizedConversation);

      setConversations((prev) => {
        const existing = prev.find((c) => c.id === normalizedConversation.id);
        if (existing) return prev;
        return [...prev, normalizedConversation];
      });

      loadMessages(normalizedConversation.id);

      if (socket) {
        socket.emit('join-room', normalizedConversation.id);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      if (error.response?.status === 400) {
        setError(
          '❌ No se puede iniciar esta conversación. Verifica que sea un usuario válido.'
        );
      } else {
        setError('❌ Error al iniciar la conversación');
      }
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/chat/rooms/${conversationId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const messagesData = Array.isArray(response.data) ? response.data : [];
      setMessages(messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation || !socket) return;

    try {
      socket.emit('send-message', {
        roomId: activeConversation.id,
        content: newMessage.trim(),
        messageType: 'text',
      });

      setNewMessage('');

      // Stop typing indicator
      socket.emit('typing', {
        roomId: activeConversation.id,
        isTyping: false,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Error al enviar el mensaje');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTyping = (value) => {
    setNewMessage(value);

    if (socket && activeConversation) {
      socket.emit('typing', {
        roomId: activeConversation.id,
        isTyping: value.length > 0,
      });

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', {
          roomId: activeConversation.id,
          isTyping: false,
        });
      }, 1000);
    }
  };

  const selectConversation = (conversation) => {
    setActiveConversation(conversation);
    loadMessages(conversation.id);

    if (socket) {
      socket.emit('join-room', conversation.id);
    }
  };

  const getOtherUser = (conversation) => {
    if (!conversation || !currentUser) return null;

    if (conversation.otherUser) {
      return conversation.otherUser;
    }

    if (conversation.participants && Array.isArray(conversation.participants)) {
      return conversation.participants.find(
        (p) => p.userId !== currentUser.userId
      );
    }

    return null;
  };

  const filteredOnlineUsers = onlineUsers.filter(
    (user) =>
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Container
        maxWidth='lg'
        sx={{ mt: 4, mb: 4 }}
      >
        <Grid
          container
          spacing={3}
        >
          {[1, 2, 3].map((item) => (
            <Grid
              item
              xs={12}
              md={4}
              key={item}
            >
              <Skeleton
                variant='rectangular'
                height={200}
                sx={{
                  borderRadius: 3,
                  backgroundColor: 'rgba(0,0,0,0.04)',
                  animation: 'pulse 1.5s ease-in-out 0.5s infinite alternate',
                }}
              />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        p: 3,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3), transparent 50%), radial-gradient(circle at 40% 80%, rgba(120, 119, 255, 0.3), transparent 50%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Typography
        variant='h3'
        gutterBottom
        sx={{
          fontWeight: 800,
          color: 'white',
          textAlign: 'center',
          mb: 4,
          textShadow: '0 4px 20px rgba(0,0,0,0.3)',
          fontSize: { xs: '2rem', md: '3rem' },
          position: 'relative',
          zIndex: 1,
        }}
      >
        💬 Chat en Tiempo Real
      </Typography>

      {error && (
        <Alert
          severity='error'
          sx={{
            mb: 3,
            borderRadius: 3,
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(244, 67, 54, 0.9)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {error}
        </Alert>
      )}

      <Grid
        container
        spacing={3}
        sx={{ position: 'relative', zIndex: 1 }}
      >
        {/* Panel izquierdo */}
        <Grid
          item
          xs={12}
          md={4}
        >
          <Grid
            container
            spacing={2}
            sx={{ height: 'calc(100vh - 200px)' }}
          >
            {/* Usuarios en línea */}
            <Grid
              item
              xs={12}
              sx={{ height: '50%' }}
            >
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  backdropFilter: 'blur(20px)',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                  },
                }}
              >
                <CardContent
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    p: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 2,
                      flexShrink: 0,
                    }}
                  >
                    <Typography
                      variant='h6'
                      sx={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}
                    >
                      🟢 Usuarios en línea ({filteredOnlineUsers.length})
                    </Typography>
                    <IconButton
                      size='small'
                      sx={{
                        color: 'white',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          transform: 'rotate(180deg)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Refresh />
                    </IconButton>
                  </Box>

                  <TextField
                    size='small'
                    placeholder='🔍 Buscar usuarios...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position='start'>
                          <Search sx={{ color: 'rgba(255,255,255,0.8)' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 2,
                      flexShrink: 0,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        color: 'white',
                        borderRadius: 3,
                        transition: 'all 0.3s ease',
                        '& fieldset': {
                          borderColor: 'rgba(255,255,255,0.3)',
                          borderWidth: 1,
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(255,255,255,0.6)',
                          borderWidth: 2,
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'white',
                          borderWidth: 2,
                          boxShadow: '0 0 20px rgba(255,255,255,0.3)',
                        },
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.15)',
                          transform: 'translateY(-1px)',
                        },
                      },
                      '& .MuiInputBase-input::placeholder': {
                        color: 'rgba(255,255,255,0.8)',
                        opacity: 1,
                      },
                    }}
                  />

                  <Box
                    sx={{
                      flex: 1,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      pr: 1,
                      minHeight: 0,
                      '&::-webkit-scrollbar': {
                        width: '6px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: 'rgba(255,255,255,0.3)',
                        borderRadius: '10px',
                        '&:hover': {
                          background: 'rgba(255,255,255,0.5)',
                        },
                      },
                    }}
                  >
                    {filteredOnlineUsers.length > 0 ? (
                      filteredOnlineUsers.map((user, index) => (
                        <Fade
                          in
                          key={user.userId || user.id}
                          timeout={300 + index * 100}
                        >
                          <Card
                            sx={{
                              mb: 2,
                              backgroundColor: 'rgba(255,255,255,0.95)',
                              backdropFilter: 'blur(10px)',
                              cursor: 'pointer',
                              borderRadius: 3,
                              border: '1px solid rgba(255,255,255,0.2)',
                              transition:
                                'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                backgroundColor: 'rgba(255,255,255,1)',
                                transform: 'translateX(8px) translateY(-2px)',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                                '& .user-avatar': {
                                  transform: 'scale(1.1)',
                                  boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                                },
                              },
                            }}
                            onClick={() =>
                              startConversation(user.userId || user.id)
                            }
                          >
                            <CardContent
                              sx={{
                                py: 1.5,
                                px: 2,
                                '&:last-child': { pb: 1.5 },
                              }}
                            >
                              <Box
                                sx={{ display: 'flex', alignItems: 'center' }}
                              >
                                <Badge
                                  overlap='circular'
                                  anchorOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'right',
                                  }}
                                  badgeContent={
                                    <Box
                                      sx={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        backgroundColor: '#4caf50',
                                        border: '2px solid white',
                                        boxShadow:
                                          '0 2px 8px rgba(76, 175, 80, 0.4)',
                                      }}
                                    />
                                  }
                                >
                                  <Avatar
                                    className='user-avatar'
                                    sx={{
                                      width: 36,
                                      height: 36,
                                      mr: 2,
                                      background:
                                        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                      color: 'white',
                                      fontWeight: 700,
                                      fontSize: '0.9rem',
                                      transition: 'all 0.3s ease',
                                      boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                    }}
                                  >
                                    {user.username
                                      ? user.username[0].toUpperCase()
                                      : '👤'}
                                  </Avatar>
                                </Badge>
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                  <Typography
                                    variant='subtitle2'
                                    sx={{
                                      color: 'text.primary',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      mb: 0.5,
                                    }}
                                    noWrap
                                  >
                                    {user.username || 'Usuario'}
                                  </Typography>
                                  <Chip
                                    label='En línea'
                                    size='small'
                                    sx={{
                                      backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                      color: '#2e7d32',
                                      fontWeight: 600,
                                      fontSize: '0.7rem',
                                      height: 18,
                                      border:
                                        '1px solid rgba(76, 175, 80, 0.3)',
                                    }}
                                  />
                                </Box>
                                <IconButton
                                  size='small'
                                  sx={{
                                    color: 'primary.main',
                                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                    '&:hover': {
                                      backgroundColor:
                                        'rgba(102, 126, 234, 0.2)',
                                      transform: 'scale(1.1)',
                                    },
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  <PersonAdd sx={{ fontSize: '1rem' }} />
                                </IconButton>
                              </Box>
                            </CardContent>
                          </Card>
                        </Fade>
                      ))
                    ) : (
                      <Card
                        sx={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: 3,
                          border: '1px solid rgba(255,255,255,0.2)',
                        }}
                      >
                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                          <Typography
                            variant='h6'
                            sx={{
                              color: 'text.secondary',
                              mb: 1,
                              fontSize: '1.5rem',
                            }}
                          >
                            😴
                          </Typography>
                          <Typography
                            variant='body2'
                            sx={{
                              color: 'text.secondary',
                              fontWeight: 500,
                              fontSize: '0.8rem',
                            }}
                          >
                            {searchTerm
                              ? 'No se encontraron usuarios'
                              : 'No hay usuarios en línea'}
                          </Typography>
                        </CardContent>
                      </Card>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Conversaciones activas */}
            <Grid
              item
              xs={12}
              sx={{ height: '50%' }}
            >
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  backdropFilter: 'blur(20px)',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                  },
                }}
              >
                <CardContent
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    p: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Typography
                    variant='h6'
                    sx={{
                      fontWeight: 700,
                      color: 'white',
                      fontSize: '1rem',
                      mb: 2,
                      flexShrink: 0,
                    }}
                  >
                    💬 Conversaciones ({conversations.length})
                  </Typography>
                  <Box
                    sx={{
                      flex: 1,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      pr: 1,
                      minHeight: 0,
                      '&::-webkit-scrollbar': {
                        width: '6px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: 'rgba(255,255,255,0.3)',
                        borderRadius: '10px',
                        '&:hover': {
                          background: 'rgba(255,255,255,0.5)',
                        },
                      },
                    }}
                  >
                    {conversations.length > 0 ? (
                      conversations.map((conversation, index) => {
                        const otherUser = getOtherUser(conversation);
                        const isActive =
                          activeConversation?.id === conversation.id;
                        return (
                          <Zoom
                            in
                            key={conversation.id}
                            timeout={300 + index * 100}
                          >
                            <Card
                              sx={{
                                mb: 2,
                                cursor: 'pointer',
                                backgroundColor: isActive
                                  ? 'rgba(102, 126, 234, 0.9)'
                                  : 'rgba(255,255,255,0.95)',
                                backdropFilter: 'blur(10px)',
                                border: isActive
                                  ? '2px solid rgba(255,255,255,0.5)'
                                  : '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 3,
                                transition:
                                  'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: isActive
                                  ? 'scale(1.02)'
                                  : 'scale(1)',
                                '&:hover': {
                                  backgroundColor: isActive
                                    ? 'rgba(102, 126, 234, 1)'
                                    : 'rgba(255,255,255,1)',
                                  transform: isActive
                                    ? 'scale(1.02) translateY(-2px)'
                                    : 'translateY(-4px) scale(1.02)',
                                  boxShadow: '0 15px 35px rgba(0,0,0,0.15)',
                                  '& .conversation-avatar': {
                                    transform: 'scale(1.1)',
                                    boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                                  },
                                },
                              }}
                              onClick={() => selectConversation(conversation)}
                            >
                              <CardContent
                                sx={{
                                  py: 1.5,
                                  px: 2,
                                  '&:last-child': { pb: 1.5 },
                                }}
                              >
                                <Box
                                  sx={{ display: 'flex', alignItems: 'center' }}
                                >
                                  <Avatar
                                    className='conversation-avatar'
                                    sx={{
                                      width: 36,
                                      height: 36,
                                      mr: 2,
                                      background: isActive
                                        ? 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)'
                                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                      color: 'white',
                                      fontWeight: 700,
                                      fontSize: '0.9rem',
                                      transition: 'all 0.3s ease',
                                      boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                      border: isActive
                                        ? '2px solid rgba(255,255,255,0.3)'
                                        : 'none',
                                    }}
                                  >
                                    {otherUser
                                      ? (otherUser.username ||
                                          otherUser.email ||
                                          'U')[0].toUpperCase()
                                      : '💬'}
                                  </Avatar>
                                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography
                                      variant='subtitle2'
                                      sx={{
                                        fontWeight: 700,
                                        color: isActive
                                          ? 'white'
                                          : 'text.primary',
                                        fontSize: '0.85rem',
                                        mb: 0.5,
                                      }}
                                      noWrap
                                    >
                                      {otherUser?.username ||
                                        otherUser?.email ||
                                        'Conversación'}
                                    </Typography>
                                    <Typography
                                      variant='caption'
                                      sx={{
                                        color: isActive
                                          ? 'rgba(255,255,255,0.8)'
                                          : 'text.secondary',
                                        fontWeight: 500,
                                        fontSize: '0.7rem',
                                      }}
                                      noWrap
                                    >
                                      {typeof conversation.lastMessage ===
                                      'string'
                                        ? conversation.lastMessage
                                        : '✨ Iniciar conversación'}
                                    </Typography>
                                  </Box>
                                  <IconButton
                                    size='small'
                                    sx={{
                                      color: isActive
                                        ? 'rgba(255,255,255,0.8)'
                                        : 'text.secondary',
                                      backgroundColor: isActive
                                        ? 'rgba(255,255,255,0.1)'
                                        : 'transparent',
                                      '&:hover': {
                                        backgroundColor: isActive
                                          ? 'rgba(255,255,255,0.2)'
                                          : 'rgba(0,0,0,0.05)',
                                        transform: 'scale(1.1)',
                                      },
                                      transition: 'all 0.2s ease',
                                    }}
                                  >
                                    <MoreVert sx={{ fontSize: '1rem' }} />
                                  </IconButton>
                                </Box>
                              </CardContent>
                            </Card>
                          </Zoom>
                        );
                      })
                    ) : (
                      <Card
                        sx={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: 3,
                          border: '1px solid rgba(255,255,255,0.2)',
                        }}
                      >
                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                          <Typography
                            variant='h6'
                            sx={{ fontSize: '1.5rem', mb: 1 }}
                          >
                            💭
                          </Typography>
                          <Typography
                            variant='body2'
                            color='text.secondary'
                            sx={{
                              fontWeight: 600,
                              mb: 0.5,
                              fontSize: '0.8rem',
                            }}
                          >
                            No hay conversaciones
                          </Typography>
                          <Typography
                            variant='caption'
                            color='text.secondary'
                            sx={{ fontWeight: 500, fontSize: '0.7rem' }}
                          >
                            Haz click en un usuario para iniciar una
                            conversación
                          </Typography>
                        </CardContent>
                      </Card>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Panel derecho - Chat */}
        <Grid
          item
          xs={12}
          md={8}
        >
          <Card
            sx={{
              height: 'calc(100vh - 200px)',
              display: 'flex',
              flexDirection: 'column',
              backdropFilter: 'blur(20px)',
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              },
            }}
          >
            {activeConversation ? (
              <>
                {/* Header del chat */}
                <Box
                  sx={{
                    p: 3,
                    borderBottom: 1,
                    borderColor: 'rgba(255,255,255,0.2)',
                    background:
                      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    position: 'relative',
                    flexShrink: 0,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background:
                        'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1), transparent 50%)',
                      pointerEvents: 'none',
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar
                        sx={{
                          mr: 3,
                          width: 50,
                          height: 50,
                          bgcolor: 'rgba(255,255,255,0.2)',
                          backdropFilter: 'blur(10px)',
                          border: '2px solid rgba(255,255,255,0.3)',
                          fontWeight: 700,
                          fontSize: '1.2rem',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'scale(1.1)',
                            boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                          },
                        }}
                      >
                        {getOtherUser(
                          activeConversation
                        )?.username?.[0]?.toUpperCase() || '👤'}
                      </Avatar>
                      <Box>
                        <Typography
                          variant='h6'
                          sx={{ fontWeight: 700, fontSize: '1.2rem', mb: 0.5 }}
                        >
                          {getOtherUser(activeConversation)?.username ||
                            getOtherUser(activeConversation)?.email ||
                            'Chat'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: '#4caf50',
                              mr: 1,
                              boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)',
                              animation: 'pulse 2s infinite',
                            }}
                          />
                          <Typography
                            variant='caption'
                            sx={{ fontWeight: 600, fontSize: '0.85rem' }}
                          >
                            En línea
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    <IconButton
                      sx={{
                        color: 'white',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          transform: 'scale(1.1)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>
                </Box>

                {/* Mensajes */}
                <Box
                  sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    p: 3,
                    background:
                      'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    backgroundImage: `
                      radial-gradient(circle at 25% 25%, rgba(102, 126, 234, 0.05) 0%, transparent 25%),
                      radial-gradient(circle at 75% 75%, rgba(118, 75, 162, 0.05) 0%, transparent 25%)
                    `,
                    position: 'relative',
                    minHeight: 0,
                    '&::-webkit-scrollbar': {
                      width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'rgba(0,0,0,0.05)',
                      borderRadius: '10px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'rgba(102, 126, 234, 0.3)',
                      borderRadius: '10px',
                      '&:hover': {
                        background: 'rgba(102, 126, 234, 0.5)',
                      },
                    },
                  }}
                >
                  {messages.length > 0 ? (
                    messages.map((message, index) => {
                      const isOwnMessage = message.senderId === currentUser?.id;
                      const showAvatar =
                        index === 0 ||
                        messages[index - 1].senderId !== message.senderId;

                      return (
                        <Fade
                          in
                          key={message._id || message.id}
                          timeout={300 + index * 50}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: isOwnMessage
                                ? 'flex-end'
                                : 'flex-start',
                              mb: 2,
                              alignItems: 'flex-end',
                            }}
                          >
                            {!isOwnMessage && showAvatar && (
                              <Avatar
                                sx={{
                                  width: 36,
                                  height: 36,
                                  mr: 2,
                                  background:
                                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  color: 'white',
                                  fontWeight: 700,
                                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                  transition: 'all 0.3s ease',
                                  '&:hover': {
                                    transform: 'scale(1.1)',
                                    boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                                  },
                                }}
                              >
                                {message.senderUsername?.[0]?.toUpperCase() ||
                                  '👤'}
                              </Avatar>
                            )}
                            {!isOwnMessage && !showAvatar && (
                              <Box sx={{ width: 36, mr: 2 }} />
                            )}

                            <Paper
                              elevation={0}
                              sx={{
                                p: 2,
                                maxWidth: '70%',
                                background: isOwnMessage
                                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                  : 'rgba(255,255,255,0.9)',
                                backdropFilter: 'blur(10px)',
                                border: isOwnMessage
                                  ? '1px solid rgba(255,255,255,0.2)'
                                  : '1px solid rgba(0,0,0,0.1)',
                                color: isOwnMessage ? 'white' : 'text.primary',
                                borderRadius: 3,
                                borderBottomRightRadius: isOwnMessage ? 8 : 20,
                                borderBottomLeftRadius: isOwnMessage ? 20 : 8,
                                position: 'relative',
                                boxShadow: isOwnMessage
                                  ? '0 8px 25px rgba(102, 126, 234, 0.3)'
                                  : '0 4px 15px rgba(0,0,0,0.1)',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  transform: 'translateY(-2px)',
                                  boxShadow: isOwnMessage
                                    ? '0 12px 35px rgba(102, 126, 234, 0.4)'
                                    : '0 8px 25px rgba(0,0,0,0.15)',
                                },
                                '&::before': !isOwnMessage
                                  ? {
                                      content: '""',
                                      position: 'absolute',
                                      bottom: 0,
                                      left: -10,
                                      width: 0,
                                      height: 0,
                                      borderLeft: '10px solid transparent',
                                      borderRight:
                                        '10px solid rgba(255,255,255,0.9)',
                                      borderBottom:
                                        '10px solid rgba(255,255,255,0.9)',
                                    }
                                  : {},
                                '&::after': isOwnMessage
                                  ? {
                                      content: '""',
                                      position: 'absolute',
                                      bottom: 0,
                                      right: -10,
                                      width: 0,
                                      height: 0,
                                      borderLeft: '10px solid #764ba2',
                                      borderRight: '10px solid transparent',
                                      borderBottom: '10px solid #764ba2',
                                    }
                                  : {},
                              }}
                            >
                              {!isOwnMessage && showAvatar && (
                                <Typography
                                  variant='caption'
                                  sx={{
                                    color: 'primary.main',
                                    fontWeight: 700,
                                    display: 'block',
                                    mb: 1,
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  {message.senderUsername || 'Usuario'}
                                </Typography>
                              )}
                              <Typography
                                variant='body1'
                                sx={{
                                  wordBreak: 'break-word',
                                  lineHeight: 1.5,
                                  fontSize: '0.95rem',
                                }}
                              >
                                {message.content}
                              </Typography>
                              <Typography
                                variant='caption'
                                sx={{
                                  color: isOwnMessage
                                    ? 'rgba(255,255,255,0.8)'
                                    : 'text.secondary',
                                  display: 'block',
                                  textAlign: 'right',
                                  mt: 1,
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                }}
                              >
                                {formatTime(message.createdAt)}
                              </Typography>
                            </Paper>
                          </Box>
                        </Fade>
                      );
                    })
                  ) : (
                    <Box
                      sx={{
                        textAlign: 'center',
                        py: 6,
                        background: 'rgba(255,255,255,0.5)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: 4,
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <Typography
                        variant='h4'
                        sx={{ fontSize: '3rem', mb: 2 }}
                      >
                        💬
                      </Typography>
                      <Typography
                        variant='h6'
                        color='text.secondary'
                        gutterBottom
                        sx={{ fontWeight: 700 }}
                      >
                        ¡Inicia la conversación!
                      </Typography>
                      <Typography
                        variant='body2'
                        color='text.secondary'
                        sx={{ fontWeight: 500 }}
                      >
                        Envía tu primer mensaje para comenzar a chatear
                      </Typography>
                    </Box>
                  )}

                  {isTyping && (
                    <Fade in>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', mb: 2 }}
                      >
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            mr: 2,
                            bgcolor: 'grey.400',
                            animation: 'pulse 1.5s infinite',
                          }}
                        >
                          <EmojiEmotions />
                        </Avatar>
                        <Paper
                          sx={{
                            p: 2,
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: 3,
                            borderBottomLeftRadius: 8,
                            border: '1px solid rgba(0,0,0,0.1)',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                            animation: 'pulse 1.5s infinite',
                          }}
                        >
                          <Typography
                            variant='body2'
                            color='text.secondary'
                            sx={{
                              fontStyle: 'italic',
                              fontWeight: 500,
                            }}
                          >
                            ✍️ Escribiendo...
                          </Typography>
                        </Paper>
                      </Box>
                    </Fade>
                  )}

                  <div ref={messagesEndRef} />
                </Box>

                {/* Input para escribir mensaje */}
                <Box
                  sx={{
                    p: 3,
                    borderTop: 1,
                    borderColor: 'rgba(0,0,0,0.1)',
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(10px)',
                    flexShrink: 0,
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                    <IconButton
                      color='primary'
                      sx={{
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        '&:hover': {
                          backgroundColor: 'rgba(102, 126, 234, 0.2)',
                          transform: 'scale(1.1)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <AttachFile />
                    </IconButton>
                    <IconButton
                      color='primary'
                      sx={{
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        '&:hover': {
                          backgroundColor: 'rgba(102, 126, 234, 0.2)',
                          transform: 'scale(1.1)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <EmojiEmotions />
                    </IconButton>
                    <TextField
                      fullWidth
                      multiline
                      maxRows={4}
                      value={newMessage}
                      onChange={(e) => handleTyping(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder='💭 Escribe un mensaje...'
                      variant='outlined'
                      size='small'
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 4,
                          backgroundColor: 'rgba(248, 250, 252, 0.8)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(0,0,0,0.1)',
                          transition: 'all 0.3s ease',
                          '& fieldset': {
                            borderColor: 'rgba(0,0,0,0.1)',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(102, 126, 234, 0.5)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#667eea',
                            borderWidth: 2,
                            boxShadow: '0 0 20px rgba(102, 126, 234, 0.2)',
                          },
                          '&:hover': {
                            backgroundColor: 'rgba(248, 250, 252, 1)',
                            transform: 'translateY(-1px)',
                          },
                        },
                        '& .MuiInputBase-input::placeholder': {
                          color: 'rgba(0,0,0,0.6)',
                          opacity: 1,
                        },
                      }}
                    />
                    <IconButton
                      color='primary'
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      sx={{
                        background: newMessage.trim()
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : 'linear-gradient(135deg, #e0e7ff 0%, #f1f5f9 100%)',
                        color: 'white',
                        width: 48,
                        height: 48,
                        boxShadow: newMessage.trim()
                          ? '0 4px 15px rgba(102, 126, 234, 0.4)'
                          : '0 2px 8px rgba(0,0,0,0.1)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          background: newMessage.trim()
                            ? 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)'
                            : 'linear-gradient(135deg, #e0e7ff 0%, #f1f5f9 100%)',
                          transform: newMessage.trim()
                            ? 'scale(1.1) rotate(15deg)'
                            : 'none',
                          boxShadow: newMessage.trim()
                            ? '0 8px 25px rgba(102, 126, 234, 0.5)'
                            : '0 2px 8px rgba(0,0,0,0.1)',
                        },
                        '&:disabled': {
                          background:
                            'linear-gradient(135deg, #e0e7ff 0%, #f1f5f9 100%)',
                          color: 'rgba(0,0,0,0.3)',
                        },
                      }}
                    >
                      <Send />
                    </IconButton>
                  </Box>
                </Box>
              </>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  p: 4,
                  background:
                    'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                }}
              >
                <Box sx={{ maxWidth: 400 }}>
                  <Avatar
                    sx={{
                      width: 100,
                      height: 100,
                      mx: 'auto',
                      mb: 3,
                      background:
                        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
                      animation: 'pulse 2s infinite',
                    }}
                  >
                    <Send sx={{ fontSize: 50 }} />
                  </Avatar>
                  <Typography
                    variant='h4'
                    gutterBottom
                    sx={{
                      fontWeight: 800,
                      background:
                        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 2,
                    }}
                  >
                    💬 Selecciona una conversación
                  </Typography>
                  <Typography
                    variant='body1'
                    color='text.secondary'
                    sx={{
                      fontWeight: 500,
                      fontSize: '1.1rem',
                      lineHeight: 1.6,
                    }}
                  >
                    Elige un usuario de la lista para iniciar una conversación
                    increíble
                  </Typography>
                  <Box
                    sx={{
                      mt: 3,
                      p: 2,
                      backgroundColor: 'rgba(102, 126, 234, 0.1)',
                      borderRadius: 3,
                      border: '1px solid rgba(102, 126, 234, 0.2)',
                    }}
                  >
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      sx={{ fontWeight: 600 }}
                    >
                      💡 Tip: Los usuarios en línea aparecen en tiempo real
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

      <style
        jsx
        global
      >{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
      `}</style>
    </Box>
  );
};

export default Chat;
