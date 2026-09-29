import api from './api';

const lugarService = {
  getAll: (params = {}) => api.get('/lugares', { params }),
  getMisLugares: () => api.get('/lugares/mis'),
  getById: (id) => api.get(`/lugares/${id}`),
  create: (data) => api.post('/lugares', data),
  update: (id, data) => api.put(`/lugares/${id}`, data),
  delete: (id) => api.delete(`/lugares/${id}`),
  getPendientes: () => api.get('/lugares/pendientes'),
  aprobar: (id) => api.put(`/lugares/${id}/aprobar`),
  rechazar: (id) => api.put(`/lugares/${id}/rechazar`),
};

export default lugarService;
