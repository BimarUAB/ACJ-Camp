import api from './api';

const reseñaService = {
  getAll: (params = {}) => api.get('/resenas', { params }),
  create: (data) => api.post('/resenas', data),
  update: (id, data) => api.put(`/resenas/${id}`, data),
  delete: (id) => api.delete(`/resenas/${id}`),
};

export default reseñaService;
