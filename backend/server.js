const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
}

const pool = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const clubRoutes = require('./routes/clubRoutes');
const iglesiaRoutes = require('./routes/iglesiaRoutes');
const lugarRoutes = require('./routes/lugarRoutes');
const reservaRoutes = require('./routes/reservaRoutes');
const reseñaRoutes = require('./routes/reseñaRoutes');
const reportRoutes = require('./routes/reportRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const mapaRoutes = require('./routes/mapaRoutes');
const { expirePendingReservations } = require('./utils/reservationExpiry');

const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '1d' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/iglesias', iglesiaRoutes);
app.use('/api/lugares', lugarRoutes);
app.use('/api/reservas', reservaRoutes);
app.use('/api/resenas', reseñaRoutes);
app.use('/api/reportes', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/mapa', mapaRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'ACJ-Camp API - Sistema de Gestión de Campamentos para Clubes Juveniles Adventistas',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: 'PostgreSQL está recuperándose o no está disponible. El administrador del servicio debe revisar su estado.'
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  if (err.message === 'Origen no permitido por CORS') {
    return res.status(403).json({ success: false, error: 'El origen de esta página no está autorizado para acceder a la API.' });
  }
  if (err.name === 'MulterError' || err.message === 'Solo se permiten archivos de imagen' || err.message?.startsWith('Solo se permiten imágenes')) {
    return res.status(400).json({ success: false, error: err.message });
  }
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 5000;

const ensureAuthColumns = async () => {
  try {
    await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'activo'");
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP');
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_login_fallidos INTEGER NOT NULL DEFAULT 0');
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ');
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

const revisarReservasVencidas = async () => {
  try {
    const expiradas = await expirePendingReservations();
    if (expiradas.length) console.log(`⏱️ ${expiradas.length} reserva(s) pendiente(s) vencida(s)`);
  } catch (error) {
    console.warn('⚠️ No se pudieron revisar las reservas vencidas:', error.message);
  }
};

revisarReservasVencidas();
const temporizadorReservas = setInterval(revisarReservasVencidas, 60 * 1000);
temporizadorReservas.unref();

app.listen(PORT, () => {
  console.log(`🚀 Servidor ACJ-Camp corriendo en http://localhost:${PORT}`);
  console.log(`📅 ${new Date().toLocaleString()}`);
});
