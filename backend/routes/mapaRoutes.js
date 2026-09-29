const express = require('express');
const { rateLimit } = require('express-rate-limit');
const mapaController = require('../controllers/mapaController');

const router = express.Router();

const overpassRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Se hicieron muchas consultas al mapa. Espera un minuto para actualizar los puntos.' },
});

router.get('/campings-osm', overpassRateLimit, mapaController.getCampsites);

module.exports = router;