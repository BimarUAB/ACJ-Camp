import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');

      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        const response = await authService.getProfile();
        const profileUser = response?.data?.user;
        setUser(profileUser || null);
        setToken(storedToken);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error verificando autenticación:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const persistAuth = (authData) => {
    const { token: authToken, user: authUser } = authData;
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(authUser));
    setToken(authToken);
    setUser(authUser);
    setIsAuthenticated(true);
  };

  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password);
      persistAuth(response.data);
      return { success: true, user: response.data.user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al iniciar sesión',
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      persistAuth(response.data);
      return { success: true, user: response.data.user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al registrar usuario',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const updateUser = (updatedUser) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
    localStorage.setItem('user', JSON.stringify({ ...user, ...updatedUser }));
  };

  const hasRole = (...roles) => Boolean(user && roles.includes(user.rol));
  const isAdmin = () => user?.rol === 'admin';
  const isDirector = () => user?.rol === 'director' || user?.rol === 'admin';
  const isLider = () => user?.rol === 'lider' || user?.rol === 'director' || user?.rol === 'admin';

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
    hasRole,
    isAdmin,
    isDirector,
    isLider,
  }), [user, token, loading, isAuthenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
