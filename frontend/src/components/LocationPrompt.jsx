import { LocateFixed, MapPin } from 'lucide-react';
import { useUserLocation } from '../context/LocationContext';

export default function LocationPrompt() {
  const { promptVisible, requesting, error, requestLocation, dismissPrompt } = useUserLocation();

  if (!promptVisible) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-prompt-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-adventista-azul/10 text-adventista-azul">
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 id="location-prompt-title" className="text-xl font-semibold text-slate-900">Encuentra campamentos cerca de ti</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Usa tu ubicación para centrar el mapa y buscar lugares cercanos. No se guarda en tu cuenta.
        </p>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={dismissPrompt}
            disabled={requesting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={() => requestLocation().catch(() => {})}
            disabled={requesting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-adventista-azul px-4 py-2 text-sm font-semibold text-white hover:bg-adventista-azul/90 disabled:opacity-50"
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {requesting ? 'Buscando ubicación...' : 'Usar mi ubicación'}
          </button>
        </div>
      </section>
    </div>
  );
}