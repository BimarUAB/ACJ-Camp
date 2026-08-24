module.exports = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    if (req.user.rol !== requiredRole && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción.' });
    }

    next();
  };
};
