import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
} from '@mui/material';
import { 
  Email,
  ArrowBack,
  FitnessCenter,
} from '@mui/icons-material';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      // Use relative path to support both direct access and nginx proxy
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setEmailSent(true);
      } else {
        setError(data.error || 'Error al procesar la solicitud');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('Error de conexión. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

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
              Recuperar Contraseña
            </Typography>
          </Box>

          {emailSent ? (
            <Box sx={{ textAlign: 'center' }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                {message}
              </Alert>
              <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
                Revisa tu bandeja de entrada y tu carpeta de spam.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={() => navigate('/login')}
                fullWidth
                sx={{ mb: 2 }}
              >
                Volver al Inicio de Sesión
              </Button>
            </Box>
          ) : (
            <>
              <Typography variant="body1" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {message && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {message}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} noValidate>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Correo Electrónico"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 3 }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading || !email.trim()}
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
                    'Enviar Enlace de Recuperación'
                  )}
                </Button>

                <Box sx={{ textAlign: 'center' }}>
                  <Link to="/login" style={{ textDecoration: 'none' }}>
                    <Typography
                      variant="body2"
                      color="primary"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      <ArrowBack fontSize="small" />
                      Volver al Inicio de Sesión
                    </Typography>
                  </Link>
                </Box>
              </Box>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default ForgotPassword;
