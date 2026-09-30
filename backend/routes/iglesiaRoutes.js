const express = require('express');
const { body, param, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const iglesiaController = require('../controllers/iglesiaController');

const router = express.Router();
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

router.post('/',
  auth.verifyToken,
  auth.requireRole('director'),
  body('nombre').trim().notEmpty().isLength({ max: 200 }),
  body('direccion').optional({ values: 'null' }).isString().isLength({ max: 500 }),
  body('zona').optional({ values: 'null' }).isString().isLength({ max: 100 }),
  body('distrito').optional({ values: 'null' }).isString().isLength({ max: 100 }),
  body('latitud').isFloat({ min: -90, max: 90 }),
  body('longitud').isFloat({ min: -180, max: 180 }),
  validate,
  iglesiaController.createIglesia
);

router.delete('/:id',
  auth.verifyToken,
  auth.requireAdmin,
  param('id').isInt(),
  validate,
  iglesiaController.deleteIglesia
);

module.exports = router;