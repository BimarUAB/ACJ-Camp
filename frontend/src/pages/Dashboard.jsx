import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarRange, Compass, MapPin, MapPinned, Search, Star, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import lugarService from '../services/lugarService';
import reservaService from '../services/reservaService';
import reportService from '../services/reportService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import HeroGallery from '../components/HeroGallery';

const FALLBACK_HERO_IMAGE = 'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?auto=format&fit=crop&w=1800&q=85';
const FALLBACK_PLACE_IMAGES = [
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
];

const obtenerFoto = (lugar) => {
  if (Array.isArray(lugar.fotos)) return lugar.fotos[0] || '';
  if (typeof lugar.fotos === 'string') {
    try {
      const fotos = JSON.parse(lugar.fotos);
      return Array.isArray(fotos) ? fotos[0] || '' : fotos;
    } catch {
      return lugar.fotos;
    }
  }
  return '';
};

export default function Dashboard() {
  const { isAdmin, isAuthenticated } = useAuth();
  const [lugares, setLugares] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const navigate = useNavigate();
  const fotoPortada = lugares.map(obtenerFoto).find(Boolean) || FALLBACK_HERO_IMAGE;

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError('');
      const [lugRes, resRes] = await Promise.all([
        lugarService.getAll({ estado: 'activo', limit: 3 }),
        isAuthenticated ? reservaService.getMisReservas() : Promise.resolve({ data: { reservas: [] } })
      ]);
      setLugares(lugRes.data?.lugares || lugRes.data || []);
      setReservas(resRes.data?.reservas || resRes.data || []);

      if (isAdmin()) {
        const statsRes = await reportService.getDashboardStats();
        setStats(statsRes.data?.stats || null);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [isAuthenticated]);

  const accesos = [
    { to: '/buscar', title: 'Explorar campamentos', description: 'Encuentra lugares por zona, servicios y distancia.', icon: Compass },
    ...(isAuthenticated ? [{ to: '/mis-lugares', title: 'Mis lugares', description: 'Propón un nuevo destino o actualiza los tuyos.', icon: MapPin }] : []),
    { to: '/reservas', title: 'Mis reservas', description: 'Revisa tus solicitudes y próximas fechas.', icon: CalendarRange },
    { to: '/mapa', title: 'Mapa interactivo', description: 'Descubre sitios registrados y puntos cercanos.', icon: MapPinned },
  ];

  if (loading) return <Loading message="Cargando dashboard..." />;

  return (
    <main className="dashboard-page camp-home">
      <div className="dashboard-container">
        <section className="dashboard-hero">
          <HeroGallery fallbackImage={fotoPortada} />
          <div className="dashboard-hero__copy">
            <h1>Tu próxima aventura{' '}<br /><span>empieza aquí.</span></h1>
            <p>Encuentra campamentos en Bolivia, explora el mapa y organiza tu próxima salida con tu club.</p>
            <form className="camp-home-search" role="search" onSubmit={(event) => {
              event.preventDefault();
              navigate(`/buscar${busqueda.trim() ? `?busqueda=${encodeURIComponent(busqueda.trim())}` : ''}`);
            }}>
              <MapPin size={22} aria-hidden="true" />
              <label htmlFor="home-search" className="sr-only">Nombre o localidad del campamento</label>
              <input id="home-search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="¿Dónde quieres acampar?" />
              <button type="submit"><Search size={18} aria-hidden="true" /><span>Explorar</span></button>
            </form>
            <Link to="/mapa" className="camp-home-map-link">Prefiero explorar en el mapa <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
        </section>

        {error && <div className="mt-6"><ErrorMessage message={error} onRetry={cargarDatos} /></div>}

        {isAdmin() && stats && (
          <section className="dashboard-stats" aria-label="Resumen administrativo">
            <div className="dashboard-stat"><span>Lugares registrados</span><strong>{stats.total_lugares}</strong></div>
            <div className="dashboard-stat"><span>Reservas</span><strong>{stats.total_reservas}</strong></div>
            <div className="dashboard-stat"><span>Usuarios</span><strong>{stats.total_usuarios}</strong></div>
            <div className="dashboard-stat dashboard-stat--pending"><span>Lugares pendientes</span><strong>{stats.lugares_pendientes}</strong></div>
          </section>
        )}

        <section className="camp-home-tools" aria-label="Organiza tu salida">
          <div className="dashboard-shortcut-grid">
            {accesos.map(({ to, title, description, icon: Icon }) => (
              <Link key={title} to={to} className="dashboard-shortcut">
                <span className="dashboard-shortcut__icon"><Icon size={20} aria-hidden="true" /></span>
                <span className="dashboard-shortcut__body"><h3>{title}</h3><p>{description}</p></span>
                <ArrowUpRight className="dashboard-shortcut__arrow" size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <div className="dashboard-section dashboard-content-grid">
          <section>
            <div className="dashboard-section-heading">
              <div><h2>Encuentra tu próximo destino</h2><p className="camp-section-description">Campamentos registrados para disfrutar con tu club.</p></div>
              <Link to="/buscar" className="dashboard-section-link">Ver todos <ArrowUpRight size={15} /></Link>
            </div>
            {lugares.length > 0 ? (
              <div className="dashboard-place-grid">
                {lugares.slice(0, 3).map((lugar, index) => (
                  <Link key={lugar.id} to={`/lugar/${lugar.id}`} className="dashboard-place-card">
                    <div className="dashboard-place-card__image">
                      <img src={obtenerFoto(lugar) || FALLBACK_PLACE_IMAGES[index % FALLBACK_PLACE_IMAGES.length]} alt={`Paisaje de ${lugar.nombre}`} loading="lazy" />
                      <span>{lugar.capacidad_maxima ? `${lugar.capacidad_maxima} personas` : 'Campamento'}</span>
                    </div>
                    <div className="dashboard-place-card__body">
                      <h3>{lugar.nombre}</h3>
                      <p>{lugar.direccion || 'Bolivia'}</p>
                    <div className="dashboard-place-card__meta">
                        <span><Users size={14} aria-hidden="true" />{lugar.capacidad_maxima ? `Hasta ${lugar.capacidad_maxima} personas` : 'Capacidad por consultar'}</span>
                        {Number(lugar.promedio_calificacion) > 0 && <span><Star size={13} fill="currentColor" /> {Number(lugar.promedio_calificacion).toFixed(1)}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <p className="dashboard-empty">No hay lugares activos para mostrar todavía.</p>}
          </section>

          <section className="camp-home-agenda">
            <div className="dashboard-section-heading">
              <div><h2>Próximas reservas</h2></div>
              <Link to="/reservas" className="dashboard-section-link">Ver todas <ArrowUpRight size={15} /></Link>
            </div>
            {reservas.length > 0 ? (
              <div className="dashboard-reservations">
                {reservas.slice(0, 3).map((reserva) => (
                  <div key={reserva.id} className="dashboard-reservation">
                    <span className="dashboard-reservation__icon"><CalendarRange size={16} /></span>
                    <div className="dashboard-reservation__body">
                      <strong>{reserva.lugar_nombre || `Lugar #${reserva.lugar_id}`}</strong>
                      <p>{reserva.fecha_inicio} · {reserva.fecha_fin} · {reserva.estado}</p>
                      <p>{reserva.club_nombre || 'Sin club'} · {reserva.proposito || 'Sin motivo'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="dashboard-agenda-empty"><CalendarRange size={30} strokeWidth={1.4} aria-hidden="true" /><p>Aún no tienes reservas. Cuando planifiques una salida, aparecerá aquí.</p><Link to="/buscar">Explorar campamentos <ArrowRight size={15} aria-hidden="true" /></Link></div>}
          </section>
        </div>
      </div>
    </main>
  );
}
