import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { Search, Filter, Star, MapPin, Users } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import lugarService from '../services/lugarService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SERVICIOS_OPCIONES = ['agua', 'baños', 'electricidad', 'fogata', 'senderos', 'rio', 'carpa', 'cocina', 'estacionamiento'];

export default function BuscarLugares() {
  const [lugares, setLugares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filtro, setFiltro] = useState('');
  const [servicios, setServicios] = useState([]);
  const [capacidadMin, setCapacidadMin] = useState('');
  const [calificacionMin, setCalificacionMin] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radio, setRadio] = useState('');

  const cargar = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (lat && lng) {
        params.lat = lat;
        params.lng = lng;
        params.radio = radio || 50;
      }
      if (servicios.length > 0) params.servicios = servicios;
      if (capacidadMin) params.capacidad_min = capacidadMin;
      if (calificacionMin) params.calificacion_min = calificacionMin;

      const { data } = await lugarService.getAll(params);
      setLugares(data?.lugares || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar lugares');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const aplicarFiltros = (e) => {
    e.preventDefault();
    cargar();
  };

  const toggleServicio = (s) => {
    setServicios((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const filtrados = lugares.filter((lugar) => {
    const texto = filtro.toLowerCase();
    return (
      (lugar.nombre || '').toLowerCase().includes(texto) ||
      (lugar.direccion || '').toLowerCase().includes(texto) ||
      (lugar.descripcion || '').toLowerCase().includes(texto)
    );
  });

  const mapCenter = lat && lng ? [Number(lat), Number(lng)] : [-17.3895, -66.1568];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Explorar lugares</h1>
        <p className="text-slate-600">Busca campings disponibles y revisa su ubicación en el mapa.</p>
      </div>

      <form onSubmit={aplicarFiltros} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3"
              placeholder="Buscar por nombre o ubicación"
            />
          </div>
          <input
            type="number"
            value={capacidadMin}
            onChange={(e) => setCapacidadMin(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Capacidad mínima"
          />
          <select
            value={calificacionMin}
            onChange={(e) => setCalificacionMin(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">Calificación mínima</option>
            <option value="5">5 estrellas</option>
            <option value="4">4+ estrellas</option>
            <option value="3">3+ estrellas</option>
            <option value="2">2+ estrellas</option>
            <option value="1">1+ estrellas</option>
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.0001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Lat"
            />
            <input
              type="number"
              step="0.0001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Lng"
            />
            <input
              type="number"
              value={radio}
              onChange={(e) => setRadio(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Km"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Servicios</p>
          <div className="flex flex-wrap gap-2">
            {SERVICIOS_OPCIONES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleServicio(s)}
                className={`rounded-full px-3 py-1 text-sm capitalize ${
                  servicios.includes(s)
                    ? 'bg-adventista-azul text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-adventista-azul px-4 py-2 font-semibold text-white hover:bg-adventista-azul/90"
          >
            <Filter className="h-4 w-4" /> Aplicar filtros
          </button>
        </div>
      </form>

      {error && <ErrorMessage message={error} onRetry={cargar} />}

      {loading ? (
        <Loading message="Cargando lugares..." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <MapContainer center={mapCenter} zoom={lat && lng ? 10 : 6} scrollWheelZoom={false}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {filtrados.map((lugar) => (
                <Marker key={lugar.id} position={[lugar.latitud, lugar.longitud]}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{lugar.nombre}</p>
                      <p>{lugar.direccion}</p>
                      {lugar.distancia_km && <p className="text-adventista-azul">{lugar.distancia_km} km</p>}
                      <Link to={`/lugar/${lugar.id}`} className="text-adventista-azul underline">Ver detalle</Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="space-y-4">
            {filtrados.map((lugar) => (
              <Link
                key={lugar.id}
                to={`/lugar/${lugar.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900">{lugar.nombre}</h2>
                    <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {lugar.direccion || 'Sin dirección'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Array.isArray(lugar.servicios) && lugar.servicios.slice(0, 4).map((s) => (
                        <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-700">
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {lugar.capacidad_maxima}</span>
                      {lugar.promedio_calificacion > 0 && (
                        <span className="flex items-center gap-1 text-adventista-dorado">
                          <Star className="h-3.5 w-3.5 fill-adventista-dorado" />
                          {Number(lugar.promedio_calificacion).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {filtrados.length === 0 && !error && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
                No se encontraron lugares con esos filtros.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
