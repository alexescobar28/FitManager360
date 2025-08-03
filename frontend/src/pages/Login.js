import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { 
  Login as LoginIcon, 
  PersonAdd, 
  FitnessCenter,
  Email,
  Lock,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      localStorage.clear();
      
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        // Redirect to the page they were trying to access, or dashboard
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Container component="main" maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: 6,
            border: '1px solid #e0e0e0',
            borderRadius: 3,
            backgroundColor: 'white',
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                mb: 2,
              }}
            >
              <FitnessCenter sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                color: 'primary.main',
                mb: 1,
              }}
            >
              FitManager360
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Inicia sesión en tu cuenta
            </Typography>
          </Box>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Correo Electrónico"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
              sx={{ 
                mb: 3,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
              }}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>

            {/* Links */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <Link to="/forgot-password" style={{ textDecoration: 'none' }}>
                  <Typography
                    variant="body2"
                    color="primary"
                    sx={{
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </Typography>
                </Link>
              </Grid>
              <Grid item xs={12} sm={6} sx={{ textAlign: { sm: 'right' } }}>
                <Link to="/register" style={{ textDecoration: 'none' }}>
                  <Typography
                    variant="body2"
                    color="primary"
                    sx={{
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    ¿No tienes cuenta?
                  </Typography>
                </Link>
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />

            {/* Register Button */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                ¿Nuevo en FitManager360?
              </Typography>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                component={Link}
                to="/register"
                startIcon={<PersonAdd />}
                sx={{ py: 1.5 }}
              >
                Crear Cuenta Nueva
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Footer */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            © 2025 FitManager360. Todos los derechos reservados.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;
