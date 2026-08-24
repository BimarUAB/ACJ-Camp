import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapPin, Users, Star, Phone, Mail, Calendar, ChevronLeft } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import lugarService from '../services/lugarService';
import reservaService from '../services/reservaService';
import reseñaService from '../services/reseñaService';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import StarRating from '../components/StarRating';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function DetalleLugar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [lugar, setLugar] = useState(null);
  const [reseñas, setReseñas] = useState([]);
  const [reservasLugar, setReservasLugar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [proposito, setProposito] = useState('');
  const [reservando, setReservando] = useState(false);
  const [reservaError, setReservaError] = useState('');
  const [reservaSuccess, setReservaSuccess] = useState('');

  const [calificacion, setCalificacion] = useState(0);
  const [comentario, setComentario] = useState('');
  const [reseñaError, setReseñaError] = useState('');
  const [reseñaSuccess, setReseñaSuccess] = useState('');

  const cargar = async () => {
    try {
      setLoading(true);
      setError('');
      const [lugarRes, reseñasRes] = await Promise.all([
        lugarService.getById(id),
        reseñaService.getAll({ lugar_id: id })
      ]);
      setLugar(lugarRes.data?.lugar || lugarRes.data);
      setReseñas(reseñasRes.data?.reseñas || reseñasRes.data || []);

      if (isAuthenticated) {
        const reservasRes = await reservaService.getByLugar(id);
        setReservasLugar(reservasRes.data?.reservas || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar el lugar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [id, isAuthenticated]);

  const reservar = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      setReservando(true);
      setReservaError('');
      setReservaSuccess('');
      await reservaService.create({
        lugar_id: Number(id),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        proposito
      });
      setReservaSuccess('Reserva creada exitosamente. Pendiente de confirmación.');
      const reservasRes = await reservaService.getByLugar(id);
      setReservasLugar(reservasRes.data?.reservas || []);
      setFechaInicio('');
      setFechaFin('');
      setProposito('');
    } catch (err) {
      setReservaError(err.response?.data?.error || 'Error al crear la reserva');
    } finally {
      setReservando(false);
    }
  };

  const enviarReseña = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      setReseñaError('');
      setReseñaSuccess('');
      await reseñaService.create({
        lugar_id: Number(id),
        calificacion,
        comentario
      });
      setReseñaSuccess('Reseña publicada exitosamente.');
      setCalificacion(0);
      setComentario('');
      const reseñasRes = await reseñaService.getAll({ lugar_id: id });
      setReseñas(reseñasRes.data?.reseñas || []);
    } catch (err) {
      setReseñaError(err.response?.data?.error || 'Error al publicar la reseña');
    }
  };

  if (loading) return <Loading message="Cargando lugar..." />;
  if (error) return <div className="p-8"><ErrorMessage message={error} onRetry={cargar} /></div>;
  if (!lugar) return <div className="p-8 text-center text-slate-500">Lugar no encontrado.</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/buscar" className="mb-4 inline-flex items-center gap-1 text-sm text-adventista-azul hover:underline">
        <ChevronLeft className="h-4 w-4" /> Volver a lugares
      </Link>

      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{lugar.nombre}</h1>
            <p className="mt-2 flex items-center gap-1 text-slate-600">
              <MapPin className="h-4 w-4" /> {lugar.direccion || 'Sin dirección'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${
            lugar.estado === 'activo' ? 'bg-green-100 text-green-700' :
            lugar.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {lugar.estado}
          </span>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800">Detalles del lugar</h2>
            <p className="text-sm text-slate-600">{lugar.descripcion || 'Sin descripción'}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-500">Capacidad</p>
                <p className="font-semibold text-slate-900 flex items-center gap-1"><Users className="h-4 w-4" /> {lugar.capacidad_maxima || 'N/D'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-500">Precio aprox.</p>
                <p className="font-semibold text-slate-900">{lugar.precio_aprox ? `Bs. ${lugar.precio_aprox}` : 'N/D'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-500">Calificación</p>
                <p className="font-semibold text-slate-900 flex items-center gap-1">
                  <Star className="h-4 w-4 fill-adventista-dorado text-adventista-dorado" />
                  {lugar.promedio_calificacion ? Number(lugar.promedio_calificacion).toFixed(1) : 'Sin reseñas'} ({lugar.total_reseñas})
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-500">Contacto</p>
                <p className="font-semibold text-slate-900 flex items-center gap-1">
                  <Phone className="h-4 w-4" /> {lugar.telefono || 'N/D'}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Servicios</p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(lugar.servicios) && lugar.servicios.length > 0 ? (
                  lugar.servicios.map((s) => (
                    <span key={s} className="rounded-full bg-adventista-azul/10 px-3 py-1 text-xs font-medium capitalize text-adventista-azul">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Sin servicios registrados</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
            <MapContainer center={[lugar.latitud, lugar.longitud]} zoom={13} scrollWheelZoom={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              <Marker position={[lugar.latitud, lugar.longitud]}>
                <Popup>{lugar.nombre}</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Calendar className="h-5 w-5 text-adventista-azul" /> Reservar este lugar
          </h2>
          {!isAuthenticated ? (
            <p className="text-slate-600">
              <Link to="/login" className="text-adventista-azul underline">Inicia sesión</Link> para reservar.
            </p>
          ) : (
            <form onSubmit={reservar} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Desde</label>
                  <input
                    type="date"
                    required
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Hasta</label>
                  <input
                    type="date"
                    required
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Propósito</label>
                <input
                  value={proposito}
                  onChange={(e) => setProposito(e.target.value)}
                  placeholder="Campamento, caminata, retiro..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              {reservaError && <p className="text-sm text-red-600">{reservaError}</p>}
              {reservaSuccess && <p className="text-sm text-green-600">{reservaSuccess}</p>}
              <button
                type="submit"
                disabled={reservando}
                className="w-full rounded-lg bg-adventista-azul py-2 font-semibold text-white hover:bg-adventista-azul/90 disabled:opacity-50"
              >
                {reservando ? 'Reservando...' : 'Solicitar reserva'}
              </button>
            </form>
          )}

          {reservasLugar.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 font-semibold text-slate-800">Reservas confirmadas próximas</h3>
              <ul className="space-y-2">
                {reservasLugar.slice(0, 5).map((r) => (
                  <li key={r.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                    {r.fecha_inicio} → {r.fecha_fin} <span className="ml-2 inline-block rounded bg-adventista-dorado/20 px-2 py-0.5 text-xs">{r.estado}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Reseñas</h2>
          {reseñas.length === 0 ? (
            <p className="text-slate-500">Aún no hay reseñas para este lugar.</p>
          ) : (
            <div className="space-y-4">
              {reseñas.map((r) => (
                <div key={r.id} className="border-b border-slate-100 pb-4 last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{r.usuario_nombre}</p>
                    <StarRating rating={r.calificacion} size={14} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{r.comentario || 'Sin comentario'}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}

          {isAuthenticated && (
            <form onSubmit={enviarReseña} className="mt-6 rounded-xl bg-slate-50 p-4">
              <h3 className="mb-2 font-semibold text-slate-800">Escribir reseña</h3>
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700">Calificación</label>
                <div className="mt-1">
                  <StarRating rating={calificacion} interactive onChange={setCalificacion} />
                </div>
              </div>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Comparte tu experiencia..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                rows={3}
              />
              {reseñaError && <p className="mt-2 text-sm text-red-600">{reseñaError}</p>}
              {reseñaSuccess && <p className="mt-2 text-sm text-green-600">{reseñaSuccess}</p>}
              <button
                type="submit"
                className="mt-3 w-full rounded-lg bg-adventista-dorado py-2 font-semibold text-slate-900 hover:bg-adventista-dorado/90"
              >
                Publicar reseña
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
