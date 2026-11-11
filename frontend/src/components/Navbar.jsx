import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Compass, Map, CalendarDays, LogOut, LogIn, ShieldCheck, UserRound, Home, MapPin, Users, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  const nombreUsuario = user?.nombre?.trim() || 'Usuario';
  const iniciales = nombreUsuario.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toLocaleUpperCase('es');
  const enlaces = [
    { to: '/', label: 'Inicio', icon: Home },
    { to: '/buscar', label: 'Explorar', icon: Compass },
    { to: '/mapa', label: 'Ver mapa', icon: Map },
    { to: '/reservas', label: 'Reservas', icon: CalendarDays },
    ...(user ? [
      { to: '/mi-perfil', label: 'Mi perfil', icon: UserRound },
      { to: '/mis-lugares', label: 'Mis lugares', icon: MapPin },
    ] : []),
    ...(user?.rol === 'director' ? [{ to: '/mis-clubes', label: 'Iglesias y clubes', icon: Users }] : []),
    ...(user?.rol === 'admin' ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="camp-site-header border-b border-white/10 text-white shadow-md">
      <div className="camp-nav-shell">
        <div className="camp-nav-identity">
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
        <button ref={menuButton} type="button" className="camp-nav-toggle" aria-expanded={menuOpen} aria-controls="camp-navigation" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <nav id="camp-navigation" aria-label="Navegación principal" className={`camp-nav-links${menuOpen ? ' is-open' : ''}`} onKeyDown={(event) => {
          if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); }
        }}>
          {enlaces.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `camp-nav-link${isActive ? ' is-active' : ''}`}>
              <Icon size={16} aria-hidden="true" />{label}
            </NavLink>
          ))}
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
