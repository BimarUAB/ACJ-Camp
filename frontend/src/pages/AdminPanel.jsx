import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, MapPin, CalendarDays, BarChart3, CheckCircle, XCircle, ShieldCheck, Trash2, Download } from 'lucide-react';
import lugarService from '../services/lugarService';
import reservaService from '../services/reservaService';
import authService from '../services/authService';
import reportService from '../services/reportService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

const TABS = [
  { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
  { id: 'lugares', label: 'Lugares', icon: MapPin },
  { id: 'reservas', label: 'Reservas', icon: CalendarDays },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
];

const SERVICIOS_OPCIONES = ['agua', 'baños', 'electricidad', 'fogata', 'senderos', 'rio', 'carpa', 'cocina', 'estacionamiento'];

export default function AdminPanel() {
  const [tab, setTab] = useState('stats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stats, setStats] = useState(null);
  const [lugares, setLugares] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [reporteMes, setReporteMes] = useState([]);

  const [formLugar, setFormLugar] = useState({
    nombre: '',
    descripcion: '',
    direccion: '',
    latitud: -17.3895,
    longitud: -66.1568,
    propietario: '',
    contacto: '',
    telefono: '',
    servicios: [],
    capacidad_maxima: 50,
    precio_aprox: '',
  });

  const cargarTodo = async () => {
    try {
      setLoading(true);
      setError('');
      const [statsRes, lugRes, resRes, usrRes, mesRes] = await Promise.all([
        reportService.getDashboardStats(),
        lugarService.getAll({ estado: 'todos' }),
        reservaService.getAll(),
        authService.getAllUsers?.() || Promise.resolve({ data: { users: [] } }),
        reportService.getReservasPorMes()
      ]);
      setStats(statsRes.data?.stats || null);
      setLugares(lugRes.data?.lugares || []);
      setReservas(resRes.data?.reservas || []);
      setUsuarios(usrRes.data?.users || []);
      setReporteMes(mesRes.data?.reservas || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar panel de administración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  const toggleServicio = (s) => {
    setFormLugar((prev) => ({
      ...prev,
      servicios: prev.servicios.includes(s) ? prev.servicios.filter((x) => x !== s) : [...prev.servicios, s]
    }));
  };

  const crearLugar = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await lugarService.create(formLugar);
      alert('Lugar creado exitosamente');
      setFormLugar({
        nombre: '', descripcion: '', direccion: '', latitud: -17.3895, longitud: -66.1568,
        propietario: '', contacto: '', telefono: '', servicios: [], capacidad_maxima: 50, precio_aprox: ''
      });
      cargarTodo();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear lugar');
    }
  };

  const aprobarLugar = async (id) => {
    try {
      await lugarService.aprobar(id);
      cargarTodo();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al aprobar lugar');
    }
  };

  const cambiarEstadoUsuario = async (id) => {
    try {
      await authService.toggleUserStatus?.(id);
      cargarTodo();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar estado');
    }
  };

  const actualizarEstadoReserva = async (id, estado) => {
    try {
      await reservaService.update(id, { estado });
      cargarTodo();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar reserva');
    }
  };

  const exportarCSV = async () => {
    try {
      const response = await reportService.exportarLugares();
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lugares.csv';
      a.click();
    } catch (err) {
      setError('Error al exportar CSV');
    }
  };

  if (loading) return <Loading message="Cargando panel..." />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-adventista-azul" />
        <h1 className="text-2xl font-semibold text-slate-900">Panel de administración</h1>
      </div>

      {error && <div className="mb-6"><ErrorMessage message={error} onRetry={cargarTodo} /></div>}

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              tab === id ? 'bg-adventista-azul text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'stats' && stats && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Lugares</p>
              <p className="text-2xl font-bold text-adventista-azul">{stats.total_lugares}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Reservas</p>
              <p className="text-2xl font-bold text-adventista-azul">{stats.total_reservas}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Usuarios</p>
              <p className="text-2xl font-bold text-adventista-azul">{stats.total_usuarios}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Pendientes</p>
              <p className="text-2xl font-bold text-adventista-rojo">{stats.lugares_pendientes}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-4 font-semibold text-slate-800">Reservas por mes</h2>
            {reporteMes.length > 0 ? (
              <div className="space-y-2">
                {reporteMes.map((r) => (
                  <div key={r.mes} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                    <span className="font-medium">{r.mes}</span>
                    <span className="rounded-full bg-adventista-azul px-3 py-1 text-sm font-semibold text-white">{r.total}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No hay datos suficientes.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'lugares' && (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={crearLugar} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold text-slate-800">Agregar lugar</h2>
            <div className="mt-4 space-y-3">
              <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Nombre" value={formLugar.nombre} onChange={(e) => setFormLugar({ ...formLugar, nombre: e.target.value })} />
              <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Descripción" value={formLugar.descripcion} onChange={(e) => setFormLugar({ ...formLugar, descripcion: e.target.value })} />
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Dirección" value={formLugar.direccion} onChange={(e) => setFormLugar({ ...formLugar, direccion: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.0001" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Latitud" value={formLugar.latitud} onChange={(e) => setFormLugar({ ...formLugar, latitud: Number(e.target.value) })} />
                <input type="number" step="0.0001" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Longitud" value={formLugar.longitud} onChange={(e) => setFormLugar({ ...formLugar, longitud: Number(e.target.value) })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Capacidad máxima" value={formLugar.capacidad_maxima} onChange={(e) => setFormLugar({ ...formLugar, capacidad_maxima: Number(e.target.value) })} />
                <input type="number" step="0.01" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Precio aprox." value={formLugar.precio_aprox} onChange={(e) => setFormLugar({ ...formLugar, precio_aprox: e.target.value })} />
              </div>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Propietario" value={formLugar.propietario} onChange={(e) => setFormLugar({ ...formLugar, propietario: e.target.value })} />
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Teléfono" value={formLugar.telefono} onChange={(e) => setFormLugar({ ...formLugar, telefono: e.target.value })} />
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Servicios</p>
                <div className="flex flex-wrap gap-2">
                  {SERVICIOS_OPCIONES.map((s) => (
                    <button key={s} type="button" onClick={() => toggleServicio(s)} className={`rounded-full px-3 py-1 text-xs capitalize ${formLugar.servicios.includes(s) ? 'bg-adventista-azul text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full rounded-lg bg-adventista-azul py-2 font-semibold text-white">Guardar lugar</button>
            </div>
          </form>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Lugares registrados</h2>
              <button onClick={exportarCSV} className="flex items-center gap-1 rounded-lg bg-adventista-dorado px-3 py-1.5 text-sm font-semibold text-slate-900">
                <Download className="h-4 w-4" /> Exportar CSV
              </button>
            </div>
            <div className="space-y-3">
              {lugares.map((lugar) => (
                <div key={lugar.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{lugar.nombre}</p>
                      <p className="text-sm text-slate-600">{lugar.direccion}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                        lugar.estado === 'activo' ? 'bg-green-100 text-green-700' : lugar.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {lugar.estado}
                      </span>
                    </div>
                    {lugar.estado === 'pendiente' && (
                      <button onClick={() => aprobarLugar(lugar.id)} className="rounded-full bg-green-100 p-2 text-green-700 hover:bg-green-200">
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'reservas' && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 font-semibold text-slate-800">Todas las reservas</h2>
          <div className="space-y-3">
            {reservas.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{r.lugar_nombre || `Lugar #${r.lugar_id}`}</p>
                    <p className="text-sm text-slate-600">{r.fecha_inicio} → {r.fecha_fin}</p>
                    <p className="text-xs text-slate-500">Solicitante: {r.usuario_nombre || r.usuario_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{r.estado}</span>
                    <button onClick={() => actualizarEstadoReserva(r.id, 'confirmada')} className="rounded-full bg-green-100 p-2 text-green-700 hover:bg-green-200"><CheckCircle className="h-4 w-4" /></button>
                    <button onClick={() => actualizarEstadoReserva(r.id, 'cancelada')} className="rounded-full bg-red-100 p-2 text-red-700 hover:bg-red-200"><XCircle className="h-4 w-4" /></button>
                    <button onClick={() => actualizarEstadoReserva(r.id, 'completada')} className="rounded-full bg-blue-100 p-2 text-blue-700 hover:bg-blue-200"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 font-semibold text-slate-800">Gestión de usuarios</h2>
          <div className="space-y-3">
            {usuarios.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                <div>
                  <p className="font-semibold text-slate-900">{u.nombre}</p>
                  <p className="text-sm text-slate-600">{u.email}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.estado}
                  </span>
                </div>
                <button onClick={() => cambiarEstadoUsuario(u.id)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
                  {u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
