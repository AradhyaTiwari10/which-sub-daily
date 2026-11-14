export type RoundPublic = {
  index: number;
  title: string;
  options: string[]; // subreddit names, shuffled
};

export type RoundResult = {
  index: number;
  choice: number;
  answer: number;
  correct: boolean;
  permalink: string;
  score: number; // post score at puzzle time
  distribution: number[]; // percentage of players per option
  players: number;
};

export type InitResponse = {
  type: 'init';
  postId: string;
  date: string; // YYYY-MM-DD (UTC)
  number: number; // daily puzzle number
  username: string | null;
  loggedIn: boolean;
  rounds: RoundPublic[];
  results: RoundResult[]; // rounds already answered by this user
  streak: number;
  bestStreak: number;
  playersToday: number;
};

export type GuessRequest = { round: number; choice: number; date: string };

export type GuessResponse = {
  type: 'guess';
  result: RoundResult;
  done: boolean;
  total: number; // correct answers so far
  streak: number;
  bestStreak: number;
  rank: number | null; // 1-based rank today, when done
  playersToday: number;
};

export type LeaderboardEntry = { username: string; score: number };

export type LeaderboardResponse = {
  type: 'leaderboard';
  date: string;
  top: LeaderboardEntry[];
  me: { rank: number; score: number } | null;
};

export type SplashResponse = {
  type: 'splash';
  number: number;
  date: string;
  playersToday: number;
  roundsAnswered: number;
};

export type ErrorResponse = { status: 'error'; message: string };
