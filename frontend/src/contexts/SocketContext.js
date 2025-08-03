import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export { SocketContext };

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const { user } = useAuth();

  // Rate limiting for socket connections
  const [lastConnectTime, setLastConnectTime] = useState(0);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const MAX_CONNECTION_ATTEMPTS = 3;
  const CONNECTION_COOLDOWN = 2000; // 2 seconds

  // Throttling for online users updates
  const [lastOnlineUsersUpdate, setLastOnlineUsersUpdate] = useState(0);
  const ONLINE_USERS_UPDATE_THROTTLE = 500; // 500ms throttle

  const throttledUpdateOnlineUsers = (usersList) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastOnlineUsersUpdate;
    
    if (timeSinceLastUpdate >= ONLINE_USERS_UPDATE_THROTTLE) {
      console.log('Updating online users:', usersList.length);
      setOnlineUsers(usersList);
      setLastOnlineUsersUpdate(now);
    } else {
      console.log('Throttled online users update');
    }
  };

  useEffect(() => {
    if (user) {
      const now = Date.now();
      const timeSinceLastConnect = now - lastConnectTime;
      
      // Rate limiting: prevent too many connection attempts
      if (timeSinceLastConnect < CONNECTION_COOLDOWN && connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
        console.log('Rate limited: Too many connection attempts. Waiting...');
        const timeout = setTimeout(() => {
          setConnectionAttempts(0);
        }, CONNECTION_COOLDOWN);
        return () => clearTimeout(timeout);
      }
      
      const token = localStorage.getItem('token');
      const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3003';
      
      console.log('Attempting to connect to socket with token:', token ? 'Token present' : 'No token');
      console.log('Socket URL:', SOCKET_URL);
      
      setLastConnectTime(now);
      setConnectionAttempts(prev => prev + 1);
      
      const newSocket = io(SOCKET_URL, {
        auth: { token },
        autoConnect: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 3
      });

      newSocket.on('connect', () => {
        console.log('Connected to socket server');
        setConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from socket server');
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        console.error('Error details:', error.message, error.data);
        setConnected(false);
      });

      // User status events
      newSocket.on('online-users-list', (usersList) => {
        console.log('Received online-users-list:', usersList);
        console.log('Online users:', usersList.map(u => u.username).join(', '));
        throttledUpdateOnlineUsers(usersList);
      });

      // Room events
      newSocket.on('user-joined-room', (data) => {
        console.log(`${data.username} joined room ${data.roomId}`);
      });

      newSocket.on('user-left-room', (data) => {
        console.log(`${data.username} left room ${data.roomId}`);
      });

      // Message events
      newSocket.on('new-message', (messageData) => {
        setMessages(prev => [...prev, messageData]);
      });

      newSocket.on('reaction-updated', (data) => {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === data.messageId 
              ? { ...msg, reactions: data.reactions }
              : msg
          )
        );
      });

      // Typing events
      newSocket.on('user-typing', (data) => {
        console.log(`${data.username} is ${data.isTyping ? 'typing' : 'not typing'}`);
      });

      // Error events
      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  const joinRoom = (roomId) => {
    if (socket && connected) {
      socket.emit('join-room', roomId);
      setCurrentRoom(roomId);
      setMessages([]); // Clear messages when joining new room
    }
  };

  const leaveRoom = (roomId) => {
    if (socket && connected) {
      socket.emit('leave-room', roomId);
      setCurrentRoom(null);
      setMessages([]);
    }
  };

  const sendMessage = (roomId, content, messageType = 'text', replyTo = null) => {
    if (socket && connected) {
      socket.emit('send-message', {
        roomId,
        content,
        messageType,
        replyTo
      });
    }
  };

  const addReaction = (messageId, emoji) => {
    if (socket && connected) {
      socket.emit('add-reaction', { messageId, emoji });
    }
  };

  const setTyping = (roomId, isTyping) => {
    if (socket && connected) {
      socket.emit('typing', { roomId, isTyping });
    }
  };

  const updateStatus = (status) => {
    if (socket && connected) {
      socket.emit('update-status', status);
    }
  };

  const value = {
    socket,
    connected,
    onlineUsers,
    messages,
    currentRoom,
    joinRoom,
    leaveRoom,
    sendMessage,
    addReaction,
    setTyping,
    updateStatus,
    setMessages
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
