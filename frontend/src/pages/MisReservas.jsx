import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { CalendarDays, CheckCircle, Clock, MapPin, Phone, Trash2, XCircle } from 'lucide-react';
import reservaService from '../services/reservaService';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

const estadoClase = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  confirmada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
  completada: 'bg-blue-100 text-blue-700'
};

const estadoIcono = {
  pendiente: Clock,
  confirmada: CheckCircle,
  cancelada: XCircle,
  completada: CheckCircle
};

export default function MisReservas() {
  const { user } = useAuth();
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(Date.now());

  const cargar = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await reservaService.getMisReservas();
      setReservas(data?.reservas || data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar reservas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    const interval = window.setInterval(async () => {
      setAhora(Date.now());
      try {
        const { data } = await reservaService.getMisReservas();
        setReservas(data?.reservas || data || []);
      } catch {
        // Keep the current list visible if the periodic refresh fails.
      }
    }, 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const confirmarConLugar = async (reserva) => {
    const confirmacion = await Swal.fire({
      title: '¿El lugar confirmó tu reserva?',
      text: 'Al confirmar, estas fechas quedarán ocupadas para los demás usuarios.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar reserva',
      cancelButtonText: 'Todavía no'
    });
    if (!confirmacion.isConfirmed) return;

    try {
      await reservaService.confirmarConLugar(reserva.id);
      await Swal.fire({ title: 'Reserva confirmada', text: 'Las fechas ya aparecen ocupadas.', icon: 'success', confirmButtonText: 'Entendido' });
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo confirmar la reserva.');
      await cargar();
    }
  };

  const cancelar = async (id) => {
    const confirmation = await Swal.fire({
      title: '¿Cancelar esta reserva?',
      text: 'La reserva quedará en tu historial y las fechas se liberarán.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'Volver'
    });
    if (!confirmation.isConfirmed) return;
    try {
      await reservaService.update(id, { estado: 'cancelada' });
      await Swal.fire({ title: 'Reserva cancelada', text: 'Las fechas ya están disponibles.', icon: 'success', confirmButtonText: 'Entendido' });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cancelar reserva');
    }
  };

  if (loading) return <Loading message="Cargando reservas..." />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">{user?.rol === 'director' ? 'Reservas de mis clubes' : 'Mis reservas'}</h1>
      {user?.rol === 'director' && <p className="mt-1 text-sm text-slate-600">Solicitudes realizadas por ti y por los líderes de tus clubes.</p>}
      {error && <div className="mt-4"><ErrorMessage message={error} onRetry={cargar} /></div>}

      <div className="mt-6 space-y-4">
        {reservas.map((reserva) => {
          const Icon = estadoIcono[reserva.estado] || Clock;
          return (
            <div key={reserva.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <MapPin className="h-4 w-4 text-adventista-azul" />
                    {reserva.lugar_nombre || `Lugar #${reserva.lugar_id}`}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <CalendarDays className="h-4 w-4" />
                    {reserva.fecha_inicio} → {reserva.fecha_fin}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">Solicitante: {reserva.usuario_nombre || user?.nombre}</p>
                  <p className="mt-1 text-sm text-slate-600">Club: {reserva.club_nombre || 'Sin club asociado'}</p>
                  <p className="mt-1 text-sm text-slate-600">Referencia del lugar: #{reserva.lugar_id}</p>
                  {reserva.lugar_telefono && (
                    <a href={`tel:${reserva.lugar_telefono}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-adventista-azul hover:underline">
                      <Phone className="h-4 w-4" /> Contactar lugar: {reserva.lugar_telefono}
                    </a>
                  )}
                  {reserva.lugar_contacto && <p className="mt-1 text-sm text-slate-600">Contacto: {reserva.lugar_contacto}</p>}
                  {reserva.proposito && (
                    <p className="mt-1 text-sm text-slate-500">Motivo: {reserva.proposito}</p>
                  )}
                  {reserva.estado === 'pendiente' && reserva.expires_at && (
                    <p className="mt-2 text-sm font-medium text-amber-800">
                      {Date.parse(reserva.expires_at) <= ahora
                        ? 'Plazo vencido; las fechas se liberarán automáticamente.'
                        : `Contacta el lugar y confirma antes del ${new Date(reserva.expires_at).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}.`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold capitalize ${estadoClase[reserva.estado] || 'bg-slate-100 text-slate-700'}`}>
                    <Icon className="h-3.5 w-3.5" /> {reserva.estado}
                  </span>
                  {Number(reserva.usuario_id) === Number(user?.id) && reserva.estado !== 'cancelada' && reserva.estado !== 'completada' && (
                    <button
                      onClick={() => cancelar(reserva.id)}
                      className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" /> Cancelar
                    </button>
                  )}
                  {reserva.estado === 'pendiente' && (
                    <button
                      type="button"
                      onClick={() => confirmarConLugar(reserva)}
                      disabled={!reserva.expires_at || Date.parse(reserva.expires_at) <= ahora}
                      className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" /> Ya confirmé con el lugar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {reservas.length === 0 && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            No tienes reservas aún.
          </div>
        )}
      </div>
    </div>
  );
}
