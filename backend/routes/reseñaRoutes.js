const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const reseñaController = require('../controllers/reseñaController');
const auth = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.get('/', reseñaController.getAllReseñas);

router.post('/',
  auth.verifyToken,
  body('lugar_id').isInt(),
  body('calificacion').isInt({ min: 1, max: 5 }),
  body('comentario').optional().trim(),
  body('reserva_id').optional().isInt(),
  body('fecha_visita').optional().isISO8601(),
  validate,
  reseñaController.createReseña
);

router.put('/:id',
  auth.verifyToken,
  param('id').isInt(),
  body('calificacion').optional().isInt({ min: 1, max: 5 }),
  body('comentario').optional().trim(),
  validate,
  reseñaController.updateReseña
);

router.delete('/:id',
  auth.verifyToken,
  param('id').isInt(),
  validate,
  reseñaController.deleteReseña
);

module.exports = router;
