const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const lugarController = require('../controllers/lugarController');
const auth = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.get('/', lugarController.getAllLugares);
router.get('/pendientes', auth.verifyToken, auth.requireAdmin, lugarController.getLugaresPendientes);
router.get('/:id', param('id').isInt(), lugarController.getLugarById);

router.post('/',
  auth.verifyToken,
  body('nombre').notEmpty().trim(),
  body('latitud').isFloat(),
  body('longitud').isFloat(),
  validate,
  lugarController.createLugar
);

router.put('/:id',
  auth.verifyToken,
  param('id').isInt(),
  body('latitud').optional().isFloat(),
  body('longitud').optional().isFloat(),
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

module.exports = router;
