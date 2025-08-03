import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  Badge,
  Chip,
} from '@mui/material';
import {
  Dashboard,
  FitnessCenter,
  Chat,
  Person,
  Logout,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { onlineUsers } = useSocket();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);

  // Don't render navbar on public pages
  const publicPages = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ];
  if (publicPages.includes(location.pathname)) {
    return null;
  }

  // Don't render navbar if user is not authenticated
  if (!user) {
    return null;
  }

  const handleUserMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const handleLogout = () => {
    logout();
    handleUserMenuClose();
  };

  const navigationItems = [
    {
      label: 'Dashboard',
      path: '/',
      icon: <Dashboard />,
    },
    {
      label: 'Rutinas',
      path: '/routines',
      icon: <FitnessCenter />,
    },
    {
      label: 'Chat',
      path: '/chat',
      icon: <Chat />,
      badge: onlineUsers.length > 0 ? onlineUsers.length : null,
    },
    {
      label: 'Perfil',
      path: '/profile',
      icon: <Person />,
    },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Don't show navbar on login/register pages
  if (location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  return (
    <AppBar
      position='sticky'
      elevation={0}
      sx={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ px: { xs: 2, md: 4 }, py: 1 }}>
        {/* Logo Section */}
        <Box
          component={Link}
          to='/'
          sx={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: 'inherit',
            mr: 4,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: 'primary.main',
              mr: 2,
            }}
          >
            <FitnessCenter sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Typography
            variant='h6'
            sx={{
              fontWeight: 700,
              color: 'primary.main',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            FitManager360
          </Typography>
        </Box>

        {/* Desktop Navigation */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            gap: 1,
            flexGrow: 1,
          }}
        >
          {navigationItems.map((item) => (
            <Button
              key={item.path}
              component={Link}
              to={item.path}
              startIcon={
                item.badge ? (
                  <Badge
                    badgeContent={item.badge}
                    color='secondary'
                  >
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )
              }
              sx={{
                px: 3,
                py: 1,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                color: isActive(item.path) ? 'primary.main' : 'text.secondary',
                backgroundColor: isActive(item.path)
                  ? 'primary.50'
                  : 'transparent',
                border: isActive(item.path)
                  ? '1px solid'
                  : '1px solid transparent',
                borderColor: isActive(item.path)
                  ? 'primary.200'
                  : 'transparent',
                '&:hover': {
                  backgroundColor: 'primary.50',
                  color: 'primary.main',
                },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        {/* Mobile Menu Button */}
        <IconButton
          sx={{ display: { xs: 'block', md: 'none' }, ml: 'auto', mr: 2 }}
          onClick={handleMobileMenuOpen}
        >
          <MenuIcon />
        </IconButton>

        {/* User Section */}
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Online Status */}
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Chip
                size='small'
                label={`${onlineUsers.length} en línea`}
                color='success'
                variant='outlined'
                sx={{ fontSize: '0.75rem' }}
              />
            </Box>

            {/* Notifications */}
            {/* User Avatar and Menu */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  textAlign: 'right',
                }}
              >
                <Typography
                  variant='body2'
                  sx={{ fontWeight: 600, color: 'text.primary' }}
                >
                  {user?.username || 'Usuario'}
                </Typography>
                <Typography
                  variant='caption'
                  color='text.secondary'
                >
                  {user?.role === 'admin' ? 'Administrador' : 'Usuario'}
                </Typography>
              </Box>

              <IconButton
                onClick={handleUserMenuOpen}
                sx={{ p: 0.5 }}
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'primary.main',
                    fontSize: '1rem',
                    fontWeight: 600,
                  }}
                >
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
              </IconButton>
            </Box>
          </Box>
        )}

        {/* User Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleUserMenuClose}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 200,
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography
              variant='subtitle2'
              sx={{ fontWeight: 600 }}
            >
              {user?.username || 'Usuario'}
            </Typography>
            <Typography
              variant='caption'
              color='text.secondary'
            >
              {user?.email || ''}
            </Typography>
          </Box>
          <Divider />
          <MenuItem
            onClick={() => {
              navigate('/profile');
              handleUserMenuClose();
            }}
            sx={{ py: 1.5 }}
          >
            <Person sx={{ mr: 2, fontSize: 20 }} />
            Mi Perfil
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={handleLogout}
            sx={{
              py: 1.5,
              color: 'error.main',
              '&:hover': {
                backgroundColor: 'error.50',
              },
            }}
          >
            <Logout sx={{ mr: 2, fontSize: 20 }} />
            Cerrar Sesión
          </MenuItem>
        </Menu>

        {/* Mobile Menu */}
        <Menu
          anchorEl={mobileMenuAnchor}
          open={Boolean(mobileMenuAnchor)}
          onClose={handleMobileMenuClose}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 200,
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            },
          }}
        >
          {navigationItems.map((item) => (
            <MenuItem
              key={item.path}
              onClick={() => {
                navigate(item.path);
                handleMobileMenuClose();
              }}
              sx={{
                py: 1.5,
                backgroundColor: isActive(item.path)
                  ? 'primary.50'
                  : 'transparent',
                color: isActive(item.path) ? 'primary.main' : 'text.primary',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {item.badge ? (
                  <Badge
                    badgeContent={item.badge}
                    color='secondary'
                  >
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
                {item.label}
              </Box>
            </MenuItem>
          ))}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
