import { context, reddit, redis } from '@devvit/web/server';
import { getOrCreatePuzzle } from './puzzle';

const pretty = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Builds (or reuses) the puzzle for `date` and publishes the interactive post for it in the current subreddit. */
export const createDailyPost = async (date: string) => {
  const puzzle = await getOrCreatePuzzle(date);
  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName!,
    title: `Which Sub? Daily #${puzzle.number} - ${pretty(date)}: guess where 5 real posts were posted`,
    postData: { date },
    textFallback: { text: 'Which Sub? is an interactive daily game. Open this post in the Reddit app or on new Reddit to play.' },
  });
  await redis.set(`post:${post.id}`, date);
  await redis.set(`postfor:${date}`, post.id);
  return post;
};
