import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Avatar,
  Stack,
  alpha,
} from '@mui/material';
import {
  FitnessCenter,
  TrendingUp,
  Timer,
  AccessTime,
  Category,
} from '@mui/icons-material';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    totalRoutines: 0,
    stats: {
      byCategory: [],
      byDifficulty: [],
      byDuration: [],
    },
    recentRoutines: [],
  });
  const [loading, setLoading] = useState(true);

  // Colores modernos para los gráficos
  const chartColors = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#f97316',
    '#06b6d4',
  ];

  const fetchDashboardData = useCallback(async () => {
    try {
      const routinesResponse = await axios.get('/api/routines');
      const routines = routinesResponse.data.routines || [];
      const processedData = processRoutineStats(routines);
      setDashboardData(processedData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDashboardData({
        totalRoutines: 0,
        stats: {
          byCategory: [],
          byDifficulty: [],
          byDuration: [],
        },
        recentRoutines: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const processRoutineStats = (routines) => {
    const categoryStats = {};
    routines.forEach((routine) => {
      const category = routine.category || 'sin_categoria';
      categoryStats[category] = (categoryStats[category] || 0) + 1;
    });
    const byCategoryArray = Object.entries(categoryStats).map(
      ([key, value]) => ({
        _id: key,
        count: value,
      })
    );

    const difficultyStats = {};
    routines.forEach((routine) => {
      const difficulty = routine.difficulty || 'sin_dificultad';
      difficultyStats[difficulty] = (difficultyStats[difficulty] || 0) + 1;
    });
    const byDifficultyArray = Object.entries(difficultyStats).map(
      ([key, value]) => ({
        _id: key,
        count: value,
      })
    );

    const durationStats = {
      corta: 0,
      media: 0,
      larga: 0,
    };
    routines.forEach((routine) => {
      const duration = routine.estimatedDuration || 0;
      if (duration <= 30) {
        durationStats['corta']++;
      } else if (duration <= 60) {
        durationStats['media']++;
      } else {
        durationStats['larga']++;
      }
    });
    const byDurationArray = Object.entries(durationStats).map(
      ([key, value]) => ({
        _id: key,
        count: value,
      })
    );

    const recentRoutines = routines
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((routine) => ({
        id: routine._id,
        name: routine.name,
        category: routine.category,
        difficulty: routine.difficulty,
        estimatedDuration: routine.estimatedDuration,
        exerciseCount: routine.exercises?.length || 0,
        createdAt: routine.createdAt,
      }));

    return {
      totalRoutines: routines.length,
      stats: {
        byCategory: byCategoryArray,
        byDifficulty: byDifficultyArray,
        byDuration: byDurationArray,
      },
      recentRoutines,
    };
  };

  const fetchProgressData = async () => {
    try {
      await axios.get('/api/stats/progress/weight?period=weekly&limit=12');
      // Response data would be processed here if needed
    } catch (error) {
      console.error('Error fetching progress data:', error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchProgressData();
  }, [fetchDashboardData]);

  const getCategoryLabel = (category) => {
    const labels = {
      strength: 'Fuerza',
      cardio: 'Cardio',
      flexibility: 'Flexibilidad',
      sports: 'Deportes',
      rehabilitation: 'Rehabilitación',
      weight_loss: 'Pérdida de peso',
      muscle_gain: 'Ganancia muscular',
      sin_categoria: 'Sin categoría',
    };
    return labels[category] || category;
  };

  const getDifficultyLabel = (difficulty) => {
    const labels = {
      beginner: 'Principiante',
      intermediate: 'Intermedio',
      advanced: 'Avanzado',
      sin_dificultad: 'Sin dificultad',
    };
    return labels[difficulty] || difficulty;
  };

  const getDurationLabel = (duration) => {
    const labels = {
      corta: 'Corta (≤30 min)',
      media: 'Media (31-60 min)',
      larga: 'Larga (>60 min)',
    };
    return labels[duration] || duration;
  };

  const StatCard = ({ title, value, icon, gradient, subtitle, trend }) => (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-4px)',
          transition: 'transform 0.3s ease-in-out',
          boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
        },
        transition: 'all 0.3s ease-in-out',
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography
            variant='h6'
            component='div'
            sx={{ fontWeight: 600 }}
          >
            {title}
          </Typography>
          <Avatar
            sx={{
              bgcolor: alpha('#ffffff', 0.2),
              width: 48,
              height: 48,
            }}
          >
            {icon}
          </Avatar>
        </Box>
        <Typography
          variant='h3'
          component='div'
          sx={{ mb: 1, fontWeight: 'bold' }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography
            variant='body2'
            sx={{ opacity: 0.9 }}
          >
            {subtitle}
          </Typography>
        )}
      </CardContent>
      {/* Elemento decorativo de fondo */}
      <Box
        sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: alpha('#ffffff', 0.1),
          zIndex: 1,
        }}
      />
    </Card>
  );

  const ModernChart = ({
    data,
    title,
    dataKey = 'count',
    colors = chartColors,
  }) => (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': {
          boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
          transition: 'box-shadow 0.3s ease-in-out',
        },
      }}
    >
      <Typography
        variant='h6'
        gutterBottom
        sx={{ fontWeight: 600, color: 'text.primary', mb: 3 }}
      >
        {title}
      </Typography>
      <ResponsiveContainer
        width='100%'
        height={280}
      >
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray='3 3'
            stroke='#e2e8f0'
          />
          <XAxis
            dataKey='_id'
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
          />
          <Bar
            dataKey={dataKey}
            radius={[8, 8, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );

  const RoutineCard = ({ routine }) => {
    const getDifficultyColor = (difficulty) => {
      const colors = {
        beginner: '#10b981',
        intermediate: '#f59e0b',
        advanced: '#ef4444',
        sin_dificultad: '#6b7280',
      };
      return colors[difficulty] || '#6b7280';
    };

    return (
      <Card
        elevation={0}
        sx={{
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            transform: 'translateY(-2px)',
          },
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 2,
            }}
          >
            <Typography
              variant='h6'
              sx={{ fontWeight: 600, color: 'text.primary' }}
            >
              {routine.name}
            </Typography>
            <Chip
              label={getDifficultyLabel(routine.difficulty)}
              size='small'
              sx={{
                bgcolor: alpha(getDifficultyColor(routine.difficulty), 0.1),
                color: getDifficultyColor(routine.difficulty),
                fontWeight: 600,
                border: `1px solid ${alpha(
                  getDifficultyColor(routine.difficulty),
                  0.3
                )}`,
              }}
            />
          </Box>

          <Stack
            direction='row'
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Category sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography
                variant='body2'
                color='text.secondary'
              >
                {getCategoryLabel(routine.category)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography
                variant='body2'
                color='text.secondary'
              >
                {routine.estimatedDuration} min
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FitnessCenter sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography
                variant='body2'
                color='text.secondary'
              >
                {routine.exerciseCount} ejercicios
              </Typography>
            </Box>
          </Stack>

          <Typography
            variant='body2'
            color='text.secondary'
          >
            Creada el{' '}
            {new Date(routine.createdAt).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Typography>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Container
        maxWidth='lg'
        sx={{ mt: 4, mb: 4 }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '50vh',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant='h6'
              sx={{ mb: 2, color: 'text.secondary' }}
            >
              Cargando dashboard...
            </Typography>
            <LinearProgress sx={{ width: 200, borderRadius: 2 }} />
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container
      maxWidth='xl'
      sx={{ mt: 4, mb: 4 }}
    >
      <Grid
        container
        spacing={4}
      >
        {/* Header mejorado */}
        <Grid
          item
          xs={12}
        >
          <Box
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 4,
              p: 4,
              color: 'white',
              mb: 2,
            }}
          >
            <Typography
              variant='h3'
              gutterBottom
              sx={{ fontWeight: 'bold' }}
            >
              ¡Bienvenido, {user?.profile?.firstName || user?.username}! 💪
            </Typography>
            <Typography
              variant='h6'
              sx={{ opacity: 0.9 }}
            >
              {user?.email}
            </Typography>
            <Typography
              variant='body1'
              sx={{ mt: 2, opacity: 0.8 }}
            >
              Aquí tienes un resumen de tu progreso y actividad reciente
            </Typography>
          </Box>
        </Grid>

        {/* Estadísticas principales con gradientes */}
        <Grid
          item
          xs={12}
          sm={6}
          md={3}
        >
          <StatCard
            title='Total de Rutinas'
            value={dashboardData.totalRoutines}
            icon={<FitnessCenter />}
            gradient={['#667eea', '#764ba2']}
            subtitle='Rutinas creadas'
          />
        </Grid>
        <Grid
          item
          xs={12}
          sm={6}
          md={3}
        >
          <StatCard
            title='Categorías'
            value={dashboardData.stats.byCategory.length}
            icon={<Category />}
            gradient={['#f093fb', '#f5576c']}
            subtitle='Tipos diferentes'
          />
        </Grid>
        <Grid
          item
          xs={12}
          sm={6}
          md={3}
        >
          <StatCard
            title='Niveles'
            value={dashboardData.stats.byDifficulty.length}
            icon={<TrendingUp />}
            gradient={['#4facfe', '#00f2fe']}
            subtitle='Dificultades'
          />
        </Grid>
        <Grid
          item
          xs={12}
          sm={6}
          md={3}
        >
          <StatCard
            title='Duraciones'
            value={dashboardData.stats.byDuration.length}
            icon={<Timer />}
            gradient={['#43e97b', '#38f9d7']}
            subtitle='Rangos tiempo'
          />
        </Grid>

        {/* Gráficos mejorados */}
        <Grid
          item
          xs={12}
          lg={6}
        >
          <ModernChart
            data={dashboardData.stats.byCategory.map((item) => ({
              ...item,
              _id: getCategoryLabel(item._id),
            }))}
            title='📊 Distribución por Categoría'
          />
        </Grid>

        <Grid
          item
          xs={12}
          lg={6}
        >
          <ModernChart
            data={dashboardData.stats.byDifficulty.map((item) => ({
              ...item,
              _id: getDifficultyLabel(item._id),
            }))}
            title='🎯 Distribución por Dificultad'
            colors={['#10b981', '#f59e0b', '#ef4444']}
          />
        </Grid>

        <Grid
          item
          xs={12}
          lg={6}
        >
          <ModernChart
            data={dashboardData.stats.byDuration.map((item) => ({
              ...item,
              _id: getDurationLabel(item._id),
            }))}
            title='⏱️ Distribución por Duración'
            colors={['#8b5cf6', '#06b6d4', '#f97316']}
          />
        </Grid>

        {/* Rutinas recientes mejoradas */}
        <Grid
          item
          xs={12}
          lg={6}
        >
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
              border: '1px solid',
              borderColor: 'divider',
              height: 'fit-content',
            }}
          >
            <Typography
              variant='h6'
              gutterBottom
              sx={{ fontWeight: 600, color: 'text.primary', mb: 3 }}
            >
              🔥 Rutinas Recientes
            </Typography>
            <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
              {dashboardData.recentRoutines.length > 0 ? (
                dashboardData.recentRoutines.map((routine) => (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                  />
                ))
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography
                    variant='body1'
                    color='text.secondary'
                  >
                    No hay rutinas recientes
                  </Typography>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                    sx={{ mt: 1 }}
                  >
                    ¡Crea tu primera rutina para empezar!
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
