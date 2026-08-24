import api from './api';

const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  getAllUsers: (params = {}) => api.get('/auth/users', { params }),
  updateUserRole: (id, rol) => api.put(`/auth/users/${id}/role`, { rol }),
  toggleUserStatus: (id) => api.put(`/auth/users/${id}/status`),
};

export default authService;
