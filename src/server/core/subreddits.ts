/** Curated, safe-for-work subreddits grouped by flavour. Decoys come from the same group, so a guess needs real Reddit sense. */
export const GROUPS: Record<string, string[]> = {
  humor: ['funny', 'memes', 'dadjokes', 'ProgrammerHumor', 'wholesomememes', 'MadeMeSmile'],
  pics: ['pics', 'EarthPorn', 'aww', 'cats', 'dogs', 'mildlyinteresting', 'oddlysatisfying'],
  questions: ['AskReddit', 'NoStupidQuestions', 'explainlikeimfive', 'askscience', 'LifeProTips', 'Showerthoughts'],
  food: ['food', 'Cooking', 'Baking', 'recipes', 'MealPrepSunday', 'Coffee'],
  tech: ['technology', 'programming', 'gadgets', 'pcmasterrace', 'buildapc', 'webdev'],
  science: ['science', 'space', 'todayilearned', 'Damnthatsinteresting', 'history', 'nature'],
  gaming: ['gaming', 'pcgaming', 'Minecraft', 'NintendoSwitch', 'PS5', 'boardgames'],
  sports: ['sports', 'nba', 'soccer', 'formula1', 'nfl', 'running'],
  money: ['personalfinance', 'investing', 'Frugal', 'Entrepreneur', 'povertyfinance', 'FinancialPlanning'],
  hobbies: ['woodworking', 'gardening', 'photography', 'DIY', 'knitting', 'Watches'],
  culture: ['movies', 'television', 'Music', 'books', 'anime', 'comics'],
  world: ['travel', 'MapPorn', 'CasualConversation', 'GetMotivated', 'productivity', 'Fitness'],
};

export const GROUP_KEYS = Object.keys(GROUPS);
