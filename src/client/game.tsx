import './index.css';

import { StrictMode, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { navigateTo, showLoginPrompt, showShareSheet, showToast } from '@devvit/web/client';
import type { GuessResponse, InitResponse, LeaderboardResponse, RoundResult } from '../shared/api';

type View = 'loading' | 'round' | 'result' | 'summary' | 'leaderboard' | 'error';

const ORANGE = 'bg-[#ff4500]';

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { status?: string; message?: string };
  if (!res.ok || data.status === 'error') throw new Error(data.message ?? `request failed (${res.status})`);
  return data;
};

const squares = (results: RoundResult[], total: number): string =>
  Array.from({ length: total }, (_, i) => {
    const r = results.find((x) => x.index === i);
    return r ? (r.correct ? '🟧' : '⬛') : '⬜';
  }).join('');

export const App = () => {
  const [init, setInit] = useState<InitResponse | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [view, setView] = useState<View>('loading');
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<GuessResponse | null>(null);
  const [lb, setLb] = useState<LeaderboardResponse | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    fetchJson<InitResponse>('/api/init')
      .then((d) => {
        setInit(d);
        setResults(d.results);
        setStreak(d.streak);
        setBest(d.bestStreak);
        setView(d.results.length >= d.rounds.length ? 'summary' : 'round');
      })
      .catch((e: Error) => {
        setError(e.message);
        setView('error');
      });
  }, []);

  const roundIndex = results.length;
  const round = init?.rounds[roundIndex];
  const total = init?.rounds.length ?? 5;
  const correct = useMemo(() => results.filter((r) => r.correct).length, [results]);

  const guess = useCallback(
    async (choice: number) => {
      if (!init || !round || busy) return;
      setBusy(true);
      try {
        const g = await fetchJson<GuessResponse>('/api/guess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ round: round.index, choice, date: init.date }),
        });
        setLast(g);
        setResults((prev) => [...prev.filter((r) => r.index !== g.result.index), g.result].sort((a, b) => a.index - b.index));
        setStreak(g.streak);
        setBest(g.bestStreak);
        setRank(g.rank);
        setView('result');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not submit your guess');
      } finally {
        setBusy(false);
      }
    },
    [init, round, busy]
  );

  const next = () => setView(results.length >= total ? 'summary' : 'round');

  const share = async () => {
    if (!init) return;
    const text = `Which Sub? #${init.number}  ${correct}/${total}\n${squares(results, total)}${streak > 1 ? `\nStreak: ${streak} days` : ''}\nCan you tell where a post was posted?`;
    try {
      await showShareSheet({ text, title: 'Which Sub? daily result' });
    } catch {
      showToast('Could not open the share sheet');
    }
  };

  const openLeaderboard = async () => {
    try {
      setLb(await fetchJson<LeaderboardResponse>('/api/leaderboard'));
      setView('leaderboard');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Leaderboard unavailable');
    }
  };

  if (view === 'loading') return <Shell><p className="text-center text-gray-500 dark:text-gray-400 py-20">Loading today's puzzle...</p></Shell>;
  if (view === 'error' || !init)
    return (
      <Shell>
        <p className="text-center text-red-600 dark:text-red-400 py-20">{error || 'Something went wrong.'}</p>
      </Shell>
    );

  return (
    <Shell>
      <Header number={init.number} roundIndex={view === 'result' && last ? last.result.index : Math.min(roundIndex, total - 1)} answered={results.length} total={total} streak={streak} view={view} />

      {view === 'round' && round && (
        <section className="flex flex-col gap-5">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">A real post from today. Where was it posted?</p>
          <blockquote className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-5 text-lg sm:text-xl font-semibold leading-snug text-gray-900 dark:text-gray-50">
            {round.title}
          </blockquote>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {round.options.map((name, i) => (
              <button
                key={name}
                disabled={busy}
                onClick={() => void guess(i)}
                className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-50 hover:border-[#ff4500] hover:bg-orange-50 dark:hover:bg-gray-700 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer"
              >
                r/{name}
              </button>
            ))}
          </div>
          {!init.loggedIn && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Playing as a guest. <button className="underline cursor-pointer" onClick={() => showLoginPrompt()}>Log in</button> to save your streak and join the leaderboard.
            </p>
          )}
        </section>
      )}

      {view === 'result' && last && (
        <section className="flex flex-col gap-4">
          <p className={`text-2xl font-extrabold ${last.result.correct ? 'text-green-600 dark:text-green-400' : 'text-[#ff4500]'}`}>
            {last.result.correct ? 'Correct.' : 'Not this time.'}
          </p>
          <p className="text-gray-700 dark:text-gray-300">
            It was <span className="font-bold">r/{init.rounds[last.result.index]!.options[last.result.answer]}</span>
            {last.result.score > 0 ? <> with {last.result.score.toLocaleString()} upvotes.</> : '.'}
          </p>
          <div className="flex flex-col gap-2">
            {init.rounds[last.result.index]!.options.map((name, i) => {
              const isAnswer = i === last.result.answer;
              const isChoice = i === last.result.choice;
              const pct = last.result.distribution[i] ?? 0;
              return (
                <div key={name} className={`relative overflow-hidden rounded-xl border-2 ${isAnswer ? 'border-green-500' : isChoice ? 'border-[#ff4500]' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800`}>
                  <div className={`absolute inset-y-0 left-0 ${isAnswer ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-700/60'}`} style={{ width: `${pct}%` }} />
                  <div className="relative flex justify-between px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-50">
                    <span>r/{name}{isChoice ? ' (you)' : ''}</span>
                    <span className="tabular-nums text-gray-600 dark:text-gray-300">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{last.result.players.toLocaleString()} {last.result.players === 1 ? 'player has' : 'players have'} answered this round.</p>
          <div className="flex gap-3">
            <button className="flex-1 rounded-full border-2 border-gray-300 dark:border-gray-600 px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-100 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => navigateTo(last.result.permalink)}>
              See the real post
            </button>
            <button className={`flex-1 rounded-full ${ORANGE} px-4 py-2.5 font-semibold text-white cursor-pointer hover:brightness-110`} onClick={next}>
              {results.length >= total ? 'See my result' : 'Next post'}
            </button>
          </div>
        </section>
      )}

      {view === 'summary' && (
        <section className="flex flex-col gap-4 items-center text-center">
          <p className="text-5xl font-black text-gray-900 dark:text-white">{correct}<span className="text-2xl text-gray-400">/{total}</span></p>
          <p className="text-3xl tracking-widest">{squares(results, total)}</p>
          <p className="text-gray-700 dark:text-gray-300">
            {correct === total ? 'Perfect. You know Reddit.' : correct >= 3 ? 'Solid Reddit sense.' : correct >= 1 ? 'Reddit is big. Come back tomorrow.' : 'Every sub is a surprise today.'}
          </p>
          <div className="grid grid-cols-3 gap-3 w-full">
            <Stat label="Streak" value={`${streak}`} />
            <Stat label="Best" value={`${best}`} />
            <Stat label="Rank today" value={rank ? `#${rank}` : '-'} />
          </div>
          <div className="flex gap-3 w-full">
            <button className={`flex-1 rounded-full ${ORANGE} px-4 py-2.5 font-semibold text-white cursor-pointer hover:brightness-110`} onClick={() => void share()}>Share</button>
            <button className="flex-1 rounded-full border-2 border-gray-300 dark:border-gray-600 px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-100 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => void openLeaderboard()}>Leaderboard</button>
          </div>
          <ul className="w-full text-left text-sm divide-y divide-gray-200 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {results.map((r) => (
              <li key={r.index} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate text-gray-700 dark:text-gray-200">{r.correct ? '🟧' : '⬛'} r/{init.rounds[r.index]!.options[r.answer]}</span>
                <button className="shrink-0 text-xs underline text-gray-500 dark:text-gray-400 cursor-pointer" onClick={() => navigateTo(r.permalink)}>open post</button>
              </li>
            ))}
          </ul>
          {!init.loggedIn && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <button className="underline cursor-pointer" onClick={() => showLoginPrompt()}>Log in</button> to keep a streak and appear on the leaderboard.
            </p>
          )}
          <p className="text-xs text-gray-400">A new set of 5 posts drops every day at 00:05 UTC.</p>
        </section>
      )}

      {view === 'leaderboard' && lb && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Today's leaderboard</h2>
          {lb.top.length === 0 && <p className="text-gray-500 dark:text-gray-400">Nobody has finished today yet. Be the first.</p>}
          <ol className="divide-y divide-gray-200 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {lb.top.map((e, i) => (
              <li key={e.username} className={`flex justify-between px-4 py-2 ${init.username === e.username ? 'font-bold text-[#ff4500]' : 'text-gray-800 dark:text-gray-100'}`}>
                <span>#{i + 1} u/{e.username}</span>
                <span className="tabular-nums">{e.score}/{total}</span>
              </li>
            ))}
          </ol>
          {lb.me && <p className="text-sm text-gray-600 dark:text-gray-300">You: #{lb.me.rank} with {lb.me.score}/{total}</p>}
          <button className="self-start text-sm underline text-gray-600 dark:text-gray-300 cursor-pointer" onClick={() => setView('summary')}>Back</button>
        </section>
      )}
    </Shell>
  );
};

const Shell = ({ children }: { children: ReactNode }) => (
  <main className="min-h-screen bg-[#f6f7f8] dark:bg-gray-900 text-gray-900 dark:text-gray-50">
    <div className="mx-auto w-full max-w-xl px-4 py-5 flex flex-col gap-5">{children}</div>
  </main>
);

const Header = ({ number, roundIndex, answered, total, streak, view }: { number: number; roundIndex: number; answered: number; total: number; streak: number; view: View }) => (
  <header className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-black tracking-tight"><span className="text-[#ff4500]">Which Sub?</span> <span className="text-gray-500 dark:text-gray-400 font-semibold">#{number}</span></h1>
      {view === 'round' || view === 'result' ? <p className="text-xs text-gray-500 dark:text-gray-400">Post {roundIndex + 1} of {total}</p> : null}
    </div>
    <div className="flex items-center gap-2">
      <div className="flex gap-1">{Array.from({ length: total }, (_, i) => <span key={i} className={`h-2 w-5 rounded-full ${i < answered || view === 'summary' || view === 'leaderboard' ? 'bg-[#ff4500]' : 'bg-gray-300 dark:bg-gray-700'}`} />)}</div>
      {streak > 0 && <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">streak {streak}</span>}
    </div>
  </header>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-3">
    <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</p>
    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
