import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', iglesia_id: '' });
  const [iglesias, setIglesias] = useState([]);
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    authService.getIglesias().then(({ data }) => setIglesias(data?.iglesias || [])).catch(() => setIglesias([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      const result = await login(form.email, form.password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error);
      }
      return;
    }

    const result = await register({
      nombre: form.nombre,
      email: form.email,
      password: form.password,
      iglesia_id: form.iglesia_id || null,
      rol: 'lider',
    });

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex gap-2">
          <button onClick={() => setMode('login')} className={`flex-1 rounded-lg px-4 py-2 font-semibold ${mode === 'login' ? 'bg-adventista-azul text-white' : 'bg-slate-100 text-slate-700'}`}>
            Iniciar sesión
          </button>
          <button onClick={() => setMode('register')} className={`flex-1 rounded-lg px-4 py-2 font-semibold ${mode === 'register' ? 'bg-adventista-azul text-white' : 'bg-slate-100 text-slate-700'}`}>
            Registrarse
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={form.iglesia_id} onChange={(e) => setForm({ ...form, iglesia_id: e.target.value })}>
                <option value="">Selecciona tu iglesia (opcional)</option>
                {iglesias.map((iglesia) => <option key={iglesia.id} value={iglesia.id}>{iglesia.nombre}</option>)}
              </select>
            </>
          )}
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="email" placeholder="Correo electrónico" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required minLength={mode === 'register' ? 8 : undefined} className="w-full rounded-lg border border-slate-300 px-3 py-2" type="password" placeholder="Contraseña" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="w-full rounded-lg bg-adventista-dorado px-4 py-2 font-semibold text-slate-900">Continuar</button>
        </form>
      </div>
    </div>
  );
}
