import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Avatar,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  Chip,
  IconButton,
  InputAdornment,
  Fade,
  Slide,
  LinearProgress,
} from '@mui/material';
import {
  Person,
  Edit,
  Save,
  MonitorWeight,
  Height,
  FitnessCenter,
  Cancel,
  AccountCircle,
  Email,
  CalendarToday,
  Wc,
  TrendingUp,
  PhotoCamera,
  Timeline,
  LocalFireDepartment,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    profile: {
      firstName: '',
      lastName: '',
      age: '',
      gender: '',
      height: '',
      weight: '',
      fitnessLevel: '',
      goals: [],
    },
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        profile: {
          firstName: user.profile?.firstName || '',
          lastName: user.profile?.lastName || '',
          age: user.profile?.age || '',
          gender: user.profile?.gender || '',
          height: user.profile?.height || '',
          weight: user.profile?.weight || '',
          fitnessLevel: user.profile?.fitnessLevel || '',
          goals: user.profile?.goals || [],
        },
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      profile: {
        ...formData.profile,
        [name]: value,
      },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      // Solo enviar los campos editables al servidor
      const profileData = {
        profile: {
          // Mantener los valores originales para campos no editables
          firstName: user.profile?.firstName,
          lastName: user.profile?.lastName,
          gender: user.profile?.gender,
          goals: user.profile?.goals || [],
          // Solo actualizar los campos editables
          age: formData.profile.age
            ? parseInt(formData.profile.age)
            : undefined,
          height: formData.profile.height
            ? parseInt(formData.profile.height)
            : undefined,
          weight: formData.profile.weight
            ? parseFloat(formData.profile.weight)
            : undefined,
          fitnessLevel: formData.profile.fitnessLevel,
        },
      };

      const result = await updateProfile(profileData);

      if (result.success) {
        setMessage('Perfil actualizado exitosamente');
        setEditing(false);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error al actualizar el perfil');
    }
  };

  const calculateBMI = () => {
    if (formData.profile.height && formData.profile.weight) {
      const height = parseFloat(formData.profile.height) / 100; // Convert to meters
      const weight = parseFloat(formData.profile.weight);
      const bmi = weight / (height * height);
      return bmi.toFixed(1);
    }
    return null;
  };

  const getBMICategory = (bmi) => {
    if (bmi < 18.5)
      return { category: 'Bajo peso', color: 'info', progress: 25 };
    if (bmi < 25) return { category: 'Normal', color: 'success', progress: 75 };
    if (bmi < 30)
      return { category: 'Sobrepeso', color: 'warning', progress: 60 };
    return { category: 'Obesidad', color: 'error', progress: 40 };
  };

  const getFitnessLevelInfo = (level) => {
    switch (level) {
      case 'beginner':
        return { label: 'Principiante', color: 'info', icon: '🌱' };
      case 'intermediate':
        return { label: 'Intermedio', color: 'warning', icon: '💪' };
      case 'advanced':
        return { label: 'Avanzado', color: 'success', icon: '🏆' };
      default:
        return { label: 'No definido', color: 'default', icon: '❓' };
    }
  };

  const StatCard = ({ title, value, icon, color, subtitle, progress }) => (
    <Slide
      direction='up'
      in={true}
      timeout={600}
    >
      <Card
        elevation={0}
        sx={{
          height: '100%',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 4,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-8px)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 50,
                height: 50,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${color} 0%, ${color}aa 100%)`,
                mr: 2,
                boxShadow: `0 8px 25px ${color}33`,
              }}
            >
              {React.cloneElement(icon, {
                sx: { color: 'white', fontSize: 24 },
              })}
            </Box>
            <Typography
              variant='h6'
              component='div'
              sx={{ fontWeight: 600, color: 'text.primary' }}
            >
              {title}
            </Typography>
          </Box>
          <Typography
            variant='h3'
            component='div'
            sx={{
              fontWeight: 700,
              background: `linear-gradient(135deg, ${color} 0%, ${color}aa 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
            }}
          >
            {value || 'N/A'}
          </Typography>
          {subtitle && (
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{ mb: 1 }}
            >
              {subtitle}
            </Typography>
          )}
          {progress && (
            <LinearProgress
              variant='determinate'
              value={progress}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: `${color}22`,
                '& .MuiLinearProgress-bar': {
                  background: `linear-gradient(90deg, ${color} 0%, ${color}aa 100%)`,
                  borderRadius: 3,
                },
              }}
            />
          )}
        </CardContent>
      </Card>
    </Slide>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 4,
      }}
    >
      <Container maxWidth='lg'>
        <Fade
          in={true}
          timeout={800}
        >
          <Grid
            container
            spacing={4}
          >
            {/* Header Profile Card */}
            <Grid
              item
              xs={12}
            >
              <Slide
                direction='down'
                in={true}
                timeout={600}
              >
                <Paper
                  elevation={12}
                  sx={{
                    p: 4,
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: 6,
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 4,
                    }}
                  >
                    <Box sx={{ position: 'relative' }}>
                      <Avatar
                        sx={{
                          width: { xs: 80, md: 120 },
                          height: { xs: 80, md: 120 },
                          border: '6px solid rgba(102, 126, 234, 0.2)',
                          fontSize: { xs: '2rem', md: '3rem' },
                          fontWeight: 700,
                          background:
                            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          boxShadow: '0 15px 35px rgba(102, 126, 234, 0.3)',
                        }}
                        src={user?.profile?.avatar}
                      >
                        {user?.username?.charAt(0).toUpperCase()}
                      </Avatar>
                      <IconButton
                        sx={{
                          position: 'absolute',
                          bottom: -5,
                          right: -5,
                          backgroundColor: 'primary.main',
                          color: 'white',
                          width: 35,
                          height: 35,
                          '&:hover': {
                            backgroundColor: 'primary.dark',
                            transform: 'scale(1.1)',
                          },
                        }}
                      >
                        <PhotoCamera fontSize='small' />
                      </IconButton>
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 250 }}>
                      <Typography
                        variant='h3'
                        gutterBottom
                        sx={{
                          fontWeight: 800,
                          background:
                            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          mb: 1,
                        }}
                      >
                        {user?.username}
                      </Typography>

                      <Box
                        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                      >
                        <Email
                          sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }}
                        />
                        <Typography
                          variant='h6'
                          color='text.secondary'
                          sx={{ fontWeight: 500 }}
                        >
                          {user?.email}
                        </Typography>
                      </Box>

                      <Box
                        sx={{ display: 'flex', alignItems: 'center', mb: 2 }}
                      >
                        <CalendarToday
                          sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }}
                        />
                        <Typography
                          variant='body1'
                          color='text.secondary'
                        >
                          Miembro desde{' '}
                          {new Date(
                            user?.createdAt || Date.now()
                          ).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                          })}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {formData.profile.fitnessLevel && (
                          <Chip
                            icon={<TrendingUp />}
                            label={`${
                              getFitnessLevelInfo(formData.profile.fitnessLevel)
                                .icon
                            } ${
                              getFitnessLevelInfo(formData.profile.fitnessLevel)
                                .label
                            }`}
                            color={
                              getFitnessLevelInfo(formData.profile.fitnessLevel)
                                .color
                            }
                            variant='filled'
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                        <Chip
                          icon={<LocalFireDepartment />}
                          label='Activo'
                          color='success'
                          variant='outlined'
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </Slide>
            </Grid>

            {/* Messages */}
            {message && (
              <Grid
                item
                xs={12}
              >
                <Fade in={true}>
                  <Alert
                    severity='success'
                    sx={{
                      borderRadius: 3,
                      '& .MuiAlert-icon': { fontSize: '1.5rem' },
                    }}
                  >
                    {message}
                  </Alert>
                </Fade>
              </Grid>
            )}

            {error && (
              <Grid
                item
                xs={12}
              >
                <Fade in={true}>
                  <Alert
                    severity='error'
                    sx={{
                      borderRadius: 3,
                      '& .MuiAlert-icon': { fontSize: '1.5rem' },
                    }}
                  >
                    {error}
                  </Alert>
                </Fade>
              </Grid>
            )}

            {/* Stats Cards */}
            <Grid
              item
              xs={12}
              sm={6}
              md={3}
            >
              <StatCard
                title='Peso'
                value={
                  formData.profile.weight
                    ? `${formData.profile.weight} kg`
                    : null
                }
                icon={<MonitorWeight />}
                color='#667eea'
                subtitle='Peso actual'
              />
            </Grid>

            <Grid
              item
              xs={12}
              sm={6}
              md={3}
            >
              <StatCard
                title='Altura'
                value={
                  formData.profile.height
                    ? `${formData.profile.height} cm`
                    : null
                }
                icon={<Height />}
                color='#764ba2'
                subtitle='Estatura'
              />
            </Grid>

            <Grid
              item
              xs={12}
              sm={6}
              md={3}
            >
              <StatCard
                title='IMC'
                value={calculateBMI()}
                icon={<FitnessCenter />}
                color='#26a69a'
                subtitle={
                  calculateBMI()
                    ? getBMICategory(calculateBMI()).category
                    : null
                }
                progress={
                  calculateBMI()
                    ? getBMICategory(calculateBMI()).progress
                    : null
                }
              />
            </Grid>

            <Grid
              item
              xs={12}
              sm={6}
              md={3}
            >
              <StatCard
                title='Edad'
                value={
                  formData.profile.age ? `${formData.profile.age} años` : null
                }
                icon={<Person />}
                color='#42a5f5'
                subtitle='Años'
              />
            </Grid>

            {/* BMI Info Card */}
            {calculateBMI() && (
              <Grid
                item
                xs={12}
              >
                <Slide
                  direction='up'
                  in={true}
                  timeout={800}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      background: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: 4,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Timeline
                        sx={{ mr: 2, color: 'primary.main', fontSize: 28 }}
                      />
                      <Typography
                        variant='h6'
                        sx={{ fontWeight: 600 }}
                      >
                        Análisis del Índice de Masa Corporal
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Typography
                        variant='h6'
                        color='text.primary'
                      >
                        Tu IMC es{' '}
                        <strong style={{ fontSize: '1.3em', color: '#667eea' }}>
                          {calculateBMI()}
                        </strong>
                      </Typography>
                      <Chip
                        label={getBMICategory(calculateBMI()).category}
                        color={getBMICategory(calculateBMI()).color}
                        variant='filled'
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          px: 2,
                          py: 1,
                        }}
                      />
                    </Box>
                  </Paper>
                </Slide>
              </Grid>
            )}

            {/* Profile Information */}
            <Grid
              item
              xs={12}
            >
              <Slide
                direction='up'
                in={true}
                timeout={1000}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 4,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 3,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <AccountCircle
                        sx={{ mr: 2, color: 'primary.main', fontSize: 32 }}
                      />
                      <Typography
                        variant='h5'
                        sx={{ fontWeight: 600, color: 'primary.main' }}
                      >
                        Información Personal
                      </Typography>
                    </Box>

                    {!editing ? (
                      <Button
                        variant='contained'
                        startIcon={<Edit />}
                        onClick={() => setEditing(true)}
                        sx={{
                          borderRadius: 3,
                          px: 3,
                          py: 1,
                          background:
                            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 12px 35px rgba(102, 126, 234, 0.4)',
                          },
                        }}
                      >
                        Editar Perfil
                      </Button>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                          variant='outlined'
                          startIcon={<Cancel />}
                          onClick={() => setEditing(false)}
                          sx={{
                            borderRadius: 3,
                            px: 3,
                            borderColor: 'error.main',
                            color: 'error.main',
                            '&:hover': {
                              borderColor: 'error.dark',
                              backgroundColor: 'error.main',
                              color: 'white',
                            },
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant='contained'
                          startIcon={<Save />}
                          onClick={handleSubmit}
                          sx={{
                            borderRadius: 3,
                            px: 3,
                            background:
                              'linear-gradient(135deg, #26a69a 0%, #00695c 100%)',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 8px 25px rgba(38, 166, 154, 0.4)',
                            },
                          }}
                        >
                          Guardar Cambios
                        </Button>
                      </Box>
                    )}
                  </Box>

                  <Divider
                    sx={{
                      mb: 4,
                      background:
                        'linear-gradient(90deg, #667eea, transparent)',
                    }}
                  />

                  <Box
                    component='form'
                    onSubmit={handleSubmit}
                  >
                    <Grid
                      container
                      spacing={3}
                    >
                      {/* CAMPOS NO EDITABLES - Siempre deshabilitados */}
                      <Grid
                        item
                        xs={12}
                        sm={6}
                      >
                        <TextField
                          fullWidth
                          label='Nombre'
                          name='firstName'
                          value={formData.profile.firstName}
                          disabled={true} // Siempre deshabilitado
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 3,
                              backgroundColor: 'rgba(0, 0, 0, 0.04)', // Indicar visualmente que no es editable
                            },
                          }}
                        />
                      </Grid>

                      <Grid
                        item
                        xs={12}
                        sm={6}
                      >
                        <TextField
                          fullWidth
                          label='Apellido'
                          name='lastName'
                          value={formData.profile.lastName}
                          disabled={true} // Siempre deshabilitado
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 3,
                              backgroundColor: 'rgba(0, 0, 0, 0.04)', // Indicar visualmente que no es editable
                            },
                          }}
                        />
                      </Grid>

                      <Grid
                        item
                        xs={12}
                        sm={6}
                      >
                        <FormControl
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 3,
                              backgroundColor: 'rgba(0, 0, 0, 0.04)', // Indicar visualmente que no es editable
                            },
                          }}
                        >
                          <InputLabel>Género</InputLabel>
                          <Select
                            name='gender'
                            value={formData.profile.gender}
                            disabled={true} // Siempre deshabilitado
                            startAdornment={
                              <InputAdornment position='start'>
                                <Wc color='action' />
                              </InputAdornment>
                            }
                          >
                            <MenuItem value='male'>Masculino</MenuItem>
                            <MenuItem value='female'>Femenino</MenuItem>
                            <MenuItem value='other'>Otro</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      {/* CAMPOS EDITABLES - Solo estos se pueden modificar */}
                      <Grid
                        item
                        xs={12}
                        sm={6}
                      >
                        <TextField
                          fullWidth
                          label='Edad'
                          name='age'
                          type='number'
                          value={formData.profile.age}
                          onChange={handleChange}
                          disabled={!editing} // Editable solo cuando editing = true
                          InputProps={{
                            startAdornment: editing ? (
                              <InputAdornment position='start'>
                                <Person color='action' />
                              </InputAdornment>
                            ) : null,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 3,
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                boxShadow: editing
                                  ? '0 4px 20px rgba(102, 126, 234, 0.1)'
                                  : 'none',
                              },
                              '&.Mui-focused': {
                                boxShadow:
                                  '0 4px 20px rgba(102, 126, 234, 0.2)',
                              },
                            },
                          }}
                        />
                      </Grid>

                      <Grid
                        item
                        xs={12}
                        sm={6}
                      >
                        <TextField
                          fullWidth
                          label='Altura (cm)'
                          name='height'
                          type='number'
                          value={formData.profile.height}
                          onChange={handleChange}
                          disabled={!editing} // Editable solo cuando editing = true
                          InputProps={{
                            startAdornment: editing ? (
                              <InputAdornment position='start'>
                                <Height color='action' />
                              </InputAdornment>
                            ) : null,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 3,
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                boxShadow: editing
                                  ? '0 4px 20px rgba(102, 126, 234, 0.1)'
                                  : 'none',
                              },
                              '&.Mui-focused': {
                                boxShadow:
                                  '0 4px 20px rgba(102, 126, 234, 0.2)',
                              },
                            },
                          }}
                        />
                      </Grid>

                      <Grid
                        item
                        xs={12}
                        sm={6}
                      >
                        <TextField
                          fullWidth
                          label='Peso (kg)'
                          name='weight'
                          type='number'
                          value={formData.profile.weight}
                          onChange={handleChange}
                          disabled={!editing} // Editable solo cuando editing = true
                          InputProps={{
                            startAdornment: editing ? (
                              <InputAdornment position='start'>
                                <MonitorWeight color='action' />
                              </InputAdornment>
                            ) : null,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 3,
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                boxShadow: editing
                                  ? '0 4px 20px rgba(102, 126, 234, 0.1)'
                                  : 'none',
                              },
                              '&.Mui-focused': {
                                boxShadow:
                                  '0 4px 20px rgba(102, 126, 234, 0.2)',
                              },
                            },
                          }}
                        />
                      </Grid>

                      <Grid
                        item
                        xs={12}
                        sm={6}
                      >
                        <FormControl
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 3,
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                boxShadow: editing
                                  ? '0 4px 20px rgba(102, 126, 234, 0.1)'
                                  : 'none',
                              },
                              '&.Mui-focused': {
                                boxShadow:
                                  '0 4px 20px rgba(102, 126, 234, 0.2)',
                              },
                            },
                          }}
                        >
                          <InputLabel>Nivel de Fitness</InputLabel>
                          <Select
                            name='fitnessLevel'
                            value={formData.profile.fitnessLevel}
                            onChange={handleChange}
                            disabled={!editing} // Editable solo cuando editing = true
                            startAdornment={
                              editing ? (
                                <InputAdornment position='start'>
                                  <TrendingUp color='action' />
                                </InputAdornment>
                              ) : null
                            }
                          >
                            <MenuItem value='beginner'>
                              🌱 Principiante
                            </MenuItem>
                            <MenuItem value='intermediate'>
                              💪 Intermedio
                            </MenuItem>
                            <MenuItem value='advanced'>🏆 Avanzado</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>
                </Paper>
              </Slide>
            </Grid>
          </Grid>
        </Fade>
      </Container>
    </Box>
  );
};

export default Profile;
