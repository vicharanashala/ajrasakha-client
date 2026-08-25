/**
 * Config array of tappable example questions shown on the welcome/empty-chat screen.
 * Tapping a tile sends the question immediately (see ExampleQuestionTiles.tsx) — the
 * same as if the user had typed it and hit submit.
 *
 * Add/remove/reorder entries here; no other file needs to change. `id` is only used to
 * look up an icon in ExampleQuestionTiles.tsx and as the React list key — it's fine to
 * leave a new entry without a matching icon, it'll fall back to a generic icon.
 */
export interface ExampleQuestion {
  id: string;
  text: string;
}

export const EXAMPLE_QUESTIONS: ExampleQuestion[] = [
  {
    id: 'wheat-yellow-rust',
    text: 'How to control yellow rust in Wheat crop?',
  },
  {
    id: 'weather-forecast',
    text: 'What is the weather forecast for my region?',
  },
  {
    id: 'mandi-price-paddy',
    text: 'What is the current mandi price for Paddy crop in my region?',
  },
  {
    id: 'pmfby-info',
    text: 'Give information regarding the Pradhan Mantri Fasal Bima Yojana (PMFBY).',
  },
];
