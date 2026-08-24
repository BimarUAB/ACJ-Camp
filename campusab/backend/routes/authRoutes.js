const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', auth.verifyToken, authController.getProfile);
router.put('/profile', auth.verifyToken, authController.updateProfile);
router.put('/change-password', auth.verifyToken, authController.changePassword);
router.get('/users', auth.verifyToken, auth.requireAdmin, authController.getAllUsers);
router.put('/users/:id/role', auth.verifyToken, auth.requireAdmin, authController.updateUserRole);
router.put('/users/:id/status', auth.verifyToken, auth.requireAdmin, authController.toggleUserStatus);

module.exports = router;
