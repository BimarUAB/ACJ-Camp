import api from './api';

const authService = {
  getIglesias: () => api.get('/auth/iglesias'),
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  getAllUsers: (params = {}) => api.get('/auth/users', { params }),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  updateUserRole: (id, rol) => api.put(`/auth/users/${id}/role`, { rol }),
  toggleUserStatus: (id) => api.put(`/auth/users/${id}/status`),
};

export default authService;
