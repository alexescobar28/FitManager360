import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Fab,
  Divider,
  Stack,
  Alert,
  InputAdornment,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Skeleton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Slide,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  FitnessCenter,
  AccessTime,
  Visibility,
  Search,
  FilterList,
  ExpandMore,
  ExpandLess,
  RemoveCircle,
  AddCircle,
  DragIndicator,
  Warning,
  Close,
  Create,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import CircularProgress from '@mui/material/CircularProgress';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const Routines = () => {
  const { user } = useAuth();
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'strength',
    difficulty: 'beginner',
    estimatedDuration: 30,
    exercises: [],
  });
  const [openExercisesDialog, setOpenExercisesDialog] = useState(false);
  const [exercisesToShow, setExercisesToShow] = useState([]);
  const [availableExercises, setAvailableExercises] = useState([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [expandedCards, setExpandedCards] = useState({});
  const [seedingExercises, setSeedingExercises] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    routine: null,
    loading: false,
  });

  // New Exercise Creation States
  const [openNewExerciseDialog, setOpenNewExerciseDialog] = useState(false);
  const [newExerciseData, setNewExerciseData] = useState({
    name: '',
    description: '',
    muscleGroups: [],
    equipment: [],
    difficulty: 'beginner',
    instructions: [],
    tips: [],
  });
  const [creatingExercise, setCreatingExercise] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRoutines();
      fetchExercises();
    }
  }, [user]);

  const fetchRoutines = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get('/api/routines');
      setRoutines(response.data.routines || []);
    } catch (error) {
      console.error('Error fetching routines:', error);
      setError('Error al cargar las rutinas');
      setRoutines([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchExercises = async () => {
    try {
      setLoadingExercises(true);
      const res = await axios.get('/api/exercises');
      const exercises = res.data.exercises || [];
      setAvailableExercises(exercises);
      
      if (exercises.length === 0) {
        console.log('No exercises found, user can seed default exercises');
      }
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setLoadingExercises(false);
    }
  };

  const handleOpenDialog = (routine = null) => {
    if (routine) {
      setSelectedRoutine(routine);
      setFormData({
        name: routine.name,
        description: routine.description || '',
        category: routine.category,
        difficulty: routine.difficulty,
        estimatedDuration: routine.estimatedDuration,
        exercises: (routine.exercises || []).map((ex, idx) => ({
          exercise: typeof ex.exercise === 'object' ? ex.exercise._id : ex.exercise,
          exerciseName: typeof ex.exercise === 'object' ? ex.exercise.name : 'Ejercicio',
          sets: (ex.sets || []).map((set) => ({
            reps: set.reps ?? '',
            weight: set.weight ?? '',
            duration: set.duration ?? '',
            rest: set.rest ?? '',
          })),
          order: ex.order !== undefined ? ex.order : idx,
        })),
      });
    } else {
      setSelectedRoutine(null);
      setFormData({
        name: '',
        description: '',
        category: 'strength',
        difficulty: 'beginner',
        estimatedDuration: 30,
        exercises: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedRoutine(null);
  };

  // New Exercise Creation Functions
  const handleOpenNewExerciseDialog = () => {
    setNewExerciseData({
      name: '',
      description: '',
      muscleGroups: [],
      equipment: [],
      difficulty: 'beginner',
      instructions: [],
      tips: [],
    });
    setOpenNewExerciseDialog(true);
  };

  const handleCloseNewExerciseDialog = () => {
    setOpenNewExerciseDialog(false);
    setNewExerciseData({
      name: '',
      description: '',
      muscleGroups: [],
      equipment: [],
      difficulty: 'beginner',
      instructions: [],
      tips: [],
    });
  };

  const handleCreateNewExercise = async () => {
    if (!newExerciseData.name.trim()) {
      setError('El nombre del ejercicio es requerido');
      return;
    }

    try {
      setCreatingExercise(true);
      setError('');
      
      const exerciseToCreate = {
        ...newExerciseData,
        instructions: newExerciseData.instructions.filter(instruction => instruction.trim() !== ''),
        tips: newExerciseData.tips.filter(tip => tip.trim() !== ''),
      };
      
      const response = await axios.post('/api/exercises', exerciseToCreate);
      const createdExercise = response.data;
      
      // Update available exercises list
      await fetchExercises();
      
      // Add the new exercise to the routine
      const newExerciseForRoutine = {
        exercise: createdExercise._id,
        exerciseName: createdExercise.name,
        sets: [{ reps: '', weight: '', duration: '', rest: '' }],
        order: formData.exercises.length,
      };
      
      setFormData(prev => ({
        ...prev,
        exercises: [...prev.exercises, newExerciseForRoutine],
      }));
      
      handleCloseNewExerciseDialog();
    } catch (error) {
      console.error('Error creating exercise:', error);
      setError('Error al crear el ejercicio');
    } finally {
      setCreatingExercise(false);
    }
  };

  const handleAddExercise = () => {
    const newExercise = {
      exercise: '',
      exerciseName: '',
      sets: [{ reps: '', weight: '', duration: '', rest: '' }],
      order: formData.exercises.length,
    };
    setFormData({
      ...formData,
      exercises: [...formData.exercises, newExercise],
    });
  };

  const handleRemoveExercise = (index) => {
    const updatedExercises = formData.exercises.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      exercises: updatedExercises,
    });
  };

  const handleExerciseChange = (exerciseIndex, field, value) => {
    const updatedExercises = [...formData.exercises];
    if (field === 'exercise') {
      if (value === 'create_new') {
        handleOpenNewExerciseDialog();
        return;
      }
      const selectedExercise = availableExercises.find(ex => ex._id === value);
      updatedExercises[exerciseIndex].exercise = value;
      updatedExercises[exerciseIndex].exerciseName = selectedExercise ? selectedExercise.name : '';
    } else {
      updatedExercises[exerciseIndex][field] = value;
    }
    setFormData({
      ...formData,
      exercises: updatedExercises,
    });
  };

  const handleAddSet = (exerciseIndex) => {
    const updatedExercises = [...formData.exercises];
    updatedExercises[exerciseIndex].sets.push({
      reps: '',
      weight: '',
      duration: '',
      rest: '',
    });
    setFormData({
      ...formData,
      exercises: updatedExercises,
    });
  };

  const handleRemoveSet = (exerciseIndex, setIndex) => {
    const updatedExercises = [...formData.exercises];
    updatedExercises[exerciseIndex].sets = updatedExercises[exerciseIndex].sets.filter(
      (_, i) => i !== setIndex
    );
    setFormData({
      ...formData,
      exercises: updatedExercises,
    });
  };

  const handleSetChange = (exerciseIndex, setIndex, field, value) => {
    const updatedExercises = [...formData.exercises];
    updatedExercises[exerciseIndex].sets[setIndex][field] = value;
    setFormData({
      ...formData,
      exercises: updatedExercises,
    });
  };

  const handleSubmit = async () => {
    const normalizedExercises = formData.exercises
      .filter(ex => ex.exercise)
      .map((ex, idx) => {
        const sets = (ex.sets || [])
          .map((set) => ({
            reps: set.reps !== '' && set.reps !== undefined ? Number(set.reps) : undefined,
            weight: set.weight !== '' && set.weight !== undefined ? Number(set.weight) : undefined,
            duration: set.duration !== '' && set.duration !== undefined ? Number(set.duration) : undefined,
            rest: set.rest !== '' && set.rest !== undefined ? Number(set.rest) : undefined,
          }))
          .filter((set) =>
            set.reps !== undefined ||
            set.weight !== undefined ||
            set.duration !== undefined ||
            set.rest !== undefined
          );
        
        return {
          exercise: ex.exercise,
          sets,
          order: ex.order !== undefined ? ex.order : idx,
        };
      });

    const dataToSend = { ...formData, exercises: normalizedExercises };

    try {
      if (selectedRoutine) {
        await axios.put(`/api/routines/${selectedRoutine._id}`, dataToSend);
      } else {
        await axios.post('/api/routines', dataToSend);
      }
      fetchRoutines();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving routine:', error);
      setError('Error al guardar la rutina');
    }
  };

  const handleOpenDeleteDialog = (routine) => {
    setDeleteDialog({
      open: true,
      routine,
      loading: false,
    });
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog({
      open: false,
      routine: null,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.routine) return;

    setDeleteDialog(prev => ({ ...prev, loading: true }));

    try {
      await axios.delete(`/api/routines/${deleteDialog.routine._id}`);
      fetchRoutines();
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting routine:', error);
      setError('Error al eliminar la rutina');
      setDeleteDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSeedExercises = async () => {
    try {
      setSeedingExercises(true);
      await axios.post('/api/exercises/seed');
      await fetchExercises();
      setError('');
    } catch (error) {
      console.error('Error seeding exercises:', error);
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Error al crear ejercicios de ejemplo');
      }
    } finally {
      setSeedingExercises(false);
    }
  };

  const toggleCardExpansion = (routineId) => {
    setExpandedCards(prev => ({
      ...prev,
      [routineId]: !prev[routineId]
    }));
  };

  const getCategoryColor = (category) => {
    const colors = {
      strength: 'primary',
      cardio: 'secondary',
      flexibility: 'success',
      sports: 'warning',
      rehabilitation: 'info',
      weight_loss: 'error',
      muscle_gain: 'primary',
    };
    return colors[category] || 'default';
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      beginner: 'success',
      intermediate: 'warning',
      advanced: 'error',
    };
    return colors[difficulty] || 'default';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      strength: 'Fuerza',
      cardio: 'Cardio',
      flexibility: 'Flexibilidad',
      sports: 'Deportes',
      rehabilitation: 'Rehabilitación',
      weight_loss: 'Pérdida de peso',
      muscle_gain: 'Ganancia muscular',
    };
    return labels[category] || category;
  };

  const getDifficultyLabel = (difficulty) => {
    const labels = {
      beginner: 'Principiante',
      intermediate: 'Intermedio',
      advanced: 'Avanzado',
    };
    return labels[difficulty] || difficulty;
  };

  const filteredRoutines = routines.filter(routine => {
    const matchesSearch = routine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      routine.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || routine.category === filterCategory;
    const matchesDifficulty = !filterDifficulty || routine.difficulty === filterDifficulty;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const RoutineCard = ({ routine }) => {
    const isExpanded = expandedCards[routine._id];

    return (
      <Card
        sx={{
          height: 'fit-content',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
          },
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
            <Typography
              variant='h6'
              component='div'
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                flex: 1,
                mr: 2,
                fontSize: '1.1rem',
              }}
            >
              {routine.name}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Chip
                label={getCategoryLabel(routine.category)}
                color={getCategoryColor(routine.category)}
                size='small'
                sx={{ 
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  '& .MuiChip-label': { px: 1.5 }
                }}
              />
              <Chip
                label={getDifficultyLabel(routine.difficulty)}
                color={getDifficultyColor(routine.difficulty)}
                size='small'
                sx={{ 
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  '& .MuiChip-label': { px: 1.5 }
                }}
              />
            </Stack>
          </Box>

          <Typography
            variant='body2'
            color='text.secondary'
            sx={{
              mb: 2.5,
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitLineClamp: isExpanded ? 'none' : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {routine.description || 'Sin descripción disponible'}
          </Typography>

          <Box sx={{ display: 'flex', gap: 3, mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AccessTime sx={{ mr: 0.75, fontSize: 18, color: 'primary.main' }} />
              <Typography variant='body2' sx={{ fontWeight: 500 }}>
                {routine.estimatedDuration} min
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FitnessCenter sx={{ mr: 0.75, fontSize: 18, color: 'primary.main' }} />
              <Typography variant='body2' sx={{ fontWeight: 500 }}>
                {routine.exercises?.length || 0} ejercicios
              </Typography>
            </Box>
          </Box>

          <Collapse in={isExpanded}>
            <Divider sx={{ mb: 2.5 }} />
            <Typography variant='subtitle2' sx={{ mb: 1.5, fontWeight: 700, color: 'primary.main' }}>
              Ejercicios ({routine.exercises?.length || 0})
            </Typography>
            <List dense sx={{ py: 0 }}>
              {(routine.exercises || []).slice(0, 5).map((ex, idx) => {
                const exObj = ex.exercise && typeof ex.exercise === 'object'
                  ? ex.exercise
                  : availableExercises.find(e => e._id === (ex.exercise?._id || ex.exercise));

                return (
                  <ListItem key={idx} sx={{ px: 0, py: 0.75 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                          {idx + 1}
                        </Typography>
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={exObj ? exObj.name : `Ejercicio ${idx + 1}`}
                      secondary={`${ex.sets?.length || 0} sets`}
                      primaryTypographyProps={{ 
                        variant: 'body2',
                        fontWeight: 500
                      }}
                      secondaryTypographyProps={{ 
                        variant: 'caption',
                        color: 'text.secondary'
                      }}
                    />
                  </ListItem>
                );
              })}
              {(routine.exercises?.length || 0) > 5 && (
                <ListItem sx={{ px: 0, py: 0.5 }}>
                  <ListItemText
                    primary={`... y ${(routine.exercises?.length || 0) - 5} ejercicios más`}
                    primaryTypographyProps={{
                      variant: 'caption',
                      color: 'text.secondary',
                      fontStyle: 'italic',
                      fontWeight: 500
                    }}
                  />
                </ListItem>
              )}
            </List>
          </Collapse>
        </CardContent>

        <Divider />

        <CardActions sx={{ px: 2.5, py: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size='small'
              startIcon={<Visibility />}
              variant='outlined'
              onClick={() => {
                setExercisesToShow(routine.exercises || []);
                setOpenExercisesDialog(true);
              }}
              sx={{ 
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: 2,
              }}
            >
              Ver Detalles
            </Button>

            <Button
              size='small'
              startIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
              variant='text'
              onClick={() => toggleCardExpansion(routine._id)}
              sx={{ 
                fontSize: '0.8rem',
                fontWeight: 600,
                minWidth: 'auto',
                px: 1.5,
                borderRadius: 2,
              }}
            >
              {isExpanded ? 'Menos' : 'Más'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Editar rutina">
              <IconButton
                size='small'
                onClick={() => handleOpenDialog(routine)}
                sx={{
                  color: 'primary.main',
                  backgroundColor: 'primary.50',
                  '&:hover': {
                    backgroundColor: 'primary.100',
                  },
                }}
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar rutina">
              <IconButton
                size='small'
                onClick={() => handleOpenDeleteDialog(routine)}
                sx={{
                  color: 'error.main',
                  backgroundColor: 'error.50',
                  '&:hover': {
                    backgroundColor: 'error.100',
                  },
                }}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </CardActions>
      </Card>
    );
  };

  const SkeletonCard = () => (
    <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
      <CardContent>
        <Skeleton variant="text" width="80%" height={32} />
        <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
        <Skeleton variant="text" width="60%" height={20} />
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={100} height={24} sx={{ borderRadius: 1 }} />
        </Box>
      </CardContent>
      <CardActions>
        <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 1 }} />
        <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1, ml: 'auto' }} />
      </CardActions>
    </Card>
  );

  return (
    <Box sx={{ backgroundColor: 'grey.50', minHeight: '100vh' }}>
      <Container maxWidth='lg' sx={{ py: 4 }}>
        {/* Header Section */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 4, 
            mb: 4, 
            backgroundColor: 'white',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Box>
              <Typography
                variant='h3'
                sx={{
                  fontWeight: 800,
                  color: 'primary.main',
                  mb: 1,
                  fontSize: { xs: '2rem', md: '3rem' },
                }}
              >
                Mis Rutinas
              </Typography>
              <Typography variant='h6' color='text.secondary' sx={{ fontWeight: 400 }}>
                Gestiona tus rutinas de entrenamiento personalizadas
              </Typography>
            </Box>
            <Button
              variant='contained'
              size='large'
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
              sx={{ 
                px: 4, 
                py: 1.5,
                borderRadius: 3,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
              }}
            >
              Nueva Rutina
            </Button>
          </Box>

          <Divider sx={{ mb: 4 }} />

          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                placeholder="Buscar rutinas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    backgroundColor: 'grey.50',
                    '&:hover': {
                      backgroundColor: 'grey.100',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'white',
                    },
                  },
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth>
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  displayEmpty
                  renderValue={
                    filterCategory !== "" ? undefined : () => "Todas Categorías"
                  }
                  sx={{ 
                    borderRadius: 3,
                    backgroundColor: 'grey.50',
                  }}
                >
                  <MenuItem value="">Todas Categorías</MenuItem>
                  <MenuItem value="strength">Fuerza</MenuItem>
                  <MenuItem value="cardio">Cardio</MenuItem>
                  <MenuItem value="flexibility">Flexibilidad</MenuItem>
                  <MenuItem value="sports">Deportes</MenuItem>
                  <MenuItem value="rehabilitation">Rehabilitación</MenuItem>
                  <MenuItem value="weight_loss">Pérdida de peso</MenuItem>
                  <MenuItem value="muscle_gain">Ganancia muscular</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth>
                <Select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  displayEmpty
                  renderValue={
                    filterDifficulty !== "" ? undefined : () => "Todas Dificultades"
                  }
                  sx={{ 
                    borderRadius: 3,
                    backgroundColor: 'grey.50',
                  }}
                >
                  <MenuItem value="">Todas Dificultades</MenuItem>
                  <MenuItem value="beginner">Principiante</MenuItem>
                  <MenuItem value="intermediate">Intermedio</MenuItem>
                  <MenuItem value="advanced">Avanzado</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => {
                  setSearchTerm('');
                  setFilterCategory('');
                  setFilterDifficulty('');
                }}
                sx={{ 
                  py: 1.5,
                  borderRadius: 3,
                  fontWeight: 600,
                }}
              >
                Limpiar
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: 2,
            }} 
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        )}

        {/* Content */}
        <Paper 
          elevation={0}
          sx={{ 
            backgroundColor: 'white',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Rutinas ({filteredRoutines.length})
              </Typography>
            </Box>

            {loading ? (
              <Grid container spacing={3}>
                {[...Array(6)].map((_, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <SkeletonCard />
                  </Grid>
                ))}
              </Grid>
            ) : filteredRoutines.length > 0 ? (
              <Grid container spacing={3}>
                {filteredRoutines.map((routine) => (
                  <Grid item xs={12} sm={6} md={4} key={routine._id}>
                    <RoutineCard routine={routine} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <FitnessCenter
                  sx={{ fontSize: 100, color: 'text.disabled', mb: 3 }}
                />
                <Typography variant='h4' gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {searchTerm || filterCategory || filterDifficulty
                    ? 'No se encontraron rutinas'
                    : 'No tienes rutinas creadas'
                  }
                </Typography>
                <Typography
                  variant='body1'
                  color='text.secondary'
                  sx={{ mb: 4, maxWidth: 500, mx: 'auto', fontSize: '1.1rem' }}
                >
                  {searchTerm || filterCategory || filterDifficulty
                    ? 'Intenta ajustar los filtros de búsqueda para encontrar lo que buscas'
                    : 'Crea tu primera rutina personalizada para comenzar tu entrenamiento'
                  }
                </Typography>
                {!searchTerm && !filterCategory && !filterDifficulty && (
                  <Button
                    variant='contained'
                    size='large'
                    startIcon={<Add />}
                    onClick={() => handleOpenDialog()}
                    sx={{ 
                      px: 6, 
                      py: 2,
                      borderRadius: 3,
                      fontWeight: 600,
                      fontSize: '1.1rem',
                    }}
                  >
                    Crear Primera Rutina
                  </Button>
                )}
              </Box>
            )}
          </Box>
        </Paper>

        {/* Floating Action Button */}
        <Fab
          color='primary'
          aria-label='add'
          sx={{ 
            position: 'fixed', 
            bottom: 32, 
            right: 32,
            boxShadow: '0 8px 25px rgba(25, 118, 210, 0.4)',
          }}
          onClick={() => handleOpenDialog()}
        >
          <Add />
        </Fab>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialog.open}
          onClose={handleCloseDeleteDialog}
          TransitionComponent={Transition}
          PaperProps={{
            sx: { 
              borderRadius: 3,
              maxWidth: 450,
            }
          }}
        >
          <DialogTitle sx={{ pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: 'error.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Warning sx={{ color: 'error.main', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Eliminar Rutina
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Esta acción no se puede deshacer
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 3, pb: 2 }}>
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6 }}>
              ¿Estás seguro de que quieres eliminar la rutina{' '}
              <strong>"{deleteDialog.routine?.name}"</strong>?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Se perderán todos los ejercicios y configuraciones asociadas a esta rutina.
            </Typography>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 3, gap: 2 }}>
            <Button 
              onClick={handleCloseDeleteDialog}
              variant="outlined"
              size="large"
              sx={{ 
                px: 3,
                borderRadius: 2,
                fontWeight: 600,
              }}
              disabled={deleteDialog.loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDelete}
              variant="contained"
              color="error"
              size="large"
              sx={{ 
                px: 3,
                borderRadius: 2,
                fontWeight: 600,
              }}
              disabled={deleteDialog.loading}
              startIcon={deleteDialog.loading ? <CircularProgress size={20} color="inherit" /> : <Delete />}
            >
              {deleteDialog.loading ? 'Eliminando...' : 'Eliminar Rutina'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create/Edit Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth='lg'
          fullWidth
          PaperProps={{
            sx: { 
              borderRadius: 3,
              maxHeight: '90vh',
            }
          }}
        >
          <DialogTitle sx={{ pb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {selectedRoutine ? 'Editar Rutina' : 'Nueva Rutina'}
              </Typography>
              <IconButton
                onClick={handleCloseDialog}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'grey.100',
                  },
                }}
              >
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 4 }}>
            <Grid container spacing={4}>
              {/* Información Básica */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    backgroundColor: 'primary.50',
                    border: '1px solid',
                    borderColor: 'primary.200',
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: 'primary.main' }}>
                    Información Básica
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label='Nombre de la rutina'
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'white',
                          },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label='Descripción'
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        multiline
                        rows={3}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'white',
                          },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Categoría</InputLabel>
                        <Select
                          value={formData.category}
                          onChange={(e) =>
                            setFormData({ ...formData, category: e.target.value })
                          }
                          sx={{ 
                            borderRadius: 2,
                            backgroundColor: 'white',
                          }}
                        >
                          <MenuItem value='' disabled>
                            <em>Selecciona una categoría</em>
                          </MenuItem>
                          <MenuItem value='strength'>Fuerza</MenuItem>
                          <MenuItem value='cardio'>Cardio</MenuItem>
                          <MenuItem value='flexibility'>Flexibilidad</MenuItem>
                          <MenuItem value='sports'>Deportes</MenuItem>
                          <MenuItem value='rehabilitation'>Rehabilitación</MenuItem>
                          <MenuItem value='weight_loss'>Pérdida de peso</MenuItem>
                          <MenuItem value='muscle_gain'>Ganancia muscular</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Dificultad</InputLabel>
                        <Select
                          value={formData.difficulty}
                          onChange={(e) =>
                            setFormData({ ...formData, difficulty: e.target.value })
                          }
                          sx={{ 
                            borderRadius: 2,
                            backgroundColor: 'white',
                          }}
                        >
                          <MenuItem value='' disabled>
                            <em>Selecciona una dificultad</em>
                          </MenuItem>
                          <MenuItem value='beginner'>Principiante</MenuItem>
                          <MenuItem value='intermediate'>Intermedio</MenuItem>
                          <MenuItem value='advanced'>Avanzado</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label='Duración estimada (min)'
                        type='number'
                        value={formData.estimatedDuration}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            estimatedDuration: parseInt(e.target.value),
                          })
                        }
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            backgroundColor: 'white',
                          },
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Ejercicios */}
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    backgroundColor: 'success.50',
                    border: '1px solid',
                    borderColor: 'success.200',
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                      Ejercicios ({formData.exercises.length})
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddExercise}
                      sx={{ 
                        borderRadius: 2,
                        fontWeight: 600,
                        px: 3,
                      }}
                    >
                      Agregar Ejercicio
                    </Button>
                  </Box>

                  {formData.exercises.length === 0 ? (
                    <Paper 
                      sx={{ 
                        p: 6, 
                        textAlign: 'center', 
                        backgroundColor: 'white',
                        border: '2px dashed',
                        borderColor: 'grey.300',
                        borderRadius: 2,
                      }}
                    >
                      <FitnessCenter sx={{ fontSize: 64, color: 'text.disabled', mb: 3 }} />
                      <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                        No hay ejercicios agregados
                      </Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
                        Agrega ejercicios para completar tu rutina de entrenamiento
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={handleAddExercise}
                        size="large"
                        sx={{
                          px: 4,
                          py: 1.5,
                          borderRadius: 3,
                          fontWeight: 600,
                        }}
                      >
                        Agregar Primer Ejercicio
                      </Button>
                    </Paper>
                  ) : (
                    <Stack spacing={3}>
                      {formData.exercises.map((exercise, exerciseIndex) => (
                        <Accordion 
                          key={exerciseIndex} 
                          defaultExpanded
                          sx={{
                            backgroundColor: 'white',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '12px !important',
                            '&:before': {
                              display: 'none',
                            },
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMore />}
                            sx={{
                              backgroundColor: 'grey.50',
                              borderRadius: '12px 12px 0 0',
                              '&:hover': { 
                                backgroundColor: 'grey.100' 
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                              <DragIndicator sx={{ mr: 2, color: 'text.disabled' }} />
                              <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
                                {exercise.exerciseName || `Ejercicio ${exerciseIndex + 1}`}
                              </Typography>
                              <Chip
                                label={`${exercise.sets.length} sets`}
                                size="small"
                                color="primary"
                                sx={{ mr: 2, fontWeight: 600 }}
                              />
                              <Tooltip title="Eliminar ejercicio">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveExercise(exerciseIndex);
                                  }}
                                  sx={{
                                    color: 'error.main',
                                    backgroundColor: 'error.50',
                                    '&:hover': {
                                      backgroundColor: 'error.100',
                                    },
                                  }}
                                >
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails sx={{ pt: 4 }}>
                            <Grid container spacing={4}>
                              {/* Selección de ejercicio */}
                              <Grid item xs={12}>
                                {availableExercises.length > 0 ? (
                                  <FormControl fullWidth>
                                    <InputLabel>Ejercicio</InputLabel>
                                    <Select
                                      value={exercise.exercise}
                                      onChange={(e) =>
                                        handleExerciseChange(exerciseIndex, 'exercise', e.target.value)
                                      }
                                      sx={{ borderRadius: 2 }}
                                    >
                                      <MenuItem value='' disabled>
                                        <em>Selecciona un ejercicio</em>
                                      </MenuItem>
                                      {availableExercises.map((ex) => (
                                        <MenuItem key={ex._id} value={ex._id}>
                                          <Box>
                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                              {ex.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              {ex.muscleGroups?.join(', ')} • {ex.difficulty}
                                            </Typography>
                                          </Box>
                                        </MenuItem>
                                      ))}
                                      <Divider sx={{ my: 1 }} />
                                      <MenuItem value="create_new">
                                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', color: 'primary.main' }}>
                                          <Create sx={{ mr: 2 }} />
                                          <Box>
                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                              Crear nuevo ejercicio
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              Agregar un ejercicio personalizado
                                            </Typography>
                                          </Box>
                                        </Box>
                                      </MenuItem>
                                    </Select>
                                  </FormControl>
                                ) : (
                                  <Paper 
                                    sx={{ 
                                      p: 4, 
                                      textAlign: 'center', 
                                      backgroundColor: 'warning.50', 
                                      border: '2px solid', 
                                      borderColor: 'warning.200',
                                      borderRadius: 2,
                                    }}
                                  >
                                    <Typography variant="h6" color="warning.main" gutterBottom sx={{ fontWeight: 600 }}>
                                      No hay ejercicios disponibles
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                      Para crear rutinas necesitas tener ejercicios en la base de datos.
                                    </Typography>
                                    <Stack direction="row" spacing={2} justifyContent="center">
                                      <Button
                                        variant="contained"
                                        color="warning"
                                        onClick={handleSeedExercises}
                                        disabled={seedingExercises}
                                        startIcon={seedingExercises ? <CircularProgress size={20} color="inherit" /> : <Add />}
                                        sx={{
                                          px: 4,
                                          py: 1.5,
                                          borderRadius: 2,
                                          fontWeight: 600,
                                        }}
                                      >
                                        {seedingExercises ? 'Creando ejercicios...' : 'Crear ejercicios de ejemplo'}
                                      </Button>
                                      <Button
                                        variant="outlined"
                                        startIcon={<Create />}
                                        onClick={handleOpenNewExerciseDialog}
                                        sx={{
                                          px: 4,
                                          py: 1.5,
                                          borderRadius: 2,
                                          fontWeight: 600,
                                        }}
                                      >
                                        Crear ejercicio personalizado
                                      </Button>
                                    </Stack>
                                  </Paper>
                                )}
                              </Grid>

                              {/* Sets */}
                              <Grid item xs={12}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Sets ({exercise.sets.length})
                                  </Typography>
                                  <Button
                                    size="medium"
                                    startIcon={<AddCircle />}
                                    onClick={() => handleAddSet(exerciseIndex)}
                                    variant="outlined"
                                    sx={{
                                      borderRadius: 2,
                                      fontWeight: 600,
                                    }}
                                  >
                                    Agregar Set
                                  </Button>
                                </Box>

                                {exercise.sets.length === 0 ? (
                                  <Paper 
                                    sx={{ 
                                      p: 4, 
                                      textAlign: 'center', 
                                      backgroundColor: 'grey.50',
                                      border: '2px dashed',
                                      borderColor: 'grey.300',
                                      borderRadius: 2,
                                    }}
                                  >
                                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
                                      No hay sets configurados
                                    </Typography>
                                    <Button
                                      startIcon={<AddCircle />}
                                      onClick={() => handleAddSet(exerciseIndex)}
                                      variant="contained"
                                      sx={{
                                        px: 3,
                                        py: 1,
                                        borderRadius: 2,
                                        fontWeight: 600,
                                      }}
                                    >
                                      Agregar Primer Set
                                    </Button>
                                  </Paper>
                                ) : (
                                  <Paper 
                                    variant="outlined" 
                                    sx={{ 
                                      borderRadius: 2,
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <Box sx={{ p: 3 }}>
                                      <Grid container spacing={2}>
                                        {exercise.sets.map((set, setIndex) => (
                                          <Grid item xs={12} key={setIndex}>
                                            <Paper
                                              sx={{
                                                p: 3,
                                                backgroundColor: 'grey.50',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 2,
                                              }}
                                            >
                                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                <Chip 
                                                  label={`Set ${setIndex + 1}`} 
                                                  color="primary" 
                                                  sx={{ fontWeight: 600 }}
                                                />
                                                <Tooltip title="Eliminar set">
                                                  <IconButton
                                                    size="small"
                                                    onClick={() => handleRemoveSet(exerciseIndex, setIndex)}
                                                    sx={{
                                                      color: 'error.main',
                                                      backgroundColor: 'error.50',
                                                      '&:hover': {
                                                        backgroundColor: 'error.100',
                                                      },
                                                    }}
                                                  >
                                                    <RemoveCircle />
                                                  </IconButton>
                                                </Tooltip>
                                              </Box>
                                              <Grid container spacing={2}>
                                                <Grid item xs={6} sm={3}>
                                                  <TextField
                                                    fullWidth
                                                    label="Repeticiones"
                                                    type="number"
                                                    value={set.reps}
                                                    onChange={(e) =>
                                                      handleSetChange(exerciseIndex, setIndex, 'reps', e.target.value)
                                                    }
                                                    sx={{
                                                      '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        backgroundColor: 'white',
                                                      },
                                                    }}
                                                  />
                                                </Grid>
                                                <Grid item xs={6} sm={3}>
                                                  <TextField
                                                    fullWidth
                                                    label="Peso (kg)"
                                                    type="number"
                                                    value={set.weight}
                                                    onChange={(e) =>
                                                      handleSetChange(exerciseIndex, setIndex, 'weight', e.target.value)
                                                    }
                                                    sx={{
                                                      '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        backgroundColor: 'white',
                                                      },
                                                    }}
                                                  />
                                                </Grid>
                                                <Grid item xs={6} sm={3}>
                                                  <TextField
                                                    fullWidth
                                                    label="Duración (seg)"
                                                    type="number"
                                                    value={set.duration}
                                                    onChange={(e) =>
                                                      handleSetChange(exerciseIndex, setIndex, 'duration', e.target.value)
                                                    }
                                                    sx={{
                                                      '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        backgroundColor: 'white',
                                                      },
                                                    }}
                                                  />
                                                </Grid>
                                                <Grid item xs={6} sm={3}>
                                                  <TextField
                                                    fullWidth
                                                    label="Descanso (seg)"
                                                    type="number"
                                                    value={set.rest}
                                                    onChange={(e) =>
                                                      handleSetChange(exerciseIndex, setIndex, 'rest', e.target.value)
                                                    }
                                                    sx={{
                                                      '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        backgroundColor: 'white',
                                                      },
                                                    }}
                                                  />
                                                </Grid>
                                              </Grid>
                                            </Paper>
                                          </Grid>
                                        ))}
                                      </Grid>
                                    </Box>
                                  </Paper>
                                )}
                              </Grid>
                            </Grid>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 4, gap: 2 }}>
            <Button 
              onClick={handleCloseDialog} 
              size="large" 
              variant="outlined"
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              variant='contained'
              size="large"
              sx={{ 
                px: 6,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
              }}
              disabled={!formData.name.trim()}
            >
              {selectedRoutine ? 'Actualizar Rutina' : 'Crear Rutina'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* New Exercise Creation Dialog */}
        <Dialog
          open={openNewExerciseDialog}
          onClose={handleCloseNewExerciseDialog}
          maxWidth='md'
          fullWidth
          TransitionComponent={Transition}
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ pb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: 'success.100',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Create sx={{ color: 'success.main', fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                    Nuevo Ejercicio
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Crear un ejercicio personalizado para tu rutina
                  </Typography>
                </Box>
              </Box>
              <IconButton
                onClick={handleCloseNewExerciseDialog}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'grey.100',
                  },
                }}
              >
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 4 }}>
            <Paper
              elevation={0}
              sx={{
                p: 4,
                backgroundColor: 'success.50',
                border: '1px solid',
                borderColor: 'success.200',
                borderRadius: 2,
                mb: 4,
              }}
            >
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 700, color: 'success.main' }}>
                Información Básica
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    label='Nombre del ejercicio'
                    fullWidth
                    value={newExerciseData.name}
                    onChange={(e) =>
                      setNewExerciseData({ ...newExerciseData, name: e.target.value })
                    }
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'white',
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label='Descripción'
                    fullWidth
                    value={newExerciseData.description}
                    onChange={(e) =>
                      setNewExerciseData({
                        ...newExerciseData,
                        description: e.target.value,
                      })
                    }
                    multiline
                    rows={3}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'white',
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Grupos musculares</InputLabel>
                    <Select
                      multiple
                      value={newExerciseData.muscleGroups}
                      onChange={(e) =>
                        setNewExerciseData({
                          ...newExerciseData,
                          muscleGroups: e.target.value,
                        })
                      }
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )}
                      sx={{ 
                        borderRadius: 2,
                        backgroundColor: 'white',
                      }}
                    >
                      <MenuItem value='' disabled>
                        <em>Selecciona grupos musculares</em>
                      </MenuItem>
                      <MenuItem value='chest'>Pecho</MenuItem>
                      <MenuItem value='back'>Espalda</MenuItem>
                      <MenuItem value='shoulders'>Hombros</MenuItem>
                      <MenuItem value='arms'>Brazos</MenuItem>
                      <MenuItem value='legs'>Piernas</MenuItem>
                      <MenuItem value='core'>Core</MenuItem>
                      <MenuItem value='cardio'>Cardio</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Equipo</InputLabel>
                    <Select
                      multiple
                      value={newExerciseData.equipment}
                      onChange={(e) =>
                        setNewExerciseData({
                          ...newExerciseData,
                          equipment: e.target.value,
                        })
                      }
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )}
                      sx={{ 
                        borderRadius: 2,
                        backgroundColor: 'white',
                      }}
                    >
                      <MenuItem value='' disabled>
                        <em>Selecciona el equipo</em>
                      </MenuItem>
                      <MenuItem value='bodyweight'>Peso corporal</MenuItem>
                      <MenuItem value='dumbbells'>Mancuernas</MenuItem>
                      <MenuItem value='barbell'>Barra</MenuItem>
                      <MenuItem value='machine'>Máquina</MenuItem>
                      <MenuItem value='cable'>Cable</MenuItem>
                      <MenuItem value='resistance_band'>Banda de resistencia</MenuItem>
                      <MenuItem value='kettlebell'>Kettlebell</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Dificultad</InputLabel>
                    <Select
                      value={newExerciseData.difficulty}
                      onChange={(e) =>
                        setNewExerciseData({
                          ...newExerciseData,
                          difficulty: e.target.value,
                        })
                      }
                      sx={{ 
                        borderRadius: 2,
                        backgroundColor: 'white',
                      }}
                    >
                      <MenuItem value='' disabled>
                        <em>Selecciona la dificultad</em>
                      </MenuItem>
                      <MenuItem value='beginner'>Principiante</MenuItem>
                      <MenuItem value='intermediate'>Intermedio</MenuItem>
                      <MenuItem value='advanced'>Avanzado</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 4,
                backgroundColor: 'info.50',
                border: '1px solid',
                borderColor: 'info.200',
                borderRadius: 2,
              }}
            >
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 700, color: 'info.main' }}>
                Instrucciones y Consejos
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    label='Instrucciones (separadas por coma)'
                    fullWidth
                    value={newExerciseData.instructions.join(', ')}
                    onChange={(e) =>
                      setNewExerciseData({
                        ...newExerciseData,
                        instructions: e.target.value.split(',').map((i) => i.trim()).filter(i => i !== ''),
                      })
                    }
                    placeholder="Ej: Mantén la espalda recta, Controla el movimiento, Respira adecuadamente"
                    multiline
                    rows={2}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'white',
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label='Consejos (separados por coma)'
                    fullWidth
                    value={newExerciseData.tips.join(', ')}
                    onChange={(e) =>
                      setNewExerciseData({
                        ...newExerciseData,
                        tips: e.target.value.split(',').map((i) => i.trim()).filter(i => i !== ''),
                      })
                    }
                    placeholder="Ej: Calienta antes de comenzar, Aumenta peso gradualmente, Descansa entre series"
                    multiline
                    rows={2}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'white',
                      },
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ p: 4, gap: 2 }}>
            <Button 
              onClick={handleCloseNewExerciseDialog}
              variant="outlined"
              size="large"
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
              }}
              disabled={creatingExercise}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateNewExercise}
              variant='contained'
              color="success"
              size="large"
              sx={{ 
                px: 6,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
              }}
              disabled={!newExerciseData.name.trim() || creatingExercise}
              startIcon={creatingExercise ? <CircularProgress size={20} color="inherit" /> : <Create />}
            >
              {creatingExercise ? 'Creando Ejercicio...' : 'Crear y Agregar Ejercicio'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Exercises Detail Dialog */}
        <Dialog
          open={openExercisesDialog}
          onClose={() => setOpenExercisesDialog(false)}
          maxWidth='md'
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ pb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                Detalles de Ejercicios
              </Typography>
              <IconButton
                onClick={() => setOpenExercisesDialog(false)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'grey.100',
                  },
                }}
              >
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 4 }}>
            {exercisesToShow && exercisesToShow.length > 0 ? (
              <Stack spacing={4}>
                {exercisesToShow.map((ex, idx) => {
                  const exObj = ex.exercise && typeof ex.exercise === 'object'
                    ? ex.exercise
                    : availableExercises.find(e => e._id === (ex.exercise?._id || ex.exercise));

                  return (
                    <Paper
                      key={idx}
                      elevation={0}
                      sx={{
                        p: 4,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 3,
                        backgroundColor: 'grey.50',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            backgroundColor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mr: 3,
                          }}
                        >
                          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                            {idx + 1}
                          </Typography>
                        </Box>
                        <Typography variant='h5' sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {exObj ? exObj.name : `Ejercicio ${idx + 1}`}
                        </Typography>
                      </Box>

                      {exObj && exObj.description && (
                        <Typography
                          variant='body1'
                          color='text.secondary'
                          sx={{ mb: 3, lineHeight: 1.6 }}
                        >
                          {exObj.description}
                        </Typography>
                      )}

                      {ex.sets && ex.sets.length > 0 && (
                        <>
                          <Divider sx={{ mb: 3 }} />
                          <Typography variant='h6' sx={{ mb: 2, fontWeight: 700, color: 'success.main' }}>
                            Sets ({ex.sets.length})
                          </Typography>
                          <Grid container spacing={2}>
                            {ex.sets.map((set, sidx) => (
                              <Grid item xs={12} sm={6} md={4} key={sidx}>
                                <Paper
                                  sx={{
                                    p: 3,
                                    backgroundColor: 'white',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                  }}
                                >
                                  <Typography variant='subtitle1' color='primary.main' sx={{ fontWeight: 700, mb: 2 }}>
                                    Set {sidx + 1}
                                  </Typography>
                                  <Stack spacing={1}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant='body2' color="text.secondary">Reps:</Typography>
                                      <Typography variant='body2' sx={{ fontWeight: 600 }}>{set.reps || 0}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant='body2' color="text.secondary">Peso:</Typography>
                                      <Typography variant='body2' sx={{ fontWeight: 600 }}>{set.weight || 0} kg</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant='body2' color="text.secondary">Duración:</Typography>
                                      <Typography variant='body2' sx={{ fontWeight: 600 }}>{set.duration || 0} seg</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant='body2' color="text.secondary">Descanso:</Typography>
                                      <Typography variant='body2' sx={{ fontWeight: 600 }}>{set.rest || 0} seg</Typography>
                                    </Box>
                                  </Stack>
                                </Paper>
                              </Grid>
                            ))}
                          </Grid>
                        </>
                      )}
                    </Paper>
                  );
                })}
              </Stack>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <FitnessCenter sx={{ fontSize: 80, color: 'text.disabled', mb: 3 }} />
                <Typography variant='h5' color='text.secondary' sx={{ fontWeight: 600 }}>
                  No hay ejercicios en esta rutina
                </Typography>
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </Container>
    </Box>
  );
};

export default Routines;