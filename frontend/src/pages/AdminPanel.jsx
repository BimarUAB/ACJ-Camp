import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Building2, Users, MapPin, CalendarDays, BarChart3, CheckCircle, XCircle, ShieldCheck, Download, Trash2 } from 'lucide-react';
import lugarService from '../services/lugarService';
import reservaService from '../services/reservaService';
import authService from '../services/authService';
import reportService from '../services/reportService';
import uploadService from '../services/uploadService';
import clubService from '../services/clubService';
import iglesiaService from '../services/iglesiaService';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import ServicioIcono from '../components/ServicioIcono';

const TABS = [
  { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
  { id: 'lugares', label: 'Lugares', icon: MapPin },
  { id: 'reservas', label: 'Reservas', icon: CalendarDays },
  { id: 'iglesias', label: 'Iglesias y clubes', icon: Building2 },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
];

const SERVICIOS_OPCIONES = ['agua', 'baños', 'electricidad', 'fogata', 'senderos', 'rio', 'carpa', 'cocina', 'estacionamiento'];

const fechaLocalActual = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const periodoReserva = (reserva, hoy) => {
  const inicio = String(reserva.fecha_inicio).slice(0, 10);
  const fin = String(reserva.fecha_fin).slice(0, 10);
  if (fin < hoy) return 'pasadas';
  if (inicio > hoy) return 'futuras';
  return 'encurso';
};

export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('stats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stats, setStats] = useState(null);
  const [lugares, setLugares] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [reporteMes, setReporteMes] = useState([]);
  const [reporteZona, setReporteZona] = useState([]);
  const [lugaresPopulares, setLugaresPopulares] = useState([]);
  const [iglesias, setIglesias] = useState([]);
  const [directorioIglesias, setDirectorioIglesias] = useState([]);
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [busquedaReserva, setBusquedaReserva] = useState('');
  const [filtroEstadoReserva, setFiltroEstadoReserva] = useState('todos');
  const [filtroIglesiaReserva, setFiltroIglesiaReserva] = useState('todas');
  const [filtroClubReserva, setFiltroClubReserva] = useState('todos');
  const [filtroPeriodoReserva, setFiltroPeriodoReserva] = useState('todos');
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [formUsuario, setFormUsuario] = useState({ nombre: '', email: '', telefono: '', iglesia_id: '' });

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
    fotos: [],
  });
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const cargarTodo = async () => {
    try {
      setLoading(true);
      setError('');
      const [statsRes, lugRes, resRes, usrRes, mesRes, zonaRes, popularesRes, iglesiasRes, directorioRes] = await Promise.all([
        reportService.getDashboardStats(),
        lugarService.getAll({ estado: 'todos' }),
        reservaService.getAll(),
        authService.getAllUsers?.() || Promise.resolve({ data: { users: [] } }),
        reportService.getReservasPorMes(),
        reportService.getReservasPorZona(),
        reportService.getLugaresPopulares(),
        authService.getIglesias(),
        clubService.getDirectory()
      ]);
      setStats(statsRes.data?.stats || null);
      setLugares(lugRes.data?.lugares || []);
      setReservas(resRes.data?.reservas || []);
      setUsuarios(usrRes.data?.users || []);
      setReporteMes(mesRes.data?.reservas || []);
      setReporteZona(zonaRes.data?.reservas || []);
      setLugaresPopulares(popularesRes.data?.lugares || []);
      setIglesias(iglesiasRes.data?.iglesias || []);
      setDirectorioIglesias(directorioRes.data?.iglesias || []);
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
      await Swal.fire({ title: 'Lugar enviado', text: 'Quedó pendiente de aprobación.', icon: 'success', confirmButtonText: 'Entendido' });
      setFormLugar({
        nombre: '', descripcion: '', direccion: '', latitud: -17.3895, longitud: -66.1568,
        propietario: '', contacto: '', telefono: '', servicios: [], capacidad_maxima: 50, precio_aprox: '', fotos: []
      });
      cargarTodo();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear lugar');
    }
  };

  const aprobarLugar = async (id) => {
    try {
      await lugarService.aprobar(id);
      await cargarTodo();
      await Swal.fire({ title: 'Lugar aprobado', icon: 'success', confirmButtonText: 'Entendido' });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al aprobar lugar');
    }
  };

  const rechazarLugar = async (id) => {
    const confirmation = await Swal.fire({
      title: '¿Rechazar este lugar?',
      text: 'No aparecerá en las búsquedas públicas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Rechazar lugar',
      cancelButtonText: 'Volver'
    });
    if (!confirmation.isConfirmed) return;
    try {
      await lugarService.rechazar(id);
      await cargarTodo();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al rechazar lugar');
    }
  };

  const subirFotoLugar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setSubiendoFoto(true);
      const { data } = await uploadService.image(file);
      setFormLugar((actual) => ({ ...actual, fotos: [...actual.fotos, data.url] }));
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo subir la foto');
    } finally {
      setSubiendoFoto(false);
      event.target.value = '';
    }
  };

  const cambiarEstadoUsuario = async (id) => {
    const confirmacion = await Swal.fire({
      title: '¿Cambiar el acceso de este usuario?',
      text: 'Su historial se conservará.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Volver'
    });
    if (!confirmacion.isConfirmed) return;
    try {
      await authService.toggleUserStatus?.(id);
      await cargarTodo();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar estado');
    }
  };

  const cambiarRolUsuario = async (id, rol) => {
    try {
      const { data } = await authService.updateUserRole(id, rol);
      setUsuarios((actuales) => actuales.map((usuario) => usuario.id === id ? { ...usuario, rol: data.user.rol } : usuario));
      await Swal.fire({ title: 'Rol actualizado', text: 'El nuevo permiso se aplica en la próxima solicitud.', icon: 'success', confirmButtonText: 'Entendido' });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar el rol');
    }
  };

  const editarUsuario = (usuario) => {
    setUsuarioEditando(usuario.id);
    setFormUsuario({
      nombre: usuario.nombre,
      email: usuario.email,
      telefono: usuario.telefono || '',
      iglesia_id: usuario.iglesia_id || ''
    });
  };

  const guardarUsuario = async (event) => {
    event.preventDefault();
    try {
      const data = {
        ...formUsuario,
        iglesia_id: formUsuario.iglesia_id ? Number(formUsuario.iglesia_id) : null
      };
      await authService.updateUser(usuarioEditando, data);
      setUsuarioEditando(null);
      await cargarTodo();
      await Swal.fire({ title: 'Usuario actualizado', icon: 'success', confirmButtonText: 'Entendido' });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al editar usuario');
    }
  };

  const actualizarEstadoReserva = async (id, estado) => {
    try {
      await reservaService.update(id, { estado });
      await cargarTodo();
      await Swal.fire({
        title: estado === 'confirmada' ? 'Reserva aceptada' : estado === 'cancelada' ? 'Reserva rechazada' : 'Reserva completada',
        text: estado === 'confirmada' ? 'Las fechas ahora aparecen ocupadas para los demás.' : undefined,
        icon: 'success',
        confirmButtonText: 'Entendido'
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar reserva');
    }
  };

  const exportarExcel = async () => {
    try {
      const response = await reportService.exportarLugares();
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reporte-lugares.xlsx';
      a.click();
    } catch (err) {
      setError('Error al exportar Excel');
    }
  };

  const eliminarIglesia = async (iglesia) => {
    const confirmation = await Swal.fire({
      title: `¿Eliminar ${iglesia.nombre}?`,
      text: 'Solo se podrá eliminar si no tiene usuarios ni clubes asociados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar iglesia',
      cancelButtonText: 'Volver'
    });
    if (!confirmation.isConfirmed) return;
    try {
      await iglesiaService.delete(iglesia.id);
      await cargarTodo();
      await Swal.fire({ title: 'Iglesia eliminada', icon: 'success', confirmButtonText: 'Entendido' });
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar la iglesia.');
    }
  };

  const eliminarClub = async (club) => {
    const confirmation = await Swal.fire({
      title: `¿Eliminar ${club.nombre}?`,
      text: 'La cuenta de los líderes se conserva. No se podrá borrar si tiene reservas asociadas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar club',
      cancelButtonText: 'Volver'
    });
    if (!confirmation.isConfirmed) return;
    try {
      await clubService.delete(club.id);
      await cargarTodo();
      await Swal.fire({ title: 'Club eliminado', icon: 'success', confirmButtonText: 'Entendido' });
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar el club.');
    }
  };

  const hoy = fechaLocalActual();
  const directorioClubes = directorioIglesias.flatMap((iglesia) =>
    iglesia.clubs.map((club) => ({ ...club, iglesia_nombre: iglesia.nombre, iglesia_id: iglesia.id }))
  );
  const reservasFiltradas = reservas.filter((reserva) => {
    const texto = `${reserva.lugar_nombre || ''} ${reserva.usuario_nombre || ''} ${reserva.usuario_email || ''} ${reserva.club_nombre || ''} ${reserva.iglesia_nombre || ''} ${reserva.proposito || ''}`.toLocaleLowerCase('es');
    return (filtroEstadoReserva === 'todos' || reserva.estado === filtroEstadoReserva)
      && (filtroIglesiaReserva === 'todas' || String(reserva.iglesia_id) === filtroIglesiaReserva)
      && (filtroClubReserva === 'todos' || String(reserva.club_id) === filtroClubReserva)
      && (filtroPeriodoReserva === 'todos' || periodoReserva(reserva, hoy) === filtroPeriodoReserva)
      && texto.includes(busquedaReserva.trim().toLocaleLowerCase('es'));
  });
  const contarEstadoReserva = (estado) => reservas.filter((reserva) => reserva.estado === estado).length;

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

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 font-semibold text-slate-800">Reservas por zona</h2>
              <div className="divide-y divide-slate-100">
                {reporteZona.map((fila, index) => (
                  <div key={`${fila.zona || 'sin-zona'}-${index}`} className="flex justify-between py-2 text-sm">
                    <span>{fila.zona || 'Sin zona registrada'}</span><strong>{fila.total_reservas}</strong>
                  </div>
                ))}
                {reporteZona.length === 0 && <p className="text-sm text-slate-500">No hay datos.</p>}
              </div>
            </section>
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 font-semibold text-slate-800">Lugares más populares</h2>
              <div className="divide-y divide-slate-100">
                {lugaresPopulares.map((lugar) => (
                  <div key={lugar.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="truncate">{lugar.nombre}</span>
                    <span className="shrink-0 text-slate-600">{lugar.total_reservas} reservas · {Number(lugar.promedio_calificacion).toFixed(1)} ★</span>
                  </div>
                ))}
                {lugaresPopulares.length === 0 && <p className="text-sm text-slate-500">No hay datos.</p>}
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === 'iglesias' && (
        <section className="space-y-4" aria-label="Directorio de iglesias y clubes">
          {directorioIglesias.map((iglesia) => (
            <article key={iglesia.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <header className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-adventista-azul" />
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900">{iglesia.nombre}</h2>
                  {(iglesia.direccion || iglesia.zona || iglesia.distrito) && <p className="mt-1 text-sm text-slate-600">{[iglesia.direccion, iglesia.zona, iglesia.distrito].filter(Boolean).join(' · ')}</p>}
                </div>
                <span className="ml-auto shrink-0 text-xs text-slate-500">{iglesia.clubs.length} {iglesia.clubs.length === 1 ? 'club' : 'clubes'}</span>
                <button type="button" onClick={() => eliminarIglesia(iglesia)} title={`Eliminar iglesia ${iglesia.nombre}`} aria-label={`Eliminar iglesia ${iglesia.nombre}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              </header>
              <div className="divide-y divide-slate-200 px-5">
                {iglesia.clubs.map((club) => (
                  <section key={club.id} className="py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-slate-900">{club.nombre}</h3>
                        <p className="mt-0.5 text-xs capitalize text-slate-500">{club.tipo}{club.director_nombre ? ` · Director: ${club.director_nombre}` : ''}</p>
                      </div>
                      <span className="text-xs text-slate-500">{club.lideres.length} {club.lideres.length === 1 ? 'líder' : 'líderes'}</span>
                      <button type="button" onClick={() => eliminarClub(club)} title={`Eliminar club ${club.nombre}`} aria-label={`Eliminar club ${club.nombre}`} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {club.lideres.length > 0 ? (
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {club.lideres.map((lider) => (
                          <li key={lider.id} className="flex min-w-0 items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                            <Users className="mt-0.5 h-4 w-4 shrink-0 text-adventista-verde" />
                            <span className="min-w-0">
                              <strong className="block truncate text-sm font-medium text-slate-800">{lider.nombre}</strong>
                              <span className="block truncate text-xs text-slate-500">{lider.email}{lider.telefono ? ` · ${lider.telefono}` : ''}</span>
                              {lider.estado === 'inactivo' && <span className="text-xs font-medium text-red-700">Cuenta inactiva</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-3 text-sm text-slate-500">Este club todavía no tiene líderes asignados.</p>}
                  </section>
                ))}
                {iglesia.clubs.length === 0 && <p className="py-4 text-sm text-slate-500">Esta iglesia todavía no tiene clubes registrados.</p>}
              </div>
            </article>
          ))}
          {directorioIglesias.length === 0 && <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">No hay iglesias registradas.</p>}
        </section>
      )}

      {tab === 'lugares' && (
        <>
        {lugares.some((lugar) => lugar.estado === 'pendiente') && (
          <section className="mb-6 border-l-4 border-amber-500 bg-amber-50 p-5" aria-labelledby="pendientes-aprobacion">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="pendientes-aprobacion" className="font-semibold text-amber-950">Pendientes de aprobación</h2>
                <p className="mt-1 text-sm text-amber-900">{lugares.filter((lugar) => lugar.estado === 'pendiente').length} lugares esperan revisión.</p>
              </div>
            </div>
            <div className="divide-y divide-amber-200">
              {lugares.filter((lugar) => lugar.estado === 'pendiente').map((lugar) => (
                <article key={lugar.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-medium text-slate-900">{lugar.nombre}</h3>
                    <p className="text-sm text-slate-600">{lugar.direccion || 'Sin dirección'}{lugar.creador_nombre ? ` · Propuesto por ${lugar.creador_nombre}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => aprobarLugar(lugar.id)} className="inline-flex items-center gap-1 rounded bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800">
                      <CheckCircle className="h-4 w-4" /> Aprobar
                    </button>
                    <button type="button" onClick={() => rechazarLugar(lugar.id)} className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50">
                      <XCircle className="h-4 w-4" /> Rechazar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={crearLugar} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold text-slate-800">Agregar lugar</h2>
            <div className="mt-4 space-y-3">
              <input required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Nombre" value={formLugar.nombre} onChange={(e) => setFormLugar({ ...formLugar, nombre: e.target.value })} />
              <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Descripción" value={formLugar.descripcion} onChange={(e) => setFormLugar({ ...formLugar, descripcion: e.target.value })} />
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Dirección" value={formLugar.direccion} onChange={(e) => setFormLugar({ ...formLugar, direccion: e.target.value })} />
              <label className="block text-sm font-medium text-slate-700">
                Fotos del lugar
                <input type="file" accept="image/*" onChange={subirFotoLugar} className="mt-1 block w-full text-sm" />
              </label>
              {subiendoFoto && <p className="text-xs text-slate-500">Subiendo foto...</p>}
              {formLugar.fotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formLugar.fotos.map((foto) => <img key={foto} src={foto} alt="Foto del lugar" className="h-16 w-20 rounded object-cover" />)}
                </div>
              )}
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
                      <ServicioIcono servicio={s} iconClassName="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={subiendoFoto} className="w-full rounded-lg bg-adventista-azul py-2 font-semibold text-white disabled:opacity-50">Guardar lugar</button>
            </div>
          </form>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Lugares registrados</h2>
              <button onClick={exportarExcel} className="flex items-center gap-1 rounded-lg bg-adventista-dorado px-3 py-1.5 text-sm font-semibold text-slate-900">
                <Download className="h-4 w-4" /> Exportar Excel
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
      )}

      {tab === 'reservas' && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-800">Todas las reservas</h2>
              <p className="mt-1 text-xs text-slate-500">{reservasFiltradas.length} de {reservas.length} · {contarEstadoReserva('pendiente')} pendientes · {contarEstadoReserva('confirmada')} confirmadas · {contarEstadoReserva('completada')} completadas · {contarEstadoReserva('cancelada')} canceladas</p>
            </div>
            <button type="button" onClick={() => { setBusquedaReserva(''); setFiltroEstadoReserva('todos'); setFiltroIglesiaReserva('todas'); setFiltroClubReserva('todos'); setFiltroPeriodoReserva('todos'); }} className="text-sm font-semibold text-adventista-azul hover:underline">Limpiar filtros</button>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input value={busquedaReserva} onChange={(event) => setBusquedaReserva(event.target.value)} placeholder="Buscar líder, lugar o motivo" aria-label="Buscar reserva" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={filtroIglesiaReserva} onChange={(event) => { setFiltroIglesiaReserva(event.target.value); setFiltroClubReserva('todos'); }} aria-label="Filtrar por iglesia" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="todas">Todas las iglesias</option>
              {directorioIglesias.map((iglesia) => <option key={iglesia.id} value={iglesia.id}>{iglesia.nombre}</option>)}
            </select>
            <select value={filtroClubReserva} onChange={(event) => setFiltroClubReserva(event.target.value)} aria-label="Filtrar por club" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="todos">Todos los clubes</option>
              {directorioClubes.filter((club) => filtroIglesiaReserva === 'todas' || String(club.iglesia_id) === filtroIglesiaReserva).map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}
            </select>
            <select value={filtroEstadoReserva} onChange={(event) => setFiltroEstadoReserva(event.target.value)} aria-label="Filtrar por estado" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="confirmada">Confirmadas</option>
              <option value="completada">Completadas</option>
              <option value="cancelada">Canceladas</option>
            </select>
            <select value={filtroPeriodoReserva} onChange={(event) => setFiltroPeriodoReserva(event.target.value)} aria-label="Filtrar por periodo" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="todos">Todas las fechas</option>
              <option value="futuras">Próximas</option>
              <option value="encurso">En curso</option>
              <option value="pasadas">Pasadas</option>
            </select>
          </div>
          <div className="space-y-3">
            {reservasFiltradas.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{r.lugar_nombre || `Lugar #${r.lugar_id}`}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><CalendarDays className="h-4 w-4" /> {r.fecha_inicio} → {r.fecha_fin}</p>
                    <p className="mt-1 text-sm text-slate-600">Solicitante: {r.usuario_nombre || r.usuario_id}{r.usuario_email ? ` · ${r.usuario_email}` : ''}</p>
                    <p className="text-sm text-slate-600">Iglesia: {r.iglesia_nombre || 'Sin iglesia registrada'}</p>
                    <p className="text-sm text-slate-600">Club: {r.club_nombre || 'Sin club asociado'}</p>
                    <p className="mt-1 text-sm text-slate-700">Motivo: {r.proposito || 'No indicado'}</p>
                    {r.estado === 'pendiente' && r.expires_at && <p className="mt-1 text-xs font-medium text-amber-800">Esperando confirmación del líder hasta {new Date(r.expires_at).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${r.estado === 'confirmada' ? 'bg-emerald-100 text-emerald-800' : r.estado === 'pendiente' ? 'bg-amber-100 text-amber-800' : r.estado === 'cancelada' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{r.estado}</span>
                    {r.estado === 'pendiente' && <button type="button" aria-label={`Cancelar solicitud ${r.id}`} title="Cancelar solicitud" onClick={() => actualizarEstadoReserva(r.id, 'cancelada')} className="rounded-full bg-red-100 p-2 text-red-700 hover:bg-red-200"><XCircle className="h-4 w-4" /></button>}
                    {r.estado === 'confirmada' && <>
                      <button type="button" aria-label={`Marcar reserva ${r.id} completada`} title="Marcar completada" onClick={() => actualizarEstadoReserva(r.id, 'completada')} className="rounded-full bg-blue-100 p-2 text-blue-700 hover:bg-blue-200"><CheckCircle className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Cancelar reserva ${r.id}`} title="Cancelar reserva" onClick={() => actualizarEstadoReserva(r.id, 'cancelada')} className="rounded-full bg-red-100 p-2 text-red-700 hover:bg-red-200"><XCircle className="h-4 w-4" /></button>
                    </>}
                  </div>
                </div>
              </div>
            ))}
            {reservasFiltradas.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No hay reservas que coincidan con los filtros.</p>}
          </div>
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 font-semibold text-slate-800">Gestión de usuarios</h2>
          <input value={busquedaUsuario} onChange={(event) => setBusquedaUsuario(event.target.value)} placeholder="Buscar por nombre o correo" className="mb-4 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2" />
          <div className="space-y-3">
            {usuarios.filter((u) => `${u.nombre} ${u.email}`.toLowerCase().includes(busquedaUsuario.toLowerCase())).map((u) => (
              <div key={u.id} className="rounded-xl border border-slate-200 p-4">
                {usuarioEditando === u.id ? (
                  <form onSubmit={guardarUsuario} className="grid gap-3 sm:grid-cols-2">
                    <input required value={formUsuario.nombre} onChange={(event) => setFormUsuario({ ...formUsuario, nombre: event.target.value })} aria-label="Nombre" className="rounded-lg border border-slate-300 px-3 py-2" />
                    <input required type="email" value={formUsuario.email} onChange={(event) => setFormUsuario({ ...formUsuario, email: event.target.value })} aria-label="Correo" className="rounded-lg border border-slate-300 px-3 py-2" />
                    <input value={formUsuario.telefono} onChange={(event) => setFormUsuario({ ...formUsuario, telefono: event.target.value })} aria-label="Teléfono" placeholder="Teléfono" className="rounded-lg border border-slate-300 px-3 py-2" />
                    <select value={formUsuario.iglesia_id} onChange={(event) => setFormUsuario({ ...formUsuario, iglesia_id: event.target.value })} aria-label="Iglesia" className="rounded-lg border border-slate-300 bg-white px-3 py-2">
                      <option value="">Sin iglesia asignada</option>
                      {iglesias.map((iglesia) => <option key={iglesia.id} value={iglesia.id}>{iglesia.nombre}</option>)}
                    </select>
                    <div className="flex gap-2 sm:col-span-2">
                      <button className="rounded bg-adventista-azul px-3 py-2 text-sm font-semibold text-white">Guardar cambios</button>
                      <button type="button" onClick={() => setUsuarioEditando(null)} className="rounded border border-slate-300 px-3 py-2 text-sm">Cancelar</button>
                    </div>
                  </form>
                ) : <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{u.nombre}</p>
                  <p className="text-sm text-slate-600">{u.email}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.estado}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label={`Rol de ${u.nombre}`} disabled={u.id === Number(currentUser?.id)} value={u.rol} onChange={(event) => cambiarRolUsuario(u.id, event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                    <option value="lider">Líder</option><option value="director">Director</option><option value="admin">Administrador</option>
                  </select>
                  <button onClick={() => editarUsuario(u)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium">Editar</button>
                  <button onClick={() => cambiarEstadoUsuario(u.id)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
                    {u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
                </div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
