const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');

router.get('/dashboard', auth.verifyToken, auth.requireAdmin, reportController.getDashboardStats);
router.get('/lugares-populares', auth.verifyToken, auth.requireAdmin, reportController.getLugaresPopulares);
router.get('/reservas-por-mes', auth.verifyToken, auth.requireAdmin, reportController.getReservasPorMes);
router.get('/reservas-por-zona', auth.verifyToken, auth.requireAdmin, reportController.getReservasPorZona);
router.get('/exportar-lugares', auth.verifyToken, auth.requireAdmin, reportController.exportarLugaresExcel);

module.exports = router;
