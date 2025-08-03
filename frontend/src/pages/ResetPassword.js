import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { 
  Lock,
  Visibility,
  VisibilityOff,
  CheckCircle,
  FitnessCenter,
} from '@mui/icons-material';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token de recuperación no válido o faltante.');
    }
  }, [token]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validatePasswords = () => {
    if (formData.newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validatePasswords()) {
      return;
    }

    setLoading(true);

    try {
      // Use relative path to support both direct access and nginx proxy
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(data.error || 'Error al restablecer la contraseña');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setError('Error de conexión. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Container component="main" maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4,
          }}
        >
          <Paper elevation={3} sx={{ padding: 4, width: '100%', borderRadius: 2 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              Token de recuperación no válido o faltante.
            </Alert>
            <Link to="/forgot-password">
              <Button variant="outlined" fullWidth>
                Solicitar nuevo enlace de recuperación
              </Button>
            </Link>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (success) {
    return (
      <Container component="main" maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              padding: 4,
              width: '100%',
              borderRadius: 2,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            }}
          >
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
              ¡Contraseña Restablecida!
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
              Tu contraseña ha sido restablecida exitosamente. 
              Serás redirigido al inicio de sesión en unos segundos.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{
                background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #115293 30%, #1976d2 90%)',
                },
              }}
            >
              Iniciar Sesión Ahora
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            width: '100%',
            borderRadius: 2,
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <FitnessCenter sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography component="h1" variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              FitManager360
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
              Nueva Contraseña
            </Typography>
          </Box>

          <Typography variant="body1" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
            Ingresa tu nueva contraseña. Debe tener al menos 6 caracteres.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              name="newPassword"
              label="Nueva Contraseña"
              type={showPassword ? 'text' : 'password'}
              id="newPassword"
              autoComplete="new-password"
              value={formData.newPassword}
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
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirmar Nueva Contraseña"
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              autoComplete="new-password"
              value={formData.confirmPassword}
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
                      aria-label="toggle confirm password visibility"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
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
              disabled={loading || !formData.newPassword || !formData.confirmPassword}
              sx={{
                mb: 3,
                py: 1.5,
                background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #115293 30%, #1976d2 90%)',
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Restablecer Contraseña'
              )}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Typography
                  variant="body2"
                  color="primary"
                  sx={{
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  Volver al Inicio de Sesión
                </Typography>
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPassword;
