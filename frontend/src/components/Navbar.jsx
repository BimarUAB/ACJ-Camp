import { Link, useNavigate } from 'react-router-dom';
import { Compass, Map, CalendarDays, LogOut, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const nombreUsuario = user?.nombre?.trim() || 'Usuario';
  const iniciales = nombreUsuario.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toLocaleUpperCase('es');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="camp-site-header border-b border-white/10 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <Link to="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-semibold">
          <img src="/logo-acj-camp.png" alt="" className="h-10 w-10 rounded-full bg-white object-contain" />
          ACJ-Camp
        </Link>
        {isAuthenticated && user && (
          <Link
            to="/mi-perfil"
            title={`Hola, ${nombreUsuario} · Sesión activa`}
            className="flex min-w-0 items-center gap-2 py-1 transition-colors hover:text-adventista-dorado focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span aria-hidden="true" className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 text-xs font-bold text-white">
              {iniciales}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--camp-forest)] bg-emerald-400" />
            </span>
            <span className="min-w-0 sm:max-w-40">
              <span className="block truncate text-sm font-semibold">Hola, {nombreUsuario}</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-200">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Sesión activa
              </span>
            </span>
          </Link>
        )}
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm sm:justify-end">
          <Link to="/buscar" className="flex items-center gap-1 hover:text-adventista-dorado">
            <Compass className="h-4 w-4" /> Explorar
          </Link>
          <Link to="/mapa" className="flex items-center gap-1 hover:text-adventista-dorado">
            <Map className="h-4 w-4" /> Ver mapa
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
