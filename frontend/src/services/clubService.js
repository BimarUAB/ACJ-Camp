import api from './api';

const clubService = {
  getAll: (params = {}) => api.get('/clubs', { params }),
  getDirectory: () => api.get('/clubs/directorio'),
  getById: (id) => api.get(`/clubs/${id}`),
  create: (data) => api.post('/clubs', data),
  update: (id, data) => api.put(`/clubs/${id}`, data),
  delete: (id) => api.delete(`/clubs/${id}`),
  getLeaders: (id) => api.get(`/clubs/${id}/lideres`),
  addLeader: (id, liderId) => api.post(`/clubs/${id}/lideres`, { lider_id: liderId }),
  removeLeader: (id, liderId) => api.delete(`/clubs/${id}/lideres/${liderId}`),
};

export default clubService;
