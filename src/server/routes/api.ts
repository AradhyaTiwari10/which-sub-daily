import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  ErrorResponse,
  GuessRequest,
  GuessResponse,
  InitResponse,
  LeaderboardResponse,
  RoundResult,
  SplashResponse,
} from '../../shared/api';
import { getOrCreatePuzzle, puzzleNumber, ROUNDS, todayKey, type StoredPuzzle } from '../core/puzzle';

export const api = new Hono();

const dateForPost = async (postId: string | undefined): Promise<string> => {
  if (postId) {
    const d = await redis.get(`post:${postId}`);
    if (d) return d;
  }
  return todayKey();
};

const progressKey = (date: string, userId: string) => `progress:${date}:${userId}`;
const statsKey = (date: string, round: number) => `stats:${date}:${round}`;
const lbKey = (date: string) => `lb:${date}`;

const yesterdayOf = (date: string): string => new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

const distribution = async (date: string, round: number): Promise<{ pct: number[]; players: number }> => {
  const counts = await redis.hGetAll(statsKey(date, round));
  const totals = [0, 1, 2, 3].map((i) => Number(counts[String(i)] ?? 0));
  const players = totals.reduce((a, b) => a + b, 0);
  return { pct: totals.map((n) => (players ? Math.round((n / players) * 100) : 0)), players };
};

const buildResult = async (puzzle: StoredPuzzle, round: number, choice: number): Promise<RoundResult> => {
  const r = puzzle.rounds[round]!;
  const { pct, players } = await distribution(puzzle.date, round);
  return { index: round, choice, answer: r.answer, correct: choice === r.answer, permalink: r.permalink, score: r.score, distribution: pct, players };
};

const streakFor = async (userId: string): Promise<{ streak: number; best: number }> => {
  const [s, b] = await Promise.all([redis.get(`streak:${userId}`), redis.get(`best:${userId}`)]);
  return { streak: Number(s ?? 0), best: Number(b ?? 0) };
};

api.get('/splash', async (c) => {
  const date = await dateForPost(context.postId);
  const [players, progress] = await Promise.all([
    redis.get(`players:${date}`),
    context.userId ? redis.hGetAll(progressKey(date, context.userId)) : Promise.resolve({} as Record<string, string>),
  ]);
  return c.json<SplashResponse>({
    type: 'splash',
    number: puzzleNumber(date),
    date,
    playersToday: Number(players ?? 0),
    roundsAnswered: Object.keys(progress).length,
  });
});

api.get('/init', async (c) => {
  const { postId, userId } = context;
  try {
    const date = await dateForPost(postId);
    const puzzle = await getOrCreatePuzzle(date);
    const username = (await reddit.getCurrentUsername()) ?? null;
    const progress = userId ? await redis.hGetAll(progressKey(date, userId)) : {};
    const results: RoundResult[] = [];
    for (const [k, v] of Object.entries(progress)) results.push(await buildResult(puzzle, Number(k), Number(v)));
    results.sort((a, b) => a.index - b.index);
    const { streak, best } = userId ? await streakFor(userId) : { streak: 0, best: 0 };
    return c.json<InitResponse>({
      type: 'init',
      postId: postId ?? '',
      date,
      number: puzzle.number,
      username,
      loggedIn: Boolean(userId),
      rounds: puzzle.rounds.map((r, i) => ({ index: i, title: r.title, options: r.options })),
      results,
      streak,
      bestStreak: best,
      playersToday: Number((await redis.get(`players:${date}`)) ?? 0),
    });
  } catch (error) {
    console.error('init failed', error);
    return c.json<ErrorResponse>({ status: 'error', message: error instanceof Error ? error.message : 'init failed' }, 400);
  }
});

api.post('/guess', async (c) => {
  const { userId } = context;
  const body = await c.req.json<GuessRequest>();
  const round = Number(body.round);
  const choice = Number(body.choice);
  if (!Number.isInteger(round) || round < 0 || round >= ROUNDS || !Number.isInteger(choice) || choice < 0 || choice > 3) {
    return c.json<ErrorResponse>({ status: 'error', message: 'bad guess' }, 400);
  }
  try {
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : await dateForPost(context.postId);
    const puzzle = await getOrCreatePuzzle(date);
    let streak = 0;
    let best = 0;
    let rank: number | null = null;
    let done = false;
    let total = 0;

    if (!userId) {
      // Logged-out players can play, nothing is stored and they do not count in the stats.
      const result = await buildResult(puzzle, round, choice);
      return c.json<GuessResponse>({ type: 'guess', result, done: false, total: result.correct ? 1 : 0, streak: 0, bestStreak: 0, rank: null, playersToday: Number((await redis.get(`players:${date}`)) ?? 0) });
    }

    const key = progressKey(date, userId);
    const existing = await redis.hGet(key, String(round));
    if (existing === undefined) {
      const before = await redis.hLen(key);
      if (before === 0) await redis.incrBy(`players:${date}`, 1);
      await redis.hSet(key, { [String(round)]: String(choice) });
      await redis.expire(key, 60 * 60 * 24 * 60);
      await redis.hIncrBy(statsKey(date, round), String(choice), 1);
    }
    const progress = await redis.hGetAll(key);
    total = Object.entries(progress).filter(([k, v]) => puzzle.rounds[Number(k)]?.answer === Number(v)).length;
    done = Object.keys(progress).length >= ROUNDS;
    const username = (await reddit.getCurrentUsername()) ?? userId;
    if (done && existing === undefined) {
      await redis.zAdd(lbKey(date), { member: username, score: total * 1000 - (Date.now() % 1000) / 1000 });
      const last = await redis.get(`last:${userId}`);
      const prev = Number((await redis.get(`streak:${userId}`)) ?? 0);
      streak = last === yesterdayOf(date) ? prev + 1 : last === date ? prev : 1;
      best = Math.max(streak, Number((await redis.get(`best:${userId}`)) ?? 0));
      await redis.set(`last:${userId}`, date);
      await redis.set(`streak:${userId}`, String(streak));
      await redis.set(`best:${userId}`, String(best));
    } else {
      ({ streak, best } = await streakFor(userId));
    }
    if (done) {
      const r = await redis.zRank(lbKey(date), username);
      const n = await redis.zCard(lbKey(date));
      rank = r === undefined ? null : n - r; // zRank is ascending; convert to 1-based descending rank
    }
    const result = await buildResult(puzzle, round, Number(existing ?? choice));
    return c.json<GuessResponse>({ type: 'guess', result, done, total, streak, bestStreak: best, rank, playersToday: Number((await redis.get(`players:${date}`)) ?? 0) });
  } catch (error) {
    console.error('guess failed', error);
    return c.json<ErrorResponse>({ status: 'error', message: error instanceof Error ? error.message : 'guess failed' }, 400);
  }
});

api.get('/leaderboard', async (c) => {
  const date = await dateForPost(context.postId);
  const top = await redis.zRange(lbKey(date), 0, 9, { by: 'rank', reverse: true });
  let me: LeaderboardResponse['me'] = null;
  if (context.userId) {
    const username = (await reddit.getCurrentUsername()) ?? context.userId;
    const [score, r, n] = await Promise.all([redis.zScore(lbKey(date), username), redis.zRank(lbKey(date), username), redis.zCard(lbKey(date))]);
    if (score !== undefined && r !== undefined) me = { rank: n - r, score: Math.round(score / 1000) };
  }
  return c.json<LeaderboardResponse>({ type: 'leaderboard', date, top: top.map((t) => ({ username: t.member, score: Math.round(t.score / 1000) })), me });
});
