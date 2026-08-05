import { useEffect, useState } from 'react';
import * as watchlist from '../watchlist';

export default function WatchlistButton({ patId }: { patId: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => watchlist.subscribe((ids) => setSaved(ids.includes(patId))), [patId]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        watchlist.toggle(patId);
      }}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        saved ? 'bg-amber-500/30 text-amber-100 hover:bg-amber-500/40' : 'bg-white/10 hover:bg-white/20 text-white'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
      {saved ? 'Watching' : 'Add to watchlist'}
    </button>
  );
}
