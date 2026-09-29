import { useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clubService from '../services/clubService';
import Loading from '../components/Loading';

const FORM_VACIO = { nombre: '', tipo: 'conquistadores' };

export default function GestionClubs() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [clubEditando, setClubEditando] = useState(null);
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

  const editar = (club) => {
    setClubEditando(club.id);
    setForm({ nombre: club.nombre, tipo: club.tipo });
    setMensaje('');
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-800">Clubes asociados a tu cuenta</h2>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {clubs.map((club) => (
              <article key={club.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">{club.nombre}</h3>
                  <p className="mt-1 text-sm capitalize text-slate-600">{club.tipo}</p>
                </div>
                <button type="button" onClick={() => editar(club)} className="inline-flex items-center gap-2 self-start rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 sm:self-auto">
                  <Pencil className="h-4 w-4" /> Editar
                </button>
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
          <div className="flex gap-2">
            <button disabled={guardando} className="inline-flex flex-1 items-center justify-center gap-2 rounded bg-adventista-azul px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Save className="h-4 w-4" /> {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            {clubEditando && <button type="button" onClick={() => { setClubEditando(null); setForm(FORM_VACIO); }} aria-label="Cancelar edición" className="rounded border border-slate-300 px-3"><X className="h-4 w-4" /></button>}
          </div>
        </form>
      </div>
    </main>
  );
}