import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

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
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          )}
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="email" placeholder="Correo electrónico" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="password" placeholder="Contraseña" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="w-full rounded-lg bg-adventista-dorado px-4 py-2 font-semibold text-slate-900">Continuar</button>
        </form>
      </div>
    </div>
  );
}
