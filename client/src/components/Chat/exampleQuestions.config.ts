import type { TranslationKeys } from '~/hooks';

/**
 * Config array of tappable example questions shown on the welcome/empty-chat screen.
 * Tapping a tile sends the question immediately (see ExampleQuestionTiles.tsx) — the
 * same as if the user had typed it and hit submit.
 *
 * `textKey` points at a translation.json key (see client/src/locales/*\/translation.json)
 * rather than storing literal English text, so the question is localized the same way as
 * any other UI string. Add/remove/reorder entries here; no other file needs to change.
 * `id` is only used to look up an icon in ExampleQuestionTiles.tsx and as the React list
 * key — it's fine to leave a new entry without a matching icon, it'll fall back to a
 * generic icon.
 */
export interface ExampleQuestion {
  id: string;
  textKey: TranslationKeys;
}

export const EXAMPLE_QUESTIONS: ExampleQuestion[] = [
  {
    id: 'wheat-yellow-rust',
    textKey: 'com_ui_landing_question_wheat_yellow_rust',
  },
  {
    id: 'weather-forecast',
    textKey: 'com_ui_landing_question_weather_forecast',
  },
  {
    id: 'mandi-price-paddy',
    textKey: 'com_ui_landing_question_mandi_price_paddy',
  },
  {
    id: 'pmfby-info',
    textKey: 'com_ui_landing_question_pmfby_info',
  },
];

export const STATE_EXAMPLE_QUESTION_OVERRIDES: Record<string, Record<string, ExampleQuestion>> = {
  punjab: {
    'pmfby-info': {
      id: 'pmkusum-info',
      textKey: 'com_ui_landing_question_pmkusum_info',
    },
  },
};
