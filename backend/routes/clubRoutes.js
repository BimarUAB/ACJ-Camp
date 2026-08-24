const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const clubController = require('../controllers/clubController');
const auth = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.get('/', auth.verifyToken, clubController.getAllClubs);
router.get('/:id', auth.verifyToken, param('id').isInt(), validate, clubController.getClubById);

router.post('/',
  auth.verifyToken,
  auth.requireDirectorOrAdmin,
  body('nombre').notEmpty().trim(),
  body('tipo').isIn(['conquistadores', 'aventureros', 'ja']),
  body('iglesia_id').isInt(),
  validate,
  clubController.createClub
);

router.put('/:id',
  auth.verifyToken,
  param('id').isInt(),
  body('nombre').optional().trim(),
  body('tipo').optional().isIn(['conquistadores', 'aventureros', 'ja']),
  body('iglesia_id').optional().isInt(),
  validate,
  clubController.updateClub
);

router.delete('/:id',
  auth.verifyToken,
  param('id').isInt(),
  validate,
  clubController.deleteClub
);

module.exports = router;
