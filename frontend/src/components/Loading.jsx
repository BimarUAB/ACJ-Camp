export default function Loading({ message = 'Cargando...' }) {
  return (
    <div role="status" aria-live="polite" className="camp-loading flex flex-col items-center justify-center p-8 text-slate-500">
      <div aria-hidden="true" className="camp-loading__ring" />
      <p className="mt-3 text-sm">{message}</p>
    </div>
  );
}
