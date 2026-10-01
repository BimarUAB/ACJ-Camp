const express = require('express');
const { body, validationResult } = require('express-validator');
const { rateLimit } = require('express-rate-limit');
const mapaController = require('../controllers/mapaController');
const auth = require('../middleware/auth');

const router = express.Router();

const overpassRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Se hicieron muchas consultas al mapa. Espera un minuto para actualizar los puntos.' },
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

router.get('/campings-osm', overpassRateLimit, mapaController.getCampsites);
router.get('/iglesias-adventistas', auth.verifyToken, auth.requireAdmin, overpassRateLimit, mapaController.getAdventistChurches);
router.post('/iglesias-adventistas/importar',
  auth.verifyToken,
  auth.requireAdmin,
  body('osm_ids').isArray({ min: 1, max: 250 }),
  body('osm_ids.*').isString().isLength({ min: 3, max: 40 }),
  validate,
  mapaController.importAdventistChurches
);

module.exports = router;