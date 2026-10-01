import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function AdminStatsCharts({ reporteMes, reporteZona, lugaresPopulares }) {
  const [periodo, setPeriodo] = useState('12');
  const [metricaLugar, setMetricaLugar] = useState('reservas');

  const reservasPorMes = reporteMes
    .slice(0, Number(periodo))
    .sort((reservaA, reservaB) => reservaA.mes.localeCompare(reservaB.mes))
    .map((reserva) => {
      const [year, month] = reserva.mes.split('-').map(Number);
      return {
        mes: new Intl.DateTimeFormat('es-BO', { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1)),
        total: Number(reserva.total),
      };
    });
  const reservasPorZona = reporteZona.map((fila) => ({
    zona: fila.zona || 'Sin zona',
    total: Number(fila.total_reservas),
  }));
  const lugaresPopularesData = lugaresPopulares.map((lugar) => ({
    nombre: lugar.nombre,
    reservas: Number(lugar.total_reservas),
    calificacion: Number(lugar.promedio_calificacion),
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6" aria-label="Gráfico de reservas por mes">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Reservas por mes</h2>
            <p className="mt-1 text-sm text-slate-500">Explora la actividad y compara periodos.</p>
          </div>
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Periodo del gráfico">
            {[['6', '6 meses'], ['12', '12 meses']].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={periodo === value} onClick={() => setPeriodo(value)} className={`rounded-md px-3 py-2 text-sm font-medium ${periodo === value ? 'bg-white text-adventista-azul shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {reservasPorMes.length > 0 ? (
          <div className="h-72 w-full" role="img" aria-label="Reservas agrupadas por mes">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={reservasPorMes} margin={{ top: 8, right: 12, left: -20, bottom: 8 }}>
                <defs>
                  <linearGradient id="reservasGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#087e8b" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#087e8b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#cbd5e1', fontSize: 12 }} formatter={(value) => [value, 'Reservas']} />
                <Area type="monotone" dataKey="total" name="Reservas" stroke="#087e8b" strokeWidth={3} fill="url(#reservasGradient)" activeDot={{ r: 6, strokeWidth: 0 }} />
                <Brush dataKey="mes" height={18} stroke="#087e8b" travellerWidth={8} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="py-16 text-center text-sm text-slate-500">Aún no hay reservas para graficar.</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6" aria-label="Gráfico de reservas por zona">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900">Reservas por zona</h2>
            <p className="mt-1 text-sm text-slate-500">Distribución de reservas entre iglesias.</p>
          </div>
          {reservasPorZona.length > 0 ? (
            <div className="h-72 w-full" role="img" aria-label="Cantidad de reservas por zona">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reservasPorZona} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="zona" width={92} tick={{ fill: '#475569', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#cbd5e1', fontSize: 12 }} formatter={(value) => [value, 'Reservas']} />
                  <Bar dataKey="total" name="Reservas" fill="#c58a32" radius={[0, 5, 5, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-16 text-center text-sm text-slate-500">Aún no hay datos por zona.</p>}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6" aria-label="Gráfico de lugares populares">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Lugares más populares</h2>
              <p className="mt-1 text-sm text-slate-500">Compara reservas y calificaciones.</p>
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Métrica de popularidad">
              {[['reservas', 'Reservas'], ['calificacion', 'Calificación']].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={metricaLugar === value} onClick={() => setMetricaLugar(value)} className={`rounded-md px-2.5 py-2 text-xs font-medium ${metricaLugar === value ? 'bg-white text-adventista-azul shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {lugaresPopularesData.length > 0 ? (
            <div className="w-full" style={{ height: Math.max(260, lugaresPopularesData.length * 34) }} role="img" aria-label={`Lugares más populares por ${metricaLugar}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lugaresPopularesData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={metricaLugar === 'calificacion' ? [0, 5] : [0, 'dataMax']} allowDecimals={metricaLugar === 'calificacion'} tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="nombre" width={112} tickFormatter={(nombre) => nombre.length > 16 ? `${nombre.slice(0, 16)}…` : nombre} interval={0} tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#cbd5e1', fontSize: 12 }} labelFormatter={(label) => label} formatter={(value) => [metricaLugar === 'calificacion' ? `${Number(value).toFixed(1)} / 5` : `${value} reservas`, metricaLugar === 'calificacion' ? 'Calificación' : 'Reservas']} />
                  <Bar dataKey={metricaLugar} name={metricaLugar === 'calificacion' ? 'Calificación' : 'Reservas'} fill={metricaLugar === 'calificacion' ? '#bd5e43' : '#177e89'} radius={[0, 5, 5, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-16 text-center text-sm text-slate-500">Aún no hay lugares para comparar.</p>}
        </section>
      </div>
    </div>
  );
}