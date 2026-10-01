import { useEffect, useState } from 'react';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, RefreshCw, Sun, Thermometer, Wind } from 'lucide-react';
import lugarService from '../services/lugarService';

const DESCRIPCIONES_CLIMA = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Neblina',
  48: 'Neblina con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna intensa',
  56: 'Llovizna helada ligera',
  57: 'Llovizna helada intensa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia intensa',
  66: 'Lluvia helada ligera',
  67: 'Lluvia helada intensa',
  71: 'Nevada ligera',
  73: 'Nevada moderada',
  75: 'Nevada intensa',
  77: 'Granos de nieve',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos intensos',
  85: 'Chubascos de nieve ligeros',
  86: 'Chubascos de nieve intensos',
  95: 'Tormenta eléctrica',
  96: 'Tormenta con granizo ligero',
  99: 'Tormenta con granizo intenso',
};

const iconoClima = (codigo) => {
  if (codigo === 0) return Sun;
  if ([1, 2].includes(codigo)) return CloudSun;
  if (codigo === 3) return Cloud;
  if ([45, 48].includes(codigo)) return CloudFog;
  if ([71, 73, 75, 77, 85, 86].includes(codigo)) return CloudSnow;
  if (codigo >= 95) return CloudLightning;
  if ((codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return CloudRain;
  return CloudSun;
};

const temperatura = (valor) => valor != null && valor !== '' && Number.isFinite(Number(valor)) ? `${Math.round(Number(valor))}°` : 'N/D';

const diaSemana = (fecha) => new Intl.DateTimeFormat('es-BO', { weekday: 'short' })
  .format(new Date(`${fecha}T12:00:00`));

export default function ClimaLugar({ lugar }) {
  const [clima, setClima] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!lugar?.id || !Number.isFinite(Number(lugar.latitud)) || !Number.isFinite(Number(lugar.longitud))) {
      setClima(null);
      setError('Este lugar no tiene coordenadas para consultar el clima.');
      setCargando(false);
      return undefined;
    }

    let vigente = true;
    setCargando(true);
    setError('');
    lugarService.getClima(lugar.id)
      .then(({ data }) => {
        if (vigente) setClima(data);
      })
      .catch((err) => {
        if (vigente) setError(err.response?.data?.error || 'No se pudo consultar el clima ahora.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => { vigente = false; };
  }, [lugar?.id, lugar?.latitud, lugar?.longitud, intento]);

  const actual = clima?.current;
  const codigoActual = Number(actual?.weather_code);
  const IconoActual = iconoClima(codigoActual);

  return (
    <section className="mt-5 border-t border-slate-200 pt-4" aria-label="Condiciones climáticas">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          {actual && <IconoActual className="h-7 w-7 shrink-0 text-adventista-azul" aria-hidden="true" />}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800">Clima actual</h2>
            {actual && <p className="mt-0.5 text-xs text-slate-500">Open-Meteo · {lugar.nombre}</p>}
          </div>
          {actual && <p className="text-xl font-semibold text-slate-900">{temperatura(actual.temperature_2m)}</p>}
          {actual && <p className="min-w-0 truncate text-sm text-slate-600">{DESCRIPCIONES_CLIMA[codigoActual] || 'Condición variable'}</p>}
        </div>

        {actual && (
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-1"><dt className="sr-only">Sensación</dt><Thermometer className="h-3.5 w-3.5" /><dd>{temperatura(actual.apparent_temperature)}</dd></div>
            <div className="flex items-center gap-1"><dt className="sr-only">Humedad</dt><Droplets className="h-3.5 w-3.5" /><dd>{actual.relative_humidity_2m ?? 'N/D'}%</dd></div>
            <div className="flex items-center gap-1"><dt className="sr-only">Precipitación</dt><CloudRain className="h-3.5 w-3.5" /><dd>{actual.precipitation ?? 'N/D'} {clima.current_units?.precipitation || 'mm'}</dd></div>
            <div className="flex items-center gap-1"><dt className="sr-only">Viento</dt><Wind className="h-3.5 w-3.5" /><dd>{actual.wind_speed_10m ?? 'N/D'} {clima.current_units?.wind_speed_10m || 'km/h'}</dd></div>
          </dl>
        )}

        {clima?.updated_at && <span className="text-xs text-slate-400">{clima.stale ? 'Dato guardado' : 'Actualizado'} {new Date(clima.updated_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>

      {cargando && <p className="mt-2 text-xs text-slate-500" role="status">Consultando clima…</p>}
      {error && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-xs text-amber-800" role="status">{error}</p>
          {lugar?.latitud != null && lugar?.longitud != null && <button type="button" onClick={() => setIntento((valor) => valor + 1)} className="inline-flex items-center gap-1 text-xs font-medium text-adventista-azul hover:underline"><RefreshCw className="h-3.5 w-3.5" /> Reintentar</button>}
        </div>
      )}

      {actual && (
        <details className="mt-2 text-xs">
          <summary className="w-fit cursor-pointer font-medium text-adventista-azul">Ver previsión de tres días</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(clima.daily?.time || []).map((fecha, index) => {
              const IconoDia = iconoClima(Number(clima.daily.weather_code[index]));
              return (
                <div key={fecha} className="flex items-center gap-2 border-l border-slate-200 pl-3 py-1">
                  <IconoDia className="h-4 w-4 shrink-0 text-adventista-azul" />
                  <span className="min-w-0 flex-1 capitalize text-slate-600">{index === 0 ? 'Hoy' : diaSemana(fecha)} · {DESCRIPCIONES_CLIMA[clima.daily.weather_code[index]] || 'Variable'}</span>
                  <span className="whitespace-nowrap font-medium text-slate-800">{temperatura(clima.daily.temperature_2m_min[index])} / {temperatura(clima.daily.temperature_2m_max[index])}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-slate-400">Fuente: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">Open-Meteo</a></p>
        </details>
      )}
    </section>
  );
}