import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import AvailabilityCalendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
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
import ServicioIcono from '../components/ServicioIcono';
import uploadService from '../services/uploadService';
import clubService from '../services/clubService';
import ClimaLugar from '../components/ClimaLugar';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const fechaComoClave = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fechaReservaComoClave = (date) => String(date).slice(0, 10);
const reservaOcupaFecha = (reserva) => ['confirmada', 'completada'].includes(reserva.estado);
const normalizarFotos = (value) => {
  let fotos = value;
  if (typeof fotos === 'string') {
    try {
      fotos = JSON.parse(fotos);
    } catch {
      fotos = [fotos];
    }
  }
  if (!Array.isArray(fotos)) fotos = fotos ? [fotos] : [];
  return fotos
    .map((foto) => typeof foto === 'string' ? foto : foto?.secure_url || foto?.url)
    .filter((url) => typeof url === 'string' && /^(https?:\/\/|\/uploads\/)/i.test(url));
};

const obtenerListaReseñas = (data) => {
  const lista = data?.resenas ?? data?.reseñas ?? data;
  return Array.isArray(lista) ? lista : [];
};

export default function DetalleLugar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [lugar, setLugar] = useState(null);
  const [reseñas, setReseñas] = useState([]);
  const [reservasLugar, setReservasLugar] = useState([]);
  const [clubesUsuario, setClubesUsuario] = useState([]);
  const [clubReservaId, setClubReservaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [proposito, setProposito] = useState('');
  const [reservando, setReservando] = useState(false);
  const [reservaError, setReservaError] = useState('');
  const [reservaSuccess, setReservaSuccess] = useState('');

  const [calificacion, setCalificacion] = useState(0);
  const [fotosReseña, setFotosReseña] = useState([]);
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const [comentario, setComentario] = useState(null);
  const [reseñaError, setReseñaError] = useState('');
  const [reseñaSuccess, setReseñaSuccess] = useState('');

  const cargar = async () => {
    try {
      setLoading(true);
      setError('');
      const [lugarRes, reseñasRes, clubesRes] = await Promise.all([
        lugarService.getById(id),
        reseñaService.getAll({ lugar_id: id }),
        isAuthenticated ? clubService.getAll() : Promise.resolve({ data: { clubs: [] } })
      ]);
      setLugar(lugarRes.data?.lugar || lugarRes.data);
      const listaReseñas = obtenerListaReseñas(reseñasRes.data);
      setReseñas(listaReseñas);
      const clubes = clubesRes.data?.clubs || [];
      setClubesUsuario(clubes);
      setClubReservaId((actual) => actual || (clubes[0]?.id ? String(clubes[0].id) : ''));

      const reservasRes = await reservaService.getByLugar(id);
      setReservasLugar(reservasRes.data?.reservas || []);
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
    const rangoOcupado = reservasLugar.some((reserva) =>
      reservaOcupaFecha(reserva) &&
      fechaReservaComoClave(reserva.fecha_inicio) <= fechaFin &&
      fechaReservaComoClave(reserva.fecha_fin) >= fechaInicio
    );
    if (rangoOcupado) {
      setReservaError('El rango seleccionado incluye fechas ocupadas. Elige otras fechas en el calendario.');
      return;
    }
    try {
      setReservando(true);
      setReservaError('');
      setReservaSuccess('');
      await reservaService.create({
        lugar_id: Number(id),
        club_id: clubReservaId ? Number(clubReservaId) : null,
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

  const seleccionarFechaCalendario = (date) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const seleccion = fechaComoClave(date);
    setReservaError('');
    if (!fechaInicio || fechaFin) {
      setFechaInicio(seleccion);
      setFechaFin('');
      return;
    }
    if (seleccion < fechaInicio) {
      setFechaInicio(seleccion);
      setFechaFin('');
      return;
    }
    const rangoOcupado = reservasLugar.some((reserva) =>
      reserva.estado !== 'cancelada' &&
      fechaReservaComoClave(reserva.fecha_inicio) <= seleccion &&
      fechaReservaComoClave(reserva.fecha_fin) >= fechaInicio
    );
    if (rangoOcupado) {
      setReservaError('Ese rango atraviesa fechas ocupadas. Selecciona otro día de inicio.');
      setFechaInicio(seleccion);
      setFechaFin('');
      return;
    }
    setFechaFin(seleccion);
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
      const miReseña = reseñas.find((reseña) => Number(reseña.usuario_id) === Number(user?.id));
      const fotosAnteriores = normalizarFotos(miReseña?.fotos);
      const calificacionFinal = calificacion || Number(miReseña?.calificacion);
      const comentarioFinal = comentario ?? miReseña?.comentario ?? '';
      const datosReseña = {
        lugar_id: Number(id),
        calificacion: calificacionFinal,
        comentario: comentarioFinal,
        fotos: [...fotosAnteriores, ...fotosReseña]
      };
      await reseñaService.create(datosReseña);
      setReseñaSuccess(miReseña ? 'Tu reseña fue actualizada.' : 'Tu reseña fue publicada.');
      setCalificacion(0);
      setComentario(null);
      setFotosReseña([]);
      const reseñasRes = await reseñaService.getAll({ lugar_id: id });
      setReseñas(obtenerListaReseñas(reseñasRes.data));
    } catch (err) {
      setReseñaError(err.response?.data?.error || 'Error al publicar la reseña');
    }
  };

  if (loading) return <Loading message="Cargando lugar..." />;
  if (error) return <div className="p-8"><ErrorMessage message={error} onRetry={cargar} /></div>;
  if (!lugar) return <div className="p-8 text-center text-slate-500">Lugar no encontrado.</div>;
  const fotosLugar = normalizarFotos(lugar.fotos);
  const miReseña = reseñas.find((reseña) => Number(reseña.usuario_id) === Number(user?.id));

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
          <div className="flex flex-wrap items-center gap-2">
            <a href="#reservar" className="inline-flex items-center gap-2 rounded bg-adventista-azul px-4 py-2 text-sm font-semibold text-white hover:bg-adventista-azul/90">
              <Calendar className="h-4 w-4" /> Reservar
            </a>
            <a href="#resenas" className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Reseñas ({lugar.total_resenas || 0})</a>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${
              lugar.estado === 'activo' ? 'bg-green-100 text-green-700' :
              lugar.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {lugar.estado}
            </span>
          </div>
        </div>

        <section className="mt-6 border-y border-slate-200 py-5" aria-label="Fotos del campamento">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Fotos del campamento</h2>
            {fotosLugar.length > 0 && <span className="text-xs text-slate-500">{fotosLugar.length} {fotosLugar.length === 1 ? 'foto' : 'fotos'}</span>}
          </div>
          {fotosLugar.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fotosLugar.map((foto, index) => (
                <a key={`${foto}-${index}`} href={foto} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-lg bg-slate-100">
                  <img src={foto} alt={`${lugar.nombre}, foto ${index + 1}`} className="aspect-[4/3] w-full object-cover transition duration-200 group-hover:scale-[1.02]" loading="lazy" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Este campamento todavía no tiene fotos.</p>
          )}
        </section>

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
                  {lugar.promedio_calificacion ? Number(lugar.promedio_calificacion).toFixed(1) : 'Sin reseñas'} ({lugar.total_resenas})
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
                    <span key={s} className="rounded-full bg-adventista-azul/10 px-3 py-1 text-xs font-medium text-adventista-azul">
                      <ServicioIcono servicio={s} iconClassName="h-3.5 w-3.5" />
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
        <ClimaLugar lugar={lugar} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div id="reservar" className="scroll-mt-24 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Calendar className="h-5 w-5 text-adventista-azul" /> Reservar este lugar
          </h2>
          {!isAuthenticated ? (
            <p className="text-slate-600">
              <Link to="/login" className="text-adventista-azul underline">Inicia sesión</Link> para reservar.
            </p>
          ) : (
            <form onSubmit={reservar} className="space-y-3">
              {user?.rol !== 'admin' && (
                <label className="block text-sm font-medium text-slate-700">
                  Club
                  <select required value={clubReservaId} onChange={(event) => setClubReservaId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="">Selecciona un club</option>
                    {clubesUsuario.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}
                  </select>
                </label>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Desde</label>
                    <input
                    type="date"
                    required
                      min={fechaComoClave(new Date())}
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
                    min={fechaInicio || fechaComoClave(new Date())}
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Motivo de la reserva</label>
                <input
                  required
                  maxLength={100}
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
                disabled={reservando || (user?.rol !== 'admin' && !clubReservaId)}
                className="w-full rounded-lg bg-adventista-azul py-2 font-semibold text-white hover:bg-adventista-azul/90 disabled:opacity-50"
              >
                {reservando ? 'Reservando...' : 'Solicitar reserva'}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="mb-3 font-semibold text-slate-800">Calendario de disponibilidad</h3>
            <AvailabilityCalendar
              locale="es-BO"
              onClickDay={seleccionarFechaCalendario}
              tileDisabled={({ date, view }) => {
                if (view !== 'month') return false;
                const fecha = fechaComoClave(date);
                const hoy = fechaComoClave(new Date());
                return fecha < hoy || reservasLugar.some((reserva) =>
                  reservaOcupaFecha(reserva) &&
                  fechaReservaComoClave(reserva.fecha_inicio) <= fecha &&
                  fechaReservaComoClave(reserva.fecha_fin) >= fecha
                );
              }}
              tileClassName={({ date, view }) => {
                if (view !== 'month') return undefined;
                const dateKey = fechaComoClave(date);
                const reserva = reservasLugar.find((item) => reservaOcupaFecha(item) &&
                  fechaReservaComoClave(item.fecha_inicio) <= dateKey && fechaReservaComoClave(item.fecha_fin) >= dateKey);
                if (reserva) return `calendar-${reserva.estado}`;
                if (dateKey === fechaInicio) return 'calendar-seleccion-inicio';
                if (dateKey === fechaFin) return 'calendar-seleccion-fin';
                return undefined;
              }}
            />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600" aria-label="Leyenda del calendario">
              <span className="inline-flex items-center gap-1.5"><i className="calendar-legend-dot calendar-legend-confirmada" /> Ocupado (confirmado)</span>
              <span className="inline-flex items-center gap-1.5"><i className="calendar-legend-dot calendar-legend-seleccion" /> Fechas elegidas</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Selecciona un día de inicio y otro de fin. Las fechas ocupadas y pasadas no se pueden elegir.</p>
          </div>
        </div>

        <div id="resenas" className="scroll-mt-24 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
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
                    <p className="mt-0.5 text-xs text-slate-500">
                      Iglesia: {r.usuario_iglesia_nombre || 'Sin iglesia asociada'}
                      {r.usuario_clubes?.length ? ` · Clubes: ${r.usuario_clubes.map((club) => `${club.nombre} (${club.iglesia_nombre || 'Iglesia sin asignar'})`).join(', ')}` : ' · Sin club asociado'}
                    </p>
                  <p className="mt-1 text-sm text-slate-600">{r.comentario || 'Sin comentario'}</p>
                  {normalizarFotos(r.fotos).length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={`Fotos de la reseña de ${r.usuario_nombre}`}>
                      {normalizarFotos(r.fotos).map((foto, index) => (
                        <a key={`${r.id}-${foto}`} href={foto} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200">
                          <img src={foto} alt={`Foto ${index + 1} de la reseña de ${r.usuario_nombre}`} loading="lazy" className="aspect-[4/3] h-full w-full object-cover transition hover:scale-105" />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}

          {isAuthenticated && (
            <form onSubmit={enviarReseña} className="mt-6 rounded-xl bg-slate-50 p-4">
              <h3 className="mb-2 font-semibold text-slate-800">{miReseña ? 'Actualizar mi reseña' : 'Escribir reseña'}</h3>
              {miReseña && <p className="mb-3 text-xs text-slate-600">Ya publicaste una reseña para este lugar. Puedes actualizarla.</p>}
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700">Calificación</label>
                <div className="mt-1">
                  <StarRating rating={calificacion || Number(miReseña?.calificacion) || 0} interactive onChange={setCalificacion} />
                </div>
              </div>
              <textarea
                value={comentario ?? miReseña?.comentario ?? ''}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Comparte tu experiencia..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                rows={3}
                maxLength={2000}
              />
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Fotos de la visita
                <input type="file" accept="image/*" multiple onChange={async (event) => {
                  const files = Array.from(event.target.files || []);
                  if (!files.length) return;
                  try {
                    setSubiendoFotos(true);
                    const uploads = await Promise.all(files.map((file) => uploadService.image(file)));
                    setFotosReseña((actuales) => [...actuales, ...uploads.map((upload) => upload.data.url)]);
                  } catch (err) {
                    setReseñaError(err.response?.data?.error || 'No se pudieron subir las fotos.');
                  } finally {
                    setSubiendoFotos(false);
                    event.target.value = '';
                  }
                }} className="mt-1 block w-full text-sm" />
              </label>
              {(fotosReseña.length > 0 || normalizarFotos(miReseña?.fotos).length > 0) && <p className="mt-1 text-xs text-slate-600">{normalizarFotos(miReseña?.fotos).length + fotosReseña.length} foto(s) en tu reseña</p>}
              {reseñaError && <p className="mt-2 text-sm text-red-600">{reseñaError}</p>}
              {reseñaSuccess && <p className="mt-2 text-sm text-green-600">{reseñaSuccess}</p>}
              <button
                type="submit"
                disabled={subiendoFotos || (calificacion || Number(miReseña?.calificacion) || 0) < 1}
                className="mt-3 w-full rounded-lg bg-adventista-dorado py-2 font-semibold text-slate-900 hover:bg-adventista-dorado/90"
              >
                {miReseña ? 'Guardar cambios' : 'Publicar reseña'}
              </button>
            </form>
          )}
          {!isAuthenticated && <p className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600"><Link to="/login" className="text-adventista-azul underline">Inicia sesión</Link> para publicar una reseña.</p>}
        </div>
      </div>
    </div>
  );
}
