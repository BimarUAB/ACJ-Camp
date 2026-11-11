import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import { TentTree, ArrowRight } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', iglesia_id: '' });
  const [iglesias, setIglesias] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    authService.getIglesias().then(({ data }) => setIglesias(data?.iglesias || [])).catch(() => setIglesias([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setError('');
    setEnviando(true);

    try {
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
    } catch {
      setError('No se pudo conectar. Intenta nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="camp-auth">
      <section className="camp-auth-story">
        <TentTree size={42} strokeWidth={1.4} aria-hidden="true" />
        <h1>Las mejores historias empiezan al aire libre.</h1>
        <p>Encuentra tu próximo campamento, organiza una salida con tu club y guarda nuevas experiencias en Bolivia.</p>
      </section>
      <section className="camp-auth-card" aria-labelledby="auth-title">
        <h2 id="auth-title">{mode === 'login' ? 'Qué bueno verte de nuevo' : 'Tu próxima aventura te espera'}</h2>
        <p className="mt-2 text-sm text-slate-600">{mode === 'login' ? 'Ingresa a tu cuenta para continuar.' : 'Crea tu cuenta y comienza a explorar.'}</p>
        <div className="camp-auth-tabs" role="group" aria-label="Acceso a la cuenta">
          <button disabled={enviando} aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>
            Iniciar sesión
          </button>
          <button disabled={enviando} aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>
            Registrarse
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={enviando}>
          {mode === 'register' && (
            <>
              <label>Nombre completo<input required autoComplete="name" placeholder="Tu nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
              <label>Iglesia <span className="text-xs font-normal text-slate-500">Opcional</span><select value={form.iglesia_id} onChange={(e) => setForm({ ...form, iglesia_id: e.target.value })}>
                <option value="">Selecciona tu iglesia (opcional)</option>
                {iglesias.map((iglesia) => <option key={iglesia.id} value={iglesia.id}>{iglesia.nombre}</option>)}
              </select></label>
            </>
          )}
          <label>Correo electrónico<input required autoComplete="email" type="email" placeholder="nombre@correo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Contraseña<input required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : undefined} type="password" placeholder={mode === 'register' ? 'Al menos 8 caracteres' : 'Tu contraseña'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={enviando} className="camp-auth-submit disabled:opacity-60">{enviando ? 'Un momento…' : mode === 'login' ? 'Iniciar sesión' : 'Crear mi cuenta'}<ArrowRight size={16} aria-hidden="true" /></button>
        </form>
      </section>
    </main>
  );
}
