const express = require('express');
const { query, validationResult } = require('express-validator');
const postgrestController = require('../controllers/postgrestController');

const router = express.Router();

router.get('/lugares-cercanos',
  query('lat').isFloat({ min: -90, max: 90 }),
  query('lng').isFloat({ min: -180, max: 180 }),
  query('radio').optional().isFloat({ min: 0.1, max: 5000 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  },
  postgrestController.getLugaresCercanos
);

module.exports = router;