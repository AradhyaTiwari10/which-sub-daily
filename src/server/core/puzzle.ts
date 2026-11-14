import { redis, reddit } from '@devvit/web/server';
import { GROUPS, GROUP_KEYS } from './subreddits';

export type StoredRound = {
  title: string;
  permalink: string;
  score: number;
  options: string[];
  answer: number;
};

export type StoredPuzzle = { date: string; number: number; rounds: StoredRound[] };

export const ROUNDS = 5;
export const OPTIONS = 4;
const EPOCH = Date.UTC(2026, 10, 15); // puzzle #1 = 15 Nov 2026
const DAY_MS = 86_400_000;

export const todayKey = (): string => new Date().toISOString().slice(0, 10);
export const puzzleNumber = (date: string): number =>
  Math.max(1, Math.floor((Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) - EPOCH) / DAY_MS) + 1);

/** Deterministic PRNG so a day's puzzle is reproducible if generation is retried. */
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const shuffle = <T>(arr: T[], rnd: () => number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

const usableTitle = (title: string, sub: string): boolean => {
  const t = title.trim();
  if (t.length < 18 || t.length > 150) return false;
  const lower = t.toLowerCase();
  if (lower.includes(sub.toLowerCase()) || lower.includes('r/') || lower.includes('http')) return false;
  if (/\b(nsfw|megathread|weekly thread|daily thread|discussion thread)\b/i.test(t)) return false;
  return true;
};

const pickPost = async (sub: string, rnd: () => number): Promise<{ title: string; permalink: string; score: number } | null> => {
  try {
    const posts = await reddit.getTopPosts({ subredditName: sub, timeframe: 'day', limit: 25, pageSize: 25 }).all();
    const ok = posts.filter((p) => !p.nsfw && !p.removed && !p.hidden && usableTitle(p.title, sub));
    if (!ok.length) return null;
    const p = ok[Math.floor(rnd() * Math.min(ok.length, 10))]!; // one of the top 10 usable
    return { title: p.title.trim(), permalink: `https://www.reddit.com${p.permalink}`, score: p.score };
  } catch (e) {
    console.error(`getTopPosts failed for r/${sub}:`, e);
    return null;
  }
};

export const generatePuzzle = async (date: string): Promise<StoredPuzzle> => {
  const rnd = mulberry32(Number(date.replaceAll('-', '')));
  const groups = shuffle(GROUP_KEYS, rnd);
  const rounds: StoredRound[] = [];
  for (const g of groups) {
    if (rounds.length >= ROUNDS) break;
    const members = shuffle(GROUPS[g]!, rnd);
    for (const sub of members) {
      const post = await pickPost(sub, rnd);
      if (!post) continue;
      const decoys = members.filter((m) => m !== sub).slice(0, OPTIONS - 1);
      const options = shuffle([sub, ...decoys], rnd);
      rounds.push({ ...post, options, answer: options.indexOf(sub) });
      break;
    }
  }
  if (rounds.length < ROUNDS) throw new Error(`only ${rounds.length} rounds could be built for ${date}`);
  return { date, number: puzzleNumber(date), rounds };
};

export const getPuzzle = async (date: string): Promise<StoredPuzzle | null> => {
  const raw = await redis.get(`puzzle:${date}`);
  return raw ? (JSON.parse(raw) as StoredPuzzle) : null;
};

export const getOrCreatePuzzle = async (date: string): Promise<StoredPuzzle> => {
  const existing = await getPuzzle(date);
  if (existing) return existing;
  const puzzle = await generatePuzzle(date);
  await redis.set(`puzzle:${date}`, JSON.stringify(puzzle));
  await redis.expire(`puzzle:${date}`, 60 * 60 * 24 * 30);
  return puzzle;
};
