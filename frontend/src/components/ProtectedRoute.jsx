import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <Loading message="Verificando sesión..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireAdmin && user?.rol !== 'admin') return <Navigate to="/" replace />;

  return children;
}
