const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const clubRoutes = require('./routes/clubRoutes');
const lugarRoutes = require('./routes/lugarRoutes');
const reservaRoutes = require('./routes/reservaRoutes');
const reseñaRoutes = require('./routes/reseñaRoutes');
const reportRoutes = require('./routes/reportRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/lugares', lugarRoutes);
app.use('/api/reservas', reservaRoutes);
app.use('/api/resenas', reseñaRoutes);
app.use('/api/reportes', reportRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'CampUSAB API - Sistema de Gestión de Campamentos para Clubes Juveniles Adventistas',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', message: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 5000;

const ensureAuthColumns = async () => {
  try {
    await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'activo'");
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP');
  } catch (error) {
    console.warn('⚠️ No fue posible preparar columnas de autenticación:', error.message);
  }
};

const testDatabaseConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    await ensureAuthColumns();
    console.log('✅ PostgreSQL conectado');
  } catch (error) {
    console.warn('⚠️ PostgreSQL no disponible:', error.message);
  }
};

testDatabaseConnection();

app.listen(PORT, () => {
  console.log(`🚀 Servidor CampUSAB corriendo en http://localhost:${PORT}`);
  console.log(`📅 ${new Date().toLocaleString()}`);
});
