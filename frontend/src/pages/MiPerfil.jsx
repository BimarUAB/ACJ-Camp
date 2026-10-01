import { useEffect, useState } from 'react';
import { KeyRound, Save, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import clubService from '../services/clubService';

export default function MiPerfil() {
  const { user, updateUser } = useAuth();
  const isLeader = user?.rol === 'lider';
  const clubesPerfil = user?.clubs?.length
    ? user.clubs
    : user?.club_nombre
      ? [{ nombre: user.club_nombre, iglesia_nombre: user.iglesia_nombre }]
      : [];
  const [form, setForm] = useState({
    nombre: user?.nombre || '',
    telefono: user?.telefono || '',
    iglesia_id: user?.iglesia_id ? String(user.iglesia_id) : '',
    club_id: user?.club_id ? String(user.club_id) : '',
  });
  const [iglesias, setIglesias] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ passwordActual: '', passwordNueva: '' });
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!isLeader) return;
    authService.getIglesias()
      .then(({ data }) => setIglesias(data?.iglesias || []))
      .catch(() => setError('No se pudieron cargar las iglesias.'));
  }, [isLeader]);

  useEffect(() => {
    if (!isLeader || !form.iglesia_id) {
      setClubs([]);
      return;
    }
    clubService.getAll({ iglesia_id: Number(form.iglesia_id) })
      .then(({ data }) => setClubs(data?.clubs || []))
      .catch(() => setError('No se pudieron cargar los clubes.'));
  }, [form.iglesia_id, isLeader]);

  const guardarPerfil = async (event) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    try {
      setGuardandoPerfil(true);
      const profileData = {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
      };
      if (isLeader) {
        profileData.iglesia_id = form.iglesia_id ? Number(form.iglesia_id) : null;
        profileData.club_id = form.club_id ? Number(form.club_id) : null;
      }
      const { data } = await authService.updateProfile(profileData);
      updateUser(data.user);
      setForm((current) => ({
        ...current,
        iglesia_id: data.user.iglesia_id ? String(data.user.iglesia_id) : '',
        club_id: data.user.club_id ? String(data.user.club_id) : '',
      }));
      setMensaje('Tu perfil se actualizó correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar tu perfil.');
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const cambiarPassword = async (event) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    try {
      setGuardandoPassword(true);
      await authService.changePassword(passwordForm);
      setPasswordForm({ passwordActual: '', passwordNueva: '' });
      setMensaje('Tu contraseña se cambió correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardandoPassword(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <UserRound className="h-6 w-6 text-adventista-azul" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-adventista-verde">Cuenta ACJ-Camp</p>
            <h1 className="text-2xl font-semibold text-slate-900">Mi perfil</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">{user?.email} · <span className="capitalize">{user?.rol}</span>{user?.iglesia_nombre ? ` · Iglesia: ${user.iglesia_nombre}` : ''}</p>
        {clubesPerfil.length > 0 && <p className="mt-1 text-sm text-slate-600">Clubes: {clubesPerfil.map((club) => `${club.nombre}${club.iglesia_nombre ? ` · ${club.iglesia_nombre}` : ''}`).join(' / ')}</p>}
      </header>

      {error && <p role="alert" className="mb-4 border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {mensaje && <p role="status" className="mb-4 border-l-4 border-emerald-700 bg-emerald-50 p-3 text-sm text-emerald-800">{mensaje}</p>}

      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={guardarPerfil} className="h-fit border-t-2 border-adventista-dorado pt-4">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Datos personales</h2>
          <label className="mb-4 block text-sm font-medium text-slate-700">
            Nombre completo
            <input required maxLength={150} value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="mb-4 block text-sm font-medium text-slate-700">
            Teléfono
            <input type="tel" maxLength={20} value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
          </label>
          {isLeader && <section className="mb-5 border-t border-slate-200 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Iglesia y club</h3>
            <label className="mb-3 block text-sm font-medium text-slate-700">
              Iglesia
              <select value={form.iglesia_id} onChange={(event) => setForm({ ...form, iglesia_id: event.target.value, club_id: '' })} className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 font-normal">
                <option value="">Sin iglesia asignada</option>
                {iglesias.map((iglesia) => <option key={iglesia.id} value={iglesia.id}>{iglesia.nombre}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Club
              <select value={form.club_id} onChange={(event) => setForm({ ...form, club_id: event.target.value })} disabled={!form.iglesia_id} className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 font-normal disabled:bg-slate-100">
                <option value="">Sin club asignado</option>
                {clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre} · {club.tipo}</option>)}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">Puedes elegir un club existente de la iglesia seleccionada. Los directores registran iglesias y clubes nuevos.</span>
            </label>
          </section>}
          <label className="mb-5 block text-sm font-medium text-slate-700">
            Correo electrónico
            <input type="email" value={user?.email || ''} readOnly className="mt-1 w-full rounded border border-slate-200 bg-slate-100 px-3 py-2 font-normal text-slate-500" />
          </label>
          <button type="submit" disabled={guardandoPerfil} className="inline-flex items-center gap-2 rounded bg-adventista-azul px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Save className="h-4 w-4" /> {guardandoPerfil ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </form>

        <form onSubmit={cambiarPassword} className="h-fit border-t-2 border-adventista-dorado pt-4">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900"><KeyRound className="h-5 w-5 text-adventista-azul" /> Seguridad</h2>
          <label className="mb-4 block text-sm font-medium text-slate-700">
            Contraseña actual
            <input required type="password" autoComplete="current-password" value={passwordForm.passwordActual} onChange={(event) => setPasswordForm({ ...passwordForm, passwordActual: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="mb-5 block text-sm font-medium text-slate-700">
            Nueva contraseña
            <input required type="password" minLength={8} autoComplete="new-password" value={passwordForm.passwordNueva} onChange={(event) => setPasswordForm({ ...passwordForm, passwordNueva: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
            <span className="mt-1 block text-xs font-normal text-slate-500">Debe tener al menos 8 caracteres.</span>
          </label>
          <button type="submit" disabled={guardandoPassword} className="inline-flex items-center gap-2 rounded bg-adventista-azul px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <KeyRound className="h-4 w-4" /> {guardandoPassword ? 'Actualizando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </main>
  );
}