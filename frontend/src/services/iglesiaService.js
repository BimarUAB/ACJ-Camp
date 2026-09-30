import api from './api';

const iglesiaService = {
  create: (data) => api.post('/iglesias', data),
  delete: (id) => api.delete(`/iglesias/${id}`),
};

export default iglesiaService;