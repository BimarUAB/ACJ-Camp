import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Map, MapPin, Search, Star, TentTree, Users } from 'lucide-react';
import lugarService from '../services/lugarService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

const normalizarFotos = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const fotos = JSON.parse(value);
    return Array.isArray(fotos) ? fotos : [];
  } catch {
    return value ? [value] : [];
  }
};

export default function ExplorarCampamentos() {
  const [lugares, setLugares] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargarLugares = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await lugarService.getAll({ estado: 'activo', radio: 5000 });
      setLugares(data?.lugares || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los campamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarLugares();
  }, []);

  const consulta = busqueda.trim().toLocaleLowerCase('es');
  const lugaresVisibles = lugares.filter((lugar) => (
    `${lugar.nombre || ''} ${lugar.direccion || ''} ${lugar.descripcion || ''}`
      .toLocaleLowerCase('es')
      .includes(consulta)
  ));

  if (loading) return <Loading message="Cargando campamentos..." />;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-adventista-verde"><Compass className="h-4 w-4" /> ACJ-Camp</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Explorar campamentos</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Lugares registrados y aprobados para planificar tu próxima salida.</p>
        </div>
        <Link to="/mapa" className="inline-flex w-fit items-center gap-2 rounded border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-adventista-verde hover:text-adventista-verde">
          <Map className="h-4 w-4" /> Ver mapa
        </Link>
      </header>

      {error && <div className="mb-6"><ErrorMessage message={error} onRetry={cargarLugares} /></div>}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-h-11 w-full max-w-xl items-center gap-2 rounded border border-slate-300 bg-white px-3 focus-within:border-adventista-verde">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por nombre, ubicación o descripción" aria-label="Buscar campamentos" className="w-full bg-transparent py-2 text-sm outline-none" />
        </label>
        <p className="text-sm text-slate-500" aria-live="polite">{lugaresVisibles.length} {lugaresVisibles.length === 1 ? 'campamento' : 'campamentos'}</p>
      </div>

      {!error && lugaresVisibles.length > 0 ? (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Campamentos registrados">
          {lugaresVisibles.map((lugar) => {
            const foto = normalizarFotos(lugar.fotos)[0];
            const calificacion = Number(lugar.promedio_calificacion || 0);
            return (
              <article key={lugar.id} className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md">
                <Link to={`/lugar/${lugar.id}`} aria-label={`Ver ${lugar.nombre}`} className="relative block aspect-[16/10] overflow-hidden bg-emerald-50">
                  {foto ? (
                    <img src={foto} alt={lugar.nombre} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#e8f1e8,#dce9e5)] text-adventista-verde">
                      <TentTree className="h-10 w-10" aria-hidden="true" />
                      <span className="text-xs font-medium">Sin foto registrada</span>
                    </div>
                  )}
                  {lugar.distancia_km != null && <span className="absolute bottom-3 left-3 rounded bg-white/95 px-2 py-1 text-xs font-medium text-slate-700">{Number(lugar.distancia_km).toFixed(1)} km</span>}
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 text-lg font-semibold leading-snug text-slate-900">{lugar.nombre}</h2>
                    {calificacion > 0 && <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-slate-700"><Star className="h-4 w-4 fill-adventista-dorado text-adventista-dorado" /> {calificacion.toFixed(1)}</span>}
                  </div>
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-adventista-verde" /><span className="line-clamp-2">{lugar.direccion || 'Ubicación registrada'}</span></p>
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-500">{lugar.descripcion || 'Consulta la información y disponibilidad de este campamento.'}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    {lugar.capacidad_maxima && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Hasta {lugar.capacidad_maxima}</span>}
                    {Number(lugar.precio_aprox) > 0 && <span>Desde Bs. {Number(lugar.precio_aprox).toFixed(0)}</span>}
                    {Number(lugar.total_resenas) > 0 && <span>{lugar.total_resenas} {Number(lugar.total_resenas) === 1 ? 'reseña' : 'reseñas'}</span>}
                  </div>
                  <Link to={`/lugar/${lugar.id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-adventista-azul hover:underline">
                    Ver campamento <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : !error ? (
        <div className="border-y border-slate-200 py-16 text-center">
          <TentTree className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 font-semibold text-slate-800">{busqueda ? 'No encontramos campamentos con esa búsqueda' : 'Aún no hay campamentos publicados'}</h2>
          <p className="mt-1 text-sm text-slate-500">{busqueda ? 'Prueba con otro nombre o ubicación.' : 'Los lugares aprobados aparecerán aquí.'}</p>
        </div>
      ) : null}
    </main>
  );
}