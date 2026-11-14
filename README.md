# Which Sub?

A daily guessing game for Reddit, built on Devvit Web for the Reddit Game of the Day hackathon.

Every day at 00:05 UTC the app picks five real posts from that day's top posts across a curated set of
safe-for-work communities, and publishes one interactive post. Players read each post title and pick
which of four subreddits it was posted in. The four choices always come from the same flavour of
community (humour, questions, food, tech, science, gaming, sports, money, hobbies, culture, world),
so a guess needs real Reddit sense rather than keyword matching.

## How to play

1. Open the day's "Which Sub? Daily #N" post and tap Play.
2. Read the post title and choose one of the four subreddits.
3. See whether you were right, how the rest of the community voted on that round, and open the real post.
4. After five posts you get your score, your streak, your rank for the day, a share card, and the daily leaderboard.

Logged-out redditors can play as guests; logging in keeps a streak and a leaderboard place.

## What makes it daily

- A new puzzle is generated from the day's top posts by a scheduler job, so the content is always fresh and
  genuinely Reddit's own.
- Streaks reward playing on consecutive days; the best streak is kept.
- Community vote distributions, the daily leaderboard and the share card give every day its own talking point.

## Project layout

- `src/server` - Hono server: daily puzzle generation (`core/puzzle.ts`), post creation (`core/post.ts`), API routes
  (`routes/api.ts`: init, guess, leaderboard, splash), scheduler, moderator menu action and install trigger.
- `src/client` - React + Tailwind: `splash.tsx` (inline feed view), `game.tsx` (expanded play view).
- `src/shared/api.ts` - request and response types shared by both sides.
- `devvit.json` - entrypoints, permissions, scheduler (`5 0 * * *`) and the moderator menu item.

## Development

```bash
npm install
npm run dev        # devvit playtest in your test subreddit
npm run test:types && npm run lint
npm run deploy     # devvit upload (private; not published)
```

Moderators can create a puzzle post at any time from the subreddit menu ("Which Sub? - create today's puzzle post").
