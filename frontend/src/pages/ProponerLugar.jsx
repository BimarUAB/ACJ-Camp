import { useEffect, useState } from 'react';
import { Camera, MapPin, Pencil, Plus, Save, Send, X } from 'lucide-react';
import lugarService from '../services/lugarService';
import uploadService from '../services/uploadService';
import Loading from '../components/Loading';
import ServicioIcono from '../components/ServicioIcono';

const SERVICIOS = ['agua', 'baños', 'electricidad', 'fogata', 'senderos', 'rio', 'carpa', 'cocina', 'estacionamiento'];
const FORM_INICIAL = {
  nombre: '', descripcion: '', direccion: '', latitud: '', longitud: '', propietario: '', contacto: '',
  telefono: '', servicios: [], capacidad_maxima: '', precio_aprox: '', fotos: []
};

export default function ProponerLugar() {
  const [lugares, setLugares] = useState([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [lugarEditando, setLugarEditando] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarLugares = async () => {
    try {
      setError('');
      const { data } = await lugarService.getMisLugares();
      setLugares(data?.lugares || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar tus lugares.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarLugares(); }, []);

  const iniciarEdicion = (lugar) => {
    setLugarEditando(lugar.id);
    setMensaje('');
    setError('');
    setForm({
      nombre: lugar.nombre || '',
      descripcion: lugar.descripcion || '',
      direccion: lugar.direccion || '',
      latitud: String(lugar.latitud ?? ''),
      longitud: String(lugar.longitud ?? ''),
      propietario: lugar.propietario || '',
      contacto: lugar.contacto || '',
      telefono: lugar.telefono || '',
      servicios: Array.isArray(lugar.servicios) ? lugar.servicios : [],
      capacidad_maxima: lugar.capacidad_maxima ? String(lugar.capacidad_maxima) : '',
      precio_aprox: lugar.precio_aprox ? String(lugar.precio_aprox) : '',
      fotos: Array.isArray(lugar.fotos) ? lugar.fotos : [],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nuevoLugar = () => {
    setLugarEditando(null);
    setForm(FORM_INICIAL);
    setError('');
    setMensaje('');
  };

  const cambiarServicio = (servicio) => setForm((actual) => ({
    ...actual,
    servicios: actual.servicios.includes(servicio)
      ? actual.servicios.filter((item) => item !== servicio)
      : [...actual.servicios, servicio]
  }));

  const subirFotos = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      setSubiendo(true);
      setError('');
      const uploads = await Promise.all(files.map((file) => uploadService.image(file)));
      setForm((actual) => ({ ...actual, fotos: [...actual.fotos, ...uploads.map((upload) => upload.data.url)] }));
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron subir las fotos.');
    } finally {
      setSubiendo(false);
      event.target.value = '';
    }
  };

  const enviar = async (event) => {
    event.preventDefault();
    try {
      setGuardando(true);
      setError('');
      const datosLugar = {
        ...form,
        latitud: Number(form.latitud),
        longitud: Number(form.longitud),
        capacidad_maxima: form.capacidad_maxima || null,
        precio_aprox: form.precio_aprox || null
      };
      if (lugarEditando) {
        await lugarService.update(lugarEditando, datosLugar);
        setMensaje('Cambios guardados. El lugar conserva su estado de aprobación.');
      } else {
        await lugarService.create(datosLugar);
        setMensaje('Lugar guardado en tu cuenta. Quedó pendiente de aprobación antes de aparecer públicamente.');
      }
      setLugarEditando(null);
      setForm(FORM_INICIAL);
      await cargarLugares();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar el lugar.');
    } finally {
      setGuardando(false);
    }
  };

  const estadoClase = {
    activo: 'bg-green-100 text-green-800',
    pendiente: 'bg-amber-100 text-amber-900',
    inactivo: 'bg-slate-200 text-slate-700',
  };

  if (cargando) return <Loading message="Cargando tus lugares..." />;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-7 border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold uppercase text-adventista-azul">Tu cuenta</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Mis lugares de campamento</h1>
        <p className="mt-2 text-sm text-slate-600">Registra sitios y vuelve a editar su información cuando la necesites.</p>
      </header>
      {error && <p role="alert" className="mb-4 border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {mensaje && <p role="status" className="mb-4 border-l-4 border-green-700 bg-green-50 p-3 text-sm text-green-800">{mensaje}</p>}

      <section className="mb-10 border-b border-slate-200 pb-9">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{lugarEditando ? 'Editar lugar' : 'Agregar lugar'}</h2>
            {!lugarEditando && <p className="mt-1 text-sm text-slate-600">Los lugares se guardan en tu cuenta y los revisa un administrador.</p>}
          </div>
          {lugarEditando && <button type="button" onClick={nuevoLugar} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><X size={16} /> Cancelar edición</button>}
        </div>
        <form onSubmit={enviar} className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Nombre del lugar
          <input required maxLength={200} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Descripción
          <textarea rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Dirección
          <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">Latitud
          <input required type="number" min="-90" max="90" step="any" value={form.latitud} onChange={(e) => setForm({ ...form, latitud: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">Longitud
          <input required type="number" min="-180" max="180" step="any" value={form.longitud} onChange={(e) => setForm({ ...form, longitud: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">Propietario
          <input value={form.propietario} onChange={(e) => setForm({ ...form, propietario: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">Teléfono de contacto
          <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">Capacidad máxima
          <input type="number" min="1" value={form.capacidad_maxima} onChange={(e) => setForm({ ...form, capacidad_maxima: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium text-slate-700">Precio aproximado (Bs.)
          <input type="number" min="0" step="0.01" value={form.precio_aprox} onChange={(e) => setForm({ ...form, precio_aprox: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <fieldset className="md:col-span-2">
          <legend className="mb-2 text-sm font-medium text-slate-700">Servicios disponibles</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {SERVICIOS.map((servicio) => <label key={servicio} className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.servicios.includes(servicio)} onChange={() => cambiarServicio(servicio)} /><ServicioIcono servicio={servicio} /></label>)}
          </div>
        </fieldset>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          <span className="flex items-center gap-2"><Camera className="h-4 w-4" /> Fotos del lugar</span>
          <input type="file" accept="image/*" multiple onChange={subirFotos} className="mt-2 block w-full text-sm" />
        </label>
        {subiendo && <p className="text-sm text-slate-600 md:col-span-2">Subiendo fotos...</p>}
        {form.fotos.length > 0 && <div className="flex flex-wrap gap-2 md:col-span-2">{form.fotos.map((foto) => <img key={foto} src={foto} alt="Lugar propuesto" className="h-20 w-28 rounded object-cover" />)}</div>}
        <div className="md:col-span-2">
          <button disabled={guardando || subiendo} className="inline-flex items-center gap-2 rounded bg-adventista-azul px-4 py-2 font-semibold text-white disabled:opacity-50">
            {lugarEditando ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />} {guardando ? 'Guardando...' : lugarEditando ? 'Guardar cambios' : 'Guardar lugar'}
          </button>
          {!lugarEditando && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> La ubicación se mostrará en el mapa público después de su aprobación.</p>}
        </div>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Lugares guardados</h2>
            <p className="mt-1 text-sm text-slate-600">{lugares.length} {lugares.length === 1 ? 'lugar' : 'lugares'} asociados a tu cuenta</p>
          </div>
          <button type="button" onClick={nuevoLugar} className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus size={16} /> Agregar</button>
        </div>
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {lugares.map((lugar) => (
            <article key={lugar.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{lugar.nombre}</h3>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${estadoClase[lugar.estado] || estadoClase.inactivo}`}>{lugar.estado}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{lugar.direccion || 'Sin dirección registrada'}</p>
                <p className="mt-1 text-xs text-slate-500">{Number(lugar.latitud).toFixed(4)}, {Number(lugar.longitud).toFixed(4)}</p>
                {lugar.estado === 'pendiente' && <p className="mt-2 text-xs text-amber-800">Pendiente de aprobación. Puedes seguir editándolo mientras se revisa.</p>}
              </div>
              <button type="button" onClick={() => iniciarEdicion(lugar)} className="inline-flex shrink-0 items-center gap-2 self-start rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Pencil size={15} /> Editar</button>
            </article>
          ))}
          {lugares.length === 0 && <p className="py-6 text-sm text-slate-600">Todavía no tienes lugares guardados. Usa el formulario para registrar el primero.</p>}
        </div>
      </section>
    </main>
  );
}