const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const reservaController = require('../controllers/reservaController');
const auth = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.get('/mis', auth.verifyToken, reservaController.getMyReservas);
router.post('/:id/confirmar-lugar', auth.verifyToken, param('id').isInt(), validate, reservaController.confirmarConLugar);
router.get('/lugar/:id', param('id').isInt(), validate, reservaController.getReservasByLugar);

router.get('/',
  auth.verifyToken,
  auth.requireAdmin,
  query('lugar_id').optional().isInt(),
  query('club_id').optional().isInt(),
  query('estado').optional().isIn(['pendiente', 'confirmada', 'cancelada', 'completada']),
  validate,
  reservaController.getAllReservas
);

router.post('/',
  auth.verifyToken,
  body('lugar_id').isInt(),
  body('fecha_inicio').isISO8601(),
  body('fecha_fin').isISO8601(),
  body('proposito').trim().notEmpty().isLength({ max: 100 }),
  validate,
  reservaController.createReserva
);

router.put('/:id',
  auth.verifyToken,
  param('id').isInt(),
  body('lugar_id').optional().isInt(),
  body('fecha_inicio').optional().isISO8601(),
  body('fecha_fin').optional().isISO8601(),
  body('estado').optional().isIn(['pendiente', 'confirmada', 'cancelada', 'completada']),
  validate,
  reservaController.updateReserva
);

router.delete('/:id',
  auth.verifyToken,
  param('id').isInt(),
  validate,
  reservaController.deleteReserva
);

module.exports = router;
