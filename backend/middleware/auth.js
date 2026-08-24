const jwt = require('jsonwebtoken');
const pool = require('../config/database');

exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Acceso denegado. Token no proporcionado.'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'acj-camp-dev-secret');

    const userResult = await pool.query(
      'SELECT id, nombre, email, rol, estado FROM usuarios WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Usuario no encontrado' });
    }

    if (userResult.rows[0].estado === 'inactivo') {
      return res.status(403).json({ success: false, error: 'Su cuenta ha sido desactivada' });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      rol: decoded.rol
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expirado. Por favor inicie sesión nuevamente.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }
    res.status(500).json({ success: false, error: 'Error de autenticación' });
  }
};

exports.requireRole = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para realizar esta acción',
        rolRequerido: rolesPermitidos,
        rolActual: req.user.rol
      });
    }

    next();
  };
};

exports.requireAdmin = exports.requireRole('admin');
exports.requireDirectorOrAdmin = exports.requireRole('director', 'admin');

exports.requireOwnerOrAdmin = (getOwnerId) => {
  return async (req, res, next) => {
    try {
      if (req.user.rol === 'admin') {
        return next();
      }

      const ownerId = await getOwnerId(req);

      if (ownerId === req.user.id) {
        return next();
      }

      res.status(403).json({ success: false, error: 'No tiene permisos para modificar este recurso' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Error verificando permisos' });
    }
  };
};
