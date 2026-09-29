import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BuscarLugares from './pages/BuscarLugares';
import DetalleLugar from './pages/DetalleLugar';
import MisReservas from './pages/MisReservas';
import AdminPanel from './pages/AdminPanel';
import GestionClubs from './pages/GestionClubs';
import ProponerLugar from './pages/ProponerLugar';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/buscar" element={<BuscarLugares />} />
          <Route path="/lugar/:id" element={<DetalleLugar />} />
          <Route path="/mis-clubes" element={
            <ProtectedRoute requireDirector>
              <GestionClubs />
            </ProtectedRoute>
          } />
          <Route path="/mis-lugares" element={
            <ProtectedRoute>
              <ProponerLugar />
            </ProtectedRoute>
          } />
          <Route path="/reservas" element={
            <ProtectedRoute>
              <MisReservas />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin>
              <AdminPanel />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
