export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
      <p className="text-sm font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-sm font-semibold underline hover:text-red-800"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
