import { Hono } from 'hono';
import { redis } from '@devvit/web/server';
import { createDailyPost } from '../core/post';
import { todayKey } from '../core/puzzle';

export const scheduler = new Hono();

/** Runs every day shortly after 00:00 UTC: builds the puzzle from today's top posts and publishes the post. */
scheduler.post('/daily', async (c) => {
  const date = todayKey();
  try {
    if (await redis.get(`postfor:${date}`)) return c.json({ status: 'skipped', message: `post for ${date} exists` }, 200);
    const post = await createDailyPost(date);
    return c.json({ status: 'success', message: `created ${post.id} for ${date}` }, 200);
  } catch (error) {
    console.error('daily job failed', error);
    return c.json({ status: 'error', message: error instanceof Error ? error.message : 'daily job failed' }, 400);
  }
});
