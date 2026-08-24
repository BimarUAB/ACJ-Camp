import api from './api';

const reportService = {
  getDashboardStats: () => api.get('/reportes/dashboard'),
  getLugaresPopulares: () => api.get('/reportes/lugares-populares'),
  getReservasPorMes: () => api.get('/reportes/reservas-por-mes'),
  getReservasPorZona: () => api.get('/reportes/reservas-por-zona'),
  exportarLugares: () => api.get('/reportes/exportar-lugares', { responseType: 'blob' }),
};

export default reportService;
