import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis, reddit } from '@devvit/web/server';
import { createDailyPost } from '../core/post';
import { todayKey } from '../core/puzzle';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createDailyPost(todayKey());
    return c.json<UiResponse>({ navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}` }, 200);
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: `Failed to create today's puzzle post: ${error instanceof Error ? error.message : error}` }, 400);
  }
});

/** Moderator-only test helper: wipe the calling moderator's own answers for today so the puzzle can be replayed. */
menu.post('/reset-me', async (c) => {
  const { userId } = context;
  if (!userId) return c.json<UiResponse>({ showToast: 'Log in first' }, 400);
  try {
    const date = todayKey();
    const key = `progress:${date}:${userId}`;
    const progress = await redis.hGetAll(key);
    const rounds = Object.keys(progress).length;
    for (const [round, choice] of Object.entries(progress)) {
      await redis.hIncrBy(`stats:${date}:${round}`, String(choice), -1);
    }
    if (rounds > 0) {
      await redis.del(key);
      await redis.incrBy(`players:${date}`, -1);
      const username = (await reddit.getCurrentUsername()) ?? userId;
      await redis.zRem(`lb:${date}`, [username]);
    }
    return c.json<UiResponse>({ showToast: rounds ? `Cleared ${rounds} answered rounds for today. Reload the post to play again.` : 'Nothing to reset for today.' }, 200);
  } catch (error) {
    console.error('reset failed', error);
    return c.json<UiResponse>({ showToast: 'Reset failed' }, 400);
  }
});
