// Surface shared by every card on the new chat screen, so the weather card and the example
// question cards render the exact same background in both light and dark mode.
// Dark mode keeps the near black page colour instead of a grey fill. A hairline light edge and
// a faint sheen towards the top left give the card its shape, and green stays reserved for
// icons and accents.
export const LANDING_CARD_SURFACE = [
  'border border-transparent bg-surface-chat',
  'dark:border-white/[0.07] dark:bg-surface-chat',
  'bg-gradient-to-br from-white/70 via-transparent to-transparent dark:from-white/[0.04]',
].join(' ');
