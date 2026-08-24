import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, CalendarRange, MapPinned, Star, Users, MapPin, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import lugarService from '../services/lugarService';
import reservaService from '../services/reservaService';
import reportService from '../services/reportService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

export default function Dashboard() {
  const { user, isAdmin, isDirector } = useAuth();
  const [lugares, setLugares] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError('');
      const [lugRes, resRes] = await Promise.all([
        lugarService.getAll({ estado: 'activo', limit: 3 }),
        reservaService.getMisReservas()
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
  }, []);

  if (loading) return <Loading message="Cargando dashboard..." />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="rounded-3xl bg-gradient-to-r from-adventista-azul to-slate-800 p-8 text-white shadow-xl">
        <p className="mb-2 text-sm uppercase tracking-[0.3em] text-slate-200">ACJ-Camp</p>
        <h1 className="text-3xl font-bold">Hola, {user?.nombre || 'líder'} 👋</h1>
        <p className="mt-3 max-w-2xl text-slate-200">
          Encuentra lugares de campamento, gestiona tus reservas y comparte reseñas con otros clubes adventistas.
        </p>
      </div>

      {error && <div className="mt-6"><ErrorMessage message={error} onRetry={cargarDatos} /></div>}

      {isAdmin() && stats && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Lugares</p>
            <p className="text-2xl font-bold text-adventista-azul">{stats.total_lugares}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Reservas</p>
            <p className="text-2xl font-bold text-adventista-azul">{stats.total_reservas}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Usuarios</p>
            <p className="text-2xl font-bold text-adventista-azul">{stats.total_usuarios}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Pendientes</p>
            <p className="text-2xl font-bold text-adventista-rojo">{stats.lugares_pendientes}</p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Link to="/buscar" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
          <div className="mb-4 inline-flex rounded-full bg-adventista-dorado/20 p-3 text-adventista-azul">
            <Compass className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Explorar lugares</h2>
          <p className="mt-2 text-sm text-slate-600">Busca campings cercanos con filtros por servicios y distancia.</p>
        </Link>
        <Link to="/reservas" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
          <div className="mb-4 inline-flex rounded-full bg-adventista-dorado/20 p-3 text-adventista-azul">
            <CalendarRange className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Mis reservas</h2>
          <p className="mt-2 text-sm text-slate-600">Gestiona tus solicitudes y revisa fechas confirmadas.</p>
        </Link>
        <Link to="/buscar" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
          <div className="mb-4 inline-flex rounded-full bg-adventista-dorado/20 p-3 text-adventista-azul">
            <MapPinned className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Mapa interactivo</h2>
          <p className="mt-2 text-sm text-slate-600">Visualiza ubicaciones y distancias desde tu iglesia.</p>
        </Link>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Lugares destacados</h2>
            <Link to="/buscar" className="text-sm font-medium text-adventista-azul hover:underline">Ver todos</Link>
          </div>
          <div className="space-y-4">
            {lugares.slice(0, 3).map((lugar) => (
              <Link key={lugar.id} to={`/lugar/${lugar.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{lugar.nombre}</h3>
                    <p className="mt-1 text-sm text-slate-500">{lugar.direccion}</p>
                    <p className="mt-1 text-sm text-slate-600">Capacidad: {lugar.capacidad_maxima} personas</p>
                  </div>
                  {lugar.promedio_calificacion > 0 && (
                    <div className="flex items-center gap-1 text-sm font-medium text-adventista-dorado">
                      <Star className="h-4 w-4 fill-adventista-dorado" />
                      {Number(lugar.promedio_calificacion).toFixed(1)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
            {lugares.length === 0 && <p className="text-slate-500">No hay lugares activos aún.</p>}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Mis próximas reservas</h2>
            <Link to="/reservas" className="text-sm font-medium text-adventista-azul hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-4">
            {reservas.slice(0, 3).map((reserva) => (
              <div key={reserva.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-900">{reserva.lugar_nombre || `Lugar #${reserva.lugar_id}`}</p>
                <p className="mt-1 text-sm text-slate-600">{reserva.fecha_inicio} → {reserva.fecha_fin}</p>
                <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                  {reserva.estado}
                </span>
              </div>
            ))}
            {reservas.length === 0 && <p className="text-slate-500">Aún no tienes reservas.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
