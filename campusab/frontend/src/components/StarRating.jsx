import { Star } from 'lucide-react';

export default function StarRating({ rating = 0, max = 5, size = 16, interactive = false, onChange }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const value = i + 1;
        const filled = value <= rating;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(value)}
            className={interactive ? 'hover:scale-110 transition' : 'cursor-default'}
          >
            <Star
              size={size}
              className={filled ? 'fill-adventista-dorado text-adventista-dorado' : 'text-slate-300'}
            />
          </button>
        );
      })}
    </div>
  );
}
