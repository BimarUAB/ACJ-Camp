import { useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Save, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clubService from '../services/clubService';
import iglesiaService from '../services/iglesiaService';
import authService from '../services/authService';
import Loading from '../components/Loading';

const FORM_VACIO = { nombre: '', tipo: 'conquistadores', logo_url: '' };

export default function GestionClubs() {
  const { user, updateUser } = useAuth();
  const esDirector = user?.rol === 'director';
  const puedeGestionar = user?.rol === 'director' || user?.rol === 'admin';
  const [clubs, setClubs] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [formIglesia, setFormIglesia] = useState({ nombre: '', direccion: '', zona: '', distrito: '', latitud: '', longitud: '' });
  const [clubEditando, setClubEditando] = useState(null);
  const [clubLideresAbierto, setClubLideresAbierto] = useState(null);
  const [lideresClub, setLideresClub] = useState({ leaders: [], available: [] });
  const [liderSeleccionado, setLiderSeleccionado] = useState('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    try {
      setError('');
      const { data } = await clubService.getAll({ iglesia_id: user?.iglesia_id });
      setClubs(data?.clubs || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar tus clubes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [user?.iglesia_id]);

  const guardar = async (event) => {
    event.preventDefault();
    if (!user?.iglesia_id) {
      setError('Tu cuenta debe estar asociada a una iglesia para gestionar un club.');
      return;
    }
    try {
      setGuardando(true);
      setError('');
      if (clubEditando) {
        await clubService.update(clubEditando, form);
        setMensaje('Los cambios del club se guardaron.');
      } else {
        await clubService.create({ ...form, iglesia_id: user.iglesia_id });
        setMensaje('El club quedó registrado.');
      }
      setForm(FORM_VACIO);
      setClubEditando(null);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el club.');
    } finally {
      setGuardando(false);
    }
  };

  const registrarIglesia = async (event) => {
    event.preventDefault();
    try {
      setGuardando(true);
      setError('');
      const { data } = await iglesiaService.create({
        ...formIglesia,
        latitud: Number(formIglesia.latitud),
        longitud: Number(formIglesia.longitud),
      });
      const profile = await authService.updateProfile({ iglesia_id: data.iglesia.id });
      updateUser(profile.data.user);
      setFormIglesia({ nombre: '', direccion: '', zona: '', distrito: '', latitud: '', longitud: '' });
      setMensaje('La iglesia quedó registrada y asociada a tu cuenta. Ya puedes agregar tu club.');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo registrar la iglesia.');
    } finally {
      setGuardando(false);
    }
  };

  const editar = (club) => {
    setClubEditando(club.id);
    setForm({ nombre: club.nombre, tipo: club.tipo, logo_url: club.logo_url || '' });
    setMensaje('');
  };

  const gestionarLideres = async (clubId) => {
    if (clubLideresAbierto === clubId) {
      setClubLideresAbierto(null);
      return;
    }
    try {
      setError('');
      setClubLideresAbierto(clubId);
      const { data } = await clubService.getLeaders(clubId);
      setLideresClub({ leaders: data.leaders || [], available: data.available || [] });
      setLiderSeleccionado('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los líderes.');
    }
  };

  const agregarLider = async (clubId) => {
    if (!liderSeleccionado) return;
    try {
      setError('');
      await clubService.addLeader(clubId, liderSeleccionado);
      const { data } = await clubService.getLeaders(clubId);
      setLideresClub({ leaders: data.leaders || [], available: data.available || [] });
      setLiderSeleccionado('');
      setMensaje('El líder quedó asignado al club.');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo asignar el líder.');
    }
  };

  const quitarLider = async (clubId, liderId) => {
    try {
      setError('');
      await clubService.removeLeader(clubId, liderId);
      const { data } = await clubService.getLeaders(clubId);
      setLideresClub({ leaders: data.leaders || [], available: data.available || [] });
      setMensaje('El líder fue retirado del club.');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo retirar el líder.');
    }
  };

  if (loading) return <Loading message="Cargando tus clubes..." />;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-adventista-azul" />
          <h1 className="text-2xl font-semibold text-slate-900">Mis clubes</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">{user?.iglesia_nombre || 'Iglesia sin asignar'}</p>
      </div>

      {error && <p role="alert" className="mb-4 border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {mensaje && <p role="status" className="mb-4 border-l-4 border-green-700 bg-green-50 p-3 text-sm text-green-800">{mensaje}</p>}

      {esDirector && (
        <form onSubmit={registrarIglesia} className="mb-8 border-t-2 border-adventista-dorado pt-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><Plus className="h-4 w-4" /> Registrar iglesia</h2>
          <p className="mb-4 text-sm text-slate-600">La iglesia se asociará a tu cuenta para que después puedas registrar tu club.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input required maxLength={200} value={formIglesia.nombre} onChange={(event) => setFormIglesia({ ...formIglesia, nombre: event.target.value })} placeholder="Nombre de la iglesia" aria-label="Nombre de la iglesia" className="rounded border border-slate-300 px-3 py-2 text-sm" />
            <input maxLength={500} value={formIglesia.direccion} onChange={(event) => setFormIglesia({ ...formIglesia, direccion: event.target.value })} placeholder="Dirección" aria-label="Dirección de la iglesia" className="rounded border border-slate-300 px-3 py-2 text-sm" />
            <input maxLength={100} value={formIglesia.zona} onChange={(event) => setFormIglesia({ ...formIglesia, zona: event.target.value })} placeholder="Zona" aria-label="Zona" className="rounded border border-slate-300 px-3 py-2 text-sm" />
            <input maxLength={100} value={formIglesia.distrito} onChange={(event) => setFormIglesia({ ...formIglesia, distrito: event.target.value })} placeholder="Distrito" aria-label="Distrito" className="rounded border border-slate-300 px-3 py-2 text-sm" />
            <input required type="number" min="-90" max="90" step="any" value={formIglesia.latitud} onChange={(event) => setFormIglesia({ ...formIglesia, latitud: event.target.value })} placeholder="Latitud" aria-label="Latitud de la iglesia" className="rounded border border-slate-300 px-3 py-2 text-sm" />
            <input required type="number" min="-180" max="180" step="any" value={formIglesia.longitud} onChange={(event) => setFormIglesia({ ...formIglesia, longitud: event.target.value })} placeholder="Longitud" aria-label="Longitud de la iglesia" className="rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={guardando} className="mt-3 inline-flex items-center gap-2 rounded bg-adventista-azul px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Save className="h-4 w-4" /> Registrar y asociar
          </button>
        </form>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-800">Clubes asociados a tu cuenta</h2>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {clubs.map((club) => (
              <article key={club.id} className="space-y-4 border-b border-slate-200 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {club.logo_url ? <img src={club.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-adventista-azul"><Building2 className="h-5 w-5" /></span>}
                    <div>
                      <h3 className="font-medium text-slate-900">{club.nombre}</h3>
                      <p className="mt-1 text-sm capitalize text-slate-600">{club.tipo}</p>
                    </div>
                  </div>
                  {puedeGestionar && <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => editar(club)} className="inline-flex items-center gap-2 self-start rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                      <Pencil className="h-4 w-4" /> Editar perfil
                    </button>
                    <button type="button" onClick={() => gestionarLideres(club.id)} className="inline-flex items-center gap-2 self-start rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                      <Users className="h-4 w-4" /> Gestionar líderes
                    </button>
                  </div>}
                </div>
                {clubLideresAbierto === club.id && (
                  <section className="rounded-lg border border-slate-200 bg-slate-50 p-4" aria-label={`Líderes de ${club.nombre}`}>
                    <h3 className="font-semibold text-slate-900">Líderes del club</h3>
                    <div className="mt-3 divide-y divide-slate-200">
                      {lideresClub.leaders.map((lider) => (
                        <div key={lider.id} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{lider.nombre}</p>
                            <p className="truncate text-xs text-slate-500">{lider.email}</p>
                          </div>
                          <button type="button" onClick={() => quitarLider(club.id, lider.id)} className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700 hover:border-red-300 hover:text-red-700" aria-label={`Retirar a ${lider.nombre} del club`}>
                            <UserMinus className="h-3.5 w-3.5" /> Retirar
                          </button>
                        </div>
                      ))}
                      {lideresClub.leaders.length === 0 && <p className="py-2 text-sm text-slate-500">Todavía no hay líderes asignados.</p>}
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <select value={liderSeleccionado} onChange={(event) => setLiderSeleccionado(event.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="">Selecciona un líder de tu iglesia</option>
                        {lideresClub.available.map((lider) => <option key={lider.id} value={lider.id}>{lider.nombre} · {lider.email}</option>)}
                      </select>
                      <button type="button" disabled={!liderSeleccionado} onClick={() => agregarLider(club.id)} className="inline-flex items-center justify-center gap-2 rounded bg-adventista-azul px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        <UserPlus className="h-4 w-4" /> Asignar líder
                      </button>
                    </div>
                    {lideresClub.available.length === 0 && <p className="mt-2 text-xs text-slate-500">No hay otros líderes activos de tu iglesia disponibles.</p>}
                  </section>
                )}
              </article>
            ))}
            {clubs.length === 0 && <p className="py-5 text-sm text-slate-600">Aún no tienes clubes registrados.</p>}
          </div>
        </section>

        <form onSubmit={guardar} className="h-fit border-t-2 border-adventista-dorado pt-4">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            {clubEditando ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {clubEditando ? 'Editar club' : 'Registrar club'}
          </h2>
          {!user?.iglesia_id && <p className="mb-3 text-sm text-amber-800">Primero registra tu iglesia para poder asociar un club.</p>}
          <label className="mb-3 block text-sm font-medium text-slate-700">
            Nombre
            <input required maxLength={150} value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="mb-4 block text-sm font-medium text-slate-700">
            Tipo
            <select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })} className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 font-normal">
              <option value="conquistadores">Conquistadores</option>
              <option value="aventureros">Aventureros</option>
              <option value="ja">Jóvenes Adventistas</option>
            </select>
          </label>
          <label className="mb-4 block text-sm font-medium text-slate-700">
            URL del logo (opcional)
            <input type="url" maxLength={255} value={form.logo_url} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" placeholder="https://..." />
          </label>
          <div className="flex gap-2">
            <button disabled={guardando || !user?.iglesia_id} className="inline-flex flex-1 items-center justify-center gap-2 rounded bg-adventista-azul px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Save className="h-4 w-4" /> {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            {clubEditando && <button type="button" onClick={() => { setClubEditando(null); setForm(FORM_VACIO); }} aria-label="Cancelar edición" className="rounded border border-slate-300 px-3"><X className="h-4 w-4" /></button>}
          </div>
        </form>
      </div>
    </main>
  );
}