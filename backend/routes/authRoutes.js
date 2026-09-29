const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const { rateLimit } = require('express-rate-limit');

const loginRateLimit = rateLimit({
	windowMs: 60 * 1000,
	limit: 5,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: { success: false, error: 'Demasiados intentos. Intente nuevamente en un minuto.' }
});
const validate = (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
	next();
};

router.post('/register',
	body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
	body('email').isEmail().normalizeEmail().withMessage('El correo electrónico no es válido'),
	body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
	validate,
	authController.register
);
router.post('/login',
	loginRateLimit,
	body('email').isEmail().normalizeEmail(),
	body('password').notEmpty(),
	validate,
	authController.login
);
router.get('/iglesias', authController.getIglesias);
router.get('/profile', auth.verifyToken, authController.getProfile);
router.put('/profile', auth.verifyToken, authController.updateProfile);
router.put('/change-password', auth.verifyToken, authController.changePassword);
router.get('/users', auth.verifyToken, auth.requireAdmin, authController.getAllUsers);
router.put('/users/:id', auth.verifyToken, auth.requireAdmin, param('id').isInt(), body('nombre').trim().notEmpty(), body('email').isEmail(), validate, authController.updateUser);
router.put('/users/:id/role', auth.verifyToken, auth.requireAdmin, param('id').isInt(), body('rol').isIn(['lider', 'director', 'admin']), validate, authController.updateUserRole);
router.put('/users/:id/status', auth.verifyToken, auth.requireAdmin, param('id').isInt(), validate, authController.toggleUserStatus);

module.exports = router;
