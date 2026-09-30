import { useEffect, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import {
  Info,
  Church,
  Layers,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Users,
  X,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import lugarService from '../services/lugarService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import ServicioIcono from '../components/ServicioIcono';
import { useAuth } from '../context/AuthContext';
import { useUserLocation } from '../context/LocationContext';
import mapaService from '../services/mapaService';
import authService from '../services/authService';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const iglesiaMapIcon = L.divIcon({
  className: 'camp-map-church-marker',
  html: renderToStaticMarkup(<Church size={19} strokeWidth={2.2} aria-hidden="true" />),
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

const SERVICIOS_OPCIONES = ['agua', 'baños', 'electricidad', 'fogata', 'senderos', 'rio', 'carpa', 'cocina', 'estacionamiento'];
const CENTRO_LA_PAZ = [-16.5837, -68.1432];
const CAPAS = {
  osm: {
    nombre: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; colaboradores de OpenStreetMap',
    subdomains: 'abc',
  },
  humanitario: {
    nombre: 'OpenStreetMap Humanitario',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; colaboradores de OpenStreetMap, estilo HOT',
    subdomains: 'abc',
  },
};

function MapCamera({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    const currentCenter = map.getCenter();
    const centerChanged = Math.abs(currentCenter.lat - center[0]) > 0.00001
      || Math.abs(currentCenter.lng - center[1]) > 0.00001;
    if (centerChanged || map.getZoom() !== zoom) {
      map.setView(center, zoom, { animate: true });
    }
  }, [map, center[0], center[1], zoom]);

  return null;
}

function MapViewportSync({ onMove }) {
  const map = useMapEvents({
    moveend: (event) => {
      const currentMap = event.target;
      const center = currentMap.getCenter();
      const bounds = currentMap.getBounds();
      onMove(
        [Number(center.lat.toFixed(4)), Number(center.lng.toFixed(4))],
        [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()],
        currentMap.getZoom()
      );
    },
    zoomend: (event) => {
      const currentMap = event.target;
      const center = currentMap.getCenter();
      const bounds = currentMap.getBounds();
      onMove(
        [Number(center.lat.toFixed(4)), Number(center.lng.toFixed(4))],
        [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()],
        currentMap.getZoom()
      );
    },
  });

  useEffect(() => {
    const bounds = map.getBounds();
    onMove(
      [Number(map.getCenter().lat.toFixed(4)), Number(map.getCenter().lng.toFixed(4))],
      [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()],
      map.getZoom()
    );
  }, [map, onMove]);

  return null;
}

export default function BuscarLugares() {
  const { user } = useAuth();
  const { position, requestLocation } = useUserLocation();
  const initialCenter = position
    ? [position.latitude, position.longitude]
    : user?.iglesia_latitud != null && user?.iglesia_longitud != null
    ? [Number(user.iglesia_latitud), Number(user.iglesia_longitud)]
    : CENTRO_LA_PAZ;
  const [lugares, setLugares] = useState([]);
  const [iglesias, setIglesias] = useState([]);
  const [campingsOsm, setCampingsOsm] = useState([]);
  const [campingsOsmVisibles, setCampingsOsmVisibles] = useState(true);
  const [campingsOsmLoading, setCampingsOsmLoading] = useState(false);
  const [campingsOsmError, setCampingsOsmError] = useState('');
  const [actualizarOsm, setActualizarOsm] = useState(0);
  const [mapBounds, setMapBounds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensajeUbicacion, setMensajeUbicacion] = useState('');
  const [panel, setPanel] = useState('lugares');
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [servicios, setServicios] = useState([]);
  const [capacidadMin, setCapacidadMin] = useState('');
  const [calificacionMin, setCalificacionMin] = useState('');
  const [lat, setLat] = useState(String(initialCenter[0]));
  const [lng, setLng] = useState(String(initialCenter[1]));
  const [radio, setRadio] = useState('50');
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [mapZoom, setMapZoom] = useState(12);
  const [capa, setCapa] = useState('osm');
  const [lugarSeleccionado, setLugarSeleccionado] = useState(null);

  useEffect(() => {
    let activo = true;
    authService.getIglesias()
      .then(({ data }) => {
        if (activo) setIglesias(data?.iglesias || []);
      })
      .catch(() => {
        if (activo) setIglesias([]);
      });
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (!campingsOsmVisibles || !mapBounds) return undefined;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setCampingsOsmLoading(true);
        setCampingsOsmError('');
        const { data } = await mapaService.getCampingsOsm(mapBounds, {
          signal: controller.signal,
          actualizar: actualizarOsm > 0 ? 'true' : undefined,
        });
        setCampingsOsm(data?.campings || []);
      } catch (err) {
        if (err.code !== 'ERR_CANCELED' && err.name !== 'CanceledError') {
          setCampingsOsmError(err.response?.data?.error || 'No se pudieron actualizar los puntos de acampada.');
        }
      } finally {
        if (!controller.signal.aborted) setCampingsOsmLoading(false);
      }
    }, actualizarOsm > 0 ? 0 : 650);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [campingsOsmVisibles, mapBounds, actualizarOsm]);

  const cargar = async (origen = {}) => {
    const latitud = origen.lat ?? lat;
    const longitud = origen.lng ?? lng;
    try {
      setLoading(true);
      setError('');
      const params = {
        lat: latitud,
        lng: longitud,
        radio: origen.radio ?? radio,
      };
      if (busqueda.trim()) params.busqueda = busqueda.trim();
      if (servicios.length) params.servicios = servicios;
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
    if (position) {
      const nuevaUbicacion = [position.latitude, position.longitude];
      setLat(String(position.latitude));
      setLng(String(position.longitude));
      setMapCenter(nuevaUbicacion);
      setMapZoom(12);
      cargar({ lat: position.latitude, lng: position.longitude });
    } else {
      cargar();
    }
  }, [position]);

  const aplicarFiltros = (event) => {
    event.preventDefault();
    const latitud = Number(lat);
    const longitud = Number(lng);
    setMapCenter([latitud, longitud]);
    setMapZoom(Number(radio) >= 200 ? 6 : Number(radio) >= 100 ? 8 : Number(radio) > 50 ? 10 : 12);
    cargar({ lat: latitud, lng: longitud });
    setPanel('lugares');
  };

  const buscarEnMapa = () => {
    const [latitud, longitud] = mapCenter;
    setLat(String(latitud));
    setLng(String(longitud));
    cargar({ lat: latitud, lng: longitud });
    setPanel('lugares');
    setPanelAbierto(true);
  };

  const ampliarBusqueda = () => {
    setRadio('250');
    setMapZoom(7);
    cargar({ lat: mapCenter[0], lng: mapCenter[1], radio: 250 });
  };

  const cambiarServicio = (servicio) => {
    setServicios((actuales) => actuales.includes(servicio)
      ? actuales.filter((item) => item !== servicio)
      : [...actuales, servicio]);
  };

  const centrarUbicacion = async () => {
    setMensajeUbicacion('Buscando tu ubicación...');
    try {
      await requestLocation();
      setMensajeUbicacion('');
    } catch (locationError) {
      setMensajeUbicacion(locationError.message);
    }
  };

  const seleccionarLugar = (lugar) => {
    setLugarSeleccionado(lugar.id);
    setMapCenter([Number(lugar.latitud), Number(lugar.longitud)]);
    setMapZoom(13);
    setPanelAbierto(false);
  };

  const herramientas = [
    { id: 'lugares', label: 'Campamentos', icon: MapPin },
    { id: 'filtros', label: 'Filtros', icon: SlidersHorizontal },
    { id: 'capas', label: 'Capas del mapa', icon: Layers },
    { id: 'info', label: 'Información', icon: Info },
  ];
  const capaActual = CAPAS[capa];

  return (
    <main className="camp-map-shell" aria-label="Mapa de lugares de campamento">
      <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom className="camp-map-canvas">
        <MapCamera center={mapCenter} zoom={mapZoom} />
        <MapViewportSync onMove={(center, bounds, zoom) => {
          setMapCenter((current) => current[0] === center[0] && current[1] === center[1] ? current : center);
          setMapBounds((current) => current && current.every((value, index) => Math.abs(value - bounds[index]) < 0.0001) ? current : bounds);
          setMapZoom((current) => current === zoom ? current : zoom);
        }} />
        <TileLayer url={capaActual.url} attribution={capaActual.attribution} subdomains={capaActual.subdomains} />
        {iglesias.filter((iglesia) => Number.isFinite(Number(iglesia.latitud)) && Number.isFinite(Number(iglesia.longitud))).map((iglesia) => (
          <Marker
            key={`iglesia-${iglesia.id}`}
            position={[Number(iglesia.latitud), Number(iglesia.longitud)]}
            icon={iglesiaMapIcon}
          >
            <Popup>
              <div className="camp-map-popup">
                <p className="camp-map-popup__eyebrow">Iglesia ACJ</p>
                <h2>{iglesia.nombre}</h2>
                {iglesia.direccion && <p>{iglesia.direccion}</p>}
                {(iglesia.zona || iglesia.distrito) && <p>{[iglesia.zona, iglesia.distrito].filter(Boolean).join(' · ')}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
        {position && (
          <CircleMarker
            center={[position.latitude, position.longitude]}
            radius={9}
            pathOptions={{ color: '#ffffff', fillColor: '#2563eb', fillOpacity: 1, weight: 3 }}
          >
            <Popup>Tu ubicación</Popup>
          </CircleMarker>
        )}
        {campingsOsmVisibles && campingsOsm.map((camping) => (
          <CircleMarker
            key={camping.id}
            center={[camping.latitud, camping.longitud]}
            radius={7}
            pathOptions={{ color: '#176b55', fillColor: '#2a9a75', fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <div className="camp-map-popup">
                <p className="camp-map-popup__eyebrow">OpenStreetMap · {camping.tipo === 'caravan_site' ? 'Caravanas' : 'Camping'}</p>
                <h2>{camping.nombre}</h2>
                {camping.operador && <p>Operador: {camping.operador}</p>}
                {camping.acceso && <p>Acceso: {camping.acceso}</p>}
                <a href={camping.osm_url} target="_blank" rel="noreferrer">Ver y editar en OpenStreetMap <span aria-hidden="true">↗</span></a>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {lugares.map((lugar) => (
          <Marker key={lugar.id} position={[Number(lugar.latitud), Number(lugar.longitud)]}>
            <Popup>
              <div className="camp-map-popup">
                <p className="camp-map-popup__eyebrow">Lugar de campamento</p>
                <h2>{lugar.nombre}</h2>
                <p>{lugar.direccion || 'Ubicación registrada'}</p>
                <div className="camp-map-popup__meta">
                  {Number(lugar.promedio_calificacion) > 0 && <span><Star size={14} fill="currentColor" /> {Number(lugar.promedio_calificacion).toFixed(1)}</span>}
                  {lugar.distancia_km != null && <span>{lugar.distancia_km} km</span>}
                  {lugar.capacidad_maxima && <span><Users size={14} /> {lugar.capacidad_maxima}</span>}
                </div>
                <Link to={`/lugar/${lugar.id}`}>Ver campamento <span aria-hidden="true">→</span></Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <aside className={`camp-map-sidebar ${panelAbierto ? 'is-open' : 'is-closed'}`}>
        <div className="camp-map-tools" role="toolbar" aria-label="Herramientas del mapa">
          {herramientas.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={panel === id && panelAbierto}
              className={panel === id && panelAbierto ? 'is-active' : ''}
              onClick={() => {
                if (panel === id && panelAbierto) setPanelAbierto(false);
                else { setPanel(id); setPanelAbierto(true); }
              }}
            >
              <Icon size={19} strokeWidth={1.8} />
            </button>
          ))}
          <button
            type="button"
            className="camp-map-tools__close"
            title={panelAbierto ? 'Cerrar panel' : 'Abrir panel'}
            aria-label={panelAbierto ? 'Cerrar panel' : 'Abrir panel'}
            onClick={() => setPanelAbierto((abierto) => !abierto)}
          >
            {panelAbierto ? <X size={17} /> : <MapIcon size={18} />}
          </button>
        </div>

        {panelAbierto && (
          <>
          <div className="camp-map-panel">
            {panel === 'lugares' && (
              <>
                <header className="camp-map-panel__header">
                  <p className="camp-map-kicker">ACJ CAMP · EXPLORAR</p>
                  <h1>Campamentos</h1>
                  <p>{lugares.length} campamentos ACJ disponibles</p>
                </header>
                <form className="camp-map-search" onSubmit={aplicarFiltros}>
                  <Search size={17} aria-hidden="true" />
                  <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Nombre o localidad" aria-label="Buscar campamento" />
                  <button type="submit" aria-label="Buscar"><Search size={17} /></button>
                </form>
                <div className="camp-map-nearby-row">
                  <button type="button" className="camp-map-nearby" onClick={buscarEnMapa}>
                    <MapPin size={15} /> Buscar en esta zona
                    <Search size={15} />
                  </button>
                  <button type="button" className="camp-map-nearby-filter" onClick={() => setPanel('filtros')} title="Abrir filtros" aria-label="Abrir filtros">
                    <SlidersHorizontal size={16} />
                  </button>
                </div>
                {mensajeUbicacion && <p className="camp-map-feedback" role="status">{mensajeUbicacion}</p>}
                {error && <ErrorMessage message={error} onRetry={cargar} />}
                {loading ? <Loading message="Buscando campamentos..." /> : (
                  <div className="camp-map-results" aria-live="polite">
                    {lugares.map((lugar) => (
                      <button
                        type="button"
                        key={lugar.id}
                        className={`camp-map-result ${lugarSeleccionado === lugar.id ? 'is-selected' : ''}`}
                        onClick={() => seleccionarLugar(lugar)}
                      >
                        <span className="camp-map-result__pin"><MapPin size={17} /></span>
                        <span className="camp-map-result__body">
                          <strong>{lugar.nombre}</strong>
                          <span>{lugar.direccion || 'Dirección no registrada'}</span>
                          <span className="camp-map-result__meta">
                            {lugar.distancia_km != null && <span>{lugar.distancia_km} km</span>}
                            {Number(lugar.promedio_calificacion) > 0 && <span><Star size={12} fill="currentColor" /> {Number(lugar.promedio_calificacion).toFixed(1)}</span>}
                            {lugar.capacidad_maxima && <span><Users size={12} /> {lugar.capacidad_maxima}</span>}
                          </span>
                        </span>
                        <Link to={`/lugar/${lugar.id}`} aria-label={`Ver ${lugar.nombre}`} onClick={(event) => event.stopPropagation()}>→</Link>
                      </button>
                    ))}
                    {lugares.length === 0 && !error && (
                      <div className="camp-map-empty">
                        <p>No hay campamentos registrados dentro de {radio} km.</p>
                        {Number(radio) < 250 && <button type="button" onClick={ampliarBusqueda}>Ampliar búsqueda a 250 km</button>}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {panel === 'filtros' && (
              <>
                <header className="camp-map-panel__header">
                  <p className="camp-map-kicker">ACJ CAMP · EXPLORAR</p>
                  <h1>Filtros del mapa</h1>
                  <p>Refina los sitios que aparecen en el mapa.</p>
                </header>
                <form className="camp-map-filters" onSubmit={aplicarFiltros}>
                  <div className="camp-map-filter-grid">
                    <label>Latitud
                      <input required type="number" min="-90" max="90" step="any" value={lat} onChange={(event) => setLat(event.target.value)} />
                    </label>
                    <label>Longitud
                      <input required type="number" min="-180" max="180" step="any" value={lng} onChange={(event) => setLng(event.target.value)} />
                    </label>
                  </div>
                  <label>Radio de búsqueda <span>{radio} km</span>
                    <input type="range" min="10" max="250" step="10" value={radio} onChange={(event) => setRadio(event.target.value)} />
                  </label>
                  <label>Capacidad mínima
                    <input type="number" min="1" value={capacidadMin} onChange={(event) => setCapacidadMin(event.target.value)} placeholder="Cualquier capacidad" />
                  </label>
                  <label>Calificación mínima
                    <select value={calificacionMin} onChange={(event) => setCalificacionMin(event.target.value)}>
                      <option value="">Cualquiera</option>
                      <option value="5">5 estrellas</option>
                      <option value="4">4 o más</option>
                      <option value="3">3 o más</option>
                      <option value="2">2 o más</option>
                      <option value="1">1 o más</option>
                    </select>
                  </label>
                  <fieldset>
                    <legend>Servicios disponibles</legend>
                    <div className="camp-map-service-list">
                      {SERVICIOS_OPCIONES.map((servicio) => (
                        <label key={servicio}>
                          <input type="checkbox" checked={servicios.includes(servicio)} onChange={() => cambiarServicio(servicio)} />
                          <ServicioIcono servicio={servicio} />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="camp-map-filter-actions">
                    <button type="button" className="camp-map-secondary" onClick={() => {
                      setServicios([]); setCapacidadMin(''); setCalificacionMin(''); setRadio('50');
                    }}>Limpiar</button>
                    <button type="submit" className="camp-map-primary">Aplicar filtros</button>
                  </div>
                </form>
              </>
            )}

            {panel === 'capas' && (
              <>
                <header className="camp-map-panel__header">
                  <p className="camp-map-kicker">PRESENTACIÓN</p>
                  <h1>Capas del mapa</h1>
                  <p>Selecciona el mapa base.</p>
                </header>
                <div className="camp-map-layer-list">
                  {Object.entries(CAPAS).map(([id, opcion]) => (
                    <label key={id} className={capa === id ? 'is-selected' : ''}>
                      <input type="radio" name="capa" value={id} checked={capa === id} onChange={() => setCapa(id)} />
                      <span><strong>{opcion.nombre}</strong><small>Datos abiertos de OpenStreetMap</small></span>
                    </label>
                  ))}
                </div>
                <div className="camp-map-overlay-control">
                  <label className="camp-map-overlay-toggle">
                    <input type="checkbox" checked={campingsOsmVisibles} onChange={(event) => setCampingsOsmVisibles(event.target.checked)} />
                    <span><strong>Puntos de acampada OSM</strong><small>Sitios etiquetados por la comunidad</small></span>
                  </label>
                  <div className="camp-map-overlay-status" role="status">
                    <span>{campingsOsmLoading ? 'Actualizando puntos...' : `${campingsOsm.length} puntos en el área visible`}</span>
                    <button type="button" disabled={!campingsOsmVisibles || campingsOsmLoading} onClick={() => setActualizarOsm((version) => version + 1)} title="Actualizar puntos de OpenStreetMap" aria-label="Actualizar puntos de OpenStreetMap">
                      <RefreshCw size={15} className={campingsOsmLoading ? 'is-spinning' : ''} />
                    </button>
                  </div>
                  {campingsOsmError && <p className="camp-map-overlay-error">{campingsOsmError}</p>}
                </div>
              </>
            )}

            {panel === 'info' && (
              <>
                <header className="camp-map-panel__header">
                  <p className="camp-map-kicker">ACJ CAMP · MAPA</p>
                  <h1>Mapa de campamentos</h1>
                  <p>Explora sitios registrados por clubes y aprobados para la comunidad.</p>
                </header>
                <div className="camp-map-info">
                  <div><MapPin size={16} className="text-adventista-azul" /><span>Campamentos ACJ · {lugares.length} en esta búsqueda</span></div>
                  <p>Destinos registrados por clubes ACJ. Abre una ficha para consultar servicios, reseñas, disponibilidad y contacto.</p>
                  <div className="mt-4 border-t border-slate-200 pt-2"><span className="camp-map-info__dot" /><span>Puntos comunitarios de OpenStreetMap</span></div>
                  <p>Los marcadores verdes son sitios publicados en OpenStreetMap y siguen el área visible del mapa.</p>
                  {lugares.length > 0 ? (
                    <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
                      {lugares.slice(0, 5).map((lugar) => (
                        <li key={lugar.id}>
                          <Link to={`/lugar/${lugar.id}`} className="flex items-center justify-between gap-3 py-3 text-inherit no-underline hover:text-adventista-azul">
                            <span className="min-w-0">
                              <strong className="block truncate text-sm">{lugar.nombre}</strong>
                              <small className="block truncate text-xs text-slate-500">{lugar.direccion || 'Bolivia'}</small>
                            </span>
                            {lugar.capacidad_maxima && <small className="shrink-0 text-xs text-slate-500">{lugar.capacidad_maxima} personas</small>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm">No hay campamentos ACJ dentro del radio seleccionado.</p>}
                  {lugares.length > 5 && <button type="button" onClick={() => setPanel('lugares')} className="mt-3 border-0 bg-transparent p-0 text-sm font-semibold text-adventista-azul">Ver los {lugares.length} campamentos ACJ</button>}
                </div>
              </>
            )}
          </div>
          <button type="button" className="camp-map-location-action" onClick={centrarUbicacion}>
            <LocateFixed size={16} /> Usar mi ubicación actual
          </button>
          </>
        )}
      </aside>

      <button type="button" className="camp-map-locate" onClick={centrarUbicacion} title="Centrar en mi ubicación" aria-label="Centrar en mi ubicación">
        <LocateFixed size={20} />
      </button>
      <div className="camp-map-scale-note"><span className="camp-map-scale-note__dot" /> Campamentos activos <span>·</span> {capaActual.nombre}</div>
    </main>
  );
}