import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react';
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
  }, []);

  const cancelar = async (id) => {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    try {
      await reservaService.update(id, { estado: 'cancelada' });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cancelar reserva');
    }
  };

  if (loading) return <Loading message="Cargando reservas..." />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Mis reservas</h1>
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
                  {reserva.proposito && (
                    <p className="mt-1 text-sm text-slate-500">Propósito: {reserva.proposito}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold capitalize ${estadoClase[reserva.estado] || 'bg-slate-100 text-slate-700'}`}>
                    <Icon className="h-3.5 w-3.5" /> {reserva.estado}
                  </span>
                  {reserva.estado !== 'cancelada' && reserva.estado !== 'completada' && (
                    <button
                      onClick={() => cancelar(reserva.id)}
                      className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" /> Cancelar
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
