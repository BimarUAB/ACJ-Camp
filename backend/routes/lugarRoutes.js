const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const lugarController = require('../controllers/lugarController');
const auth = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.get('/',
  auth.optionalVerifyToken,
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radio').optional().isFloat({ min: 0.1, max: 5000 }),
  validate,
  lugarController.getAllLugares
);
router.get('/pendientes', auth.verifyToken, auth.requireAdmin, lugarController.getLugaresPendientes);
router.get('/mis', auth.verifyToken, lugarController.getMisLugares);
router.get('/:id', auth.optionalVerifyToken, param('id').isInt(), validate, lugarController.getLugarById);

router.post('/',
  auth.verifyToken,
  body('nombre').notEmpty().trim(),
  body('latitud').isFloat({ min: -90, max: 90 }),
  body('longitud').isFloat({ min: -180, max: 180 }),
  validate,
  lugarController.createLugar
);

router.put('/:id',
  auth.verifyToken,
  param('id').isInt(),
  body('latitud').optional().isFloat({ min: -90, max: 90 }),
  body('longitud').optional().isFloat({ min: -180, max: 180 }),
  body('estado').optional().isIn(['pendiente', 'activo', 'inactivo']),
  validate,
  lugarController.updateLugar
);

router.delete('/:id',
  auth.verifyToken,
  param('id').isInt(),
  validate,
  lugarController.deleteLugar
);

router.put('/:id/aprobar',
  auth.verifyToken,
  auth.requireAdmin,
  param('id').isInt(),
  validate,
  lugarController.aprobarLugar
);

router.put('/:id/rechazar',
  auth.verifyToken,
  auth.requireAdmin,
  param('id').isInt(),
  validate,
  lugarController.rechazarLugar
);

module.exports = router;
