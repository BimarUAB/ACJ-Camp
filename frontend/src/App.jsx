import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ExplorarCampamentos from './pages/ExplorarCampamentos';
import BuscarLugares from './pages/BuscarLugares';
import DetalleLugar from './pages/DetalleLugar';
import MisReservas from './pages/MisReservas';
import AdminPanel from './pages/AdminPanel';
import GestionClubs from './pages/GestionClubs';
import ProponerLugar from './pages/ProponerLugar';
import { LocationProvider } from './context/LocationContext';
import LocationPrompt from './components/LocationPrompt';
import MiPerfil from './pages/MiPerfil';

function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <LocationPrompt />
        <div className="min-h-screen bg-[var(--camp-paper)]">
          <Navbar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/mi-perfil" element={
              <ProtectedRoute>
                <MiPerfil />
              </ProtectedRoute>
            } />
            <Route path="/buscar" element={<ExplorarCampamentos />} />
            <Route path="/mapa" element={<BuscarLugares />} />
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
      </LocationProvider>
    </AuthProvider>
  );
}

export default App;
