export default function Loading({ message = 'Cargando...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-adventista-azul"></div>
      <p className="mt-3 text-sm">{message}</p>
    </div>
  );
}
