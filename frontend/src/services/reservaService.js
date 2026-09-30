import api from './api';

const reservaService = {
  getAll: (params = {}) => api.get('/reservas', { params }),
  getMisReservas: () => api.get('/reservas/mis'),
  confirmarConLugar: (id) => api.post(`/reservas/${id}/confirmar-lugar`),
  getByLugar: (lugarId) => api.get(`/reservas/lugar/${lugarId}`),
  create: (data) => api.post('/reservas', data),
  update: (id, data) => api.put(`/reservas/${id}`, data),
  delete: (id) => api.delete(`/reservas/${id}`),
};

export default reservaService;
