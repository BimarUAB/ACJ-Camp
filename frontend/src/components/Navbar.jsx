import { Link, useNavigate } from 'react-router-dom';
import { MapPin, CalendarDays, LogOut, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="camp-site-header border-b border-white/10 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
          <img src="/logo-acj-camp.png" alt="" className="h-10 w-10 rounded-full bg-white object-contain" />
          ACJ-Camp
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm sm:justify-end">
          <Link to="/buscar" className="flex items-center gap-1 hover:text-adventista-dorado">
            <MapPin className="h-4 w-4" /> Buscar
          </Link>
          <Link to="/reservas" className="flex items-center gap-1 hover:text-adventista-dorado">
            <CalendarDays className="h-4 w-4" /> Reservas
          </Link>
          {user && <Link to="/mi-perfil" className="flex items-center gap-1 hover:text-adventista-dorado"><UserRound className="h-4 w-4" /> Mi perfil</Link>}
          {user && <Link to="/mis-lugares" className="flex items-center gap-1 hover:text-adventista-dorado">Mis lugares</Link>}
          {user?.rol === 'director' && (
            <>
              <Link to="/mis-clubes" className="flex items-center gap-1 hover:text-adventista-dorado">Iglesias y clubes</Link>
            </>
          )}
          {user?.rol === 'admin' && (
            <Link to="/admin" className="flex items-center gap-1 hover:text-adventista-dorado">
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
          )}
          {user ? (
            <button onClick={handleLogout} className="flex items-center gap-1 rounded bg-white/10 px-3 py-2 hover:bg-white/20">
              <LogOut className="h-4 w-4" /> Salir
            </button>
          ) : (
            <Link to="/login" className="flex items-center gap-1 rounded bg-adventista-dorado px-3 py-2 font-medium text-slate-900">
              <LogIn className="h-4 w-4" /> Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
