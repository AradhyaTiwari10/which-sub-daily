import './index.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import type { SplashResponse } from '../shared/api';

export const Splash = () => {
  const [data, setData] = useState<SplashResponse | null>(null);

  useEffect(() => {
    fetch('/api/splash')
      .then((r) => r.json() as Promise<SplashResponse>)
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const answered = data?.roundsAnswered ?? 0;
  const label = answered >= 5 ? 'See my result' : answered > 0 ? `Continue (${answered}/5)` : "Play today's 5";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f7f8] dark:bg-gray-900 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#ff4500]">Daily puzzle {data ? `#${data.number}` : ''}</p>
      <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">Which Sub?</h1>
      <p className="max-w-xs text-base text-gray-600 dark:text-gray-300">Five real posts from today. Guess the subreddit each one came from.</p>
      <button
        className="mt-2 rounded-full bg-[#ff4500] px-6 py-3 text-base font-bold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
        onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
      >
        {label}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {data ? `${data.playersToday.toLocaleString()} ${data.playersToday === 1 ? 'player' : 'players'} so far today` : 'New posts every day'}
      </p>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
