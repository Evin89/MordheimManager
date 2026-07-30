export const THEMES = ['grimdark', 'parchment'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'grimdark';

const STORAGE_KEY = 'mordheim.theme';

/** The browser-chrome colour each theme wants, so the phone's status bar
 * doesn't stay black behind a page made of paper. */
const META_THEME_COLOUR: Record<Theme, string> = {
  grimdark: '#0b0a09',
  parchment: '#e9e0cc',
};

function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as readonly string[]).includes(value);
}

/**
 * Which theme to use. A per-device display preference, not user data — reading
 * the rules on a bright table in a game store is a different problem from
 * reading them at home, and it shouldn't follow the account to another screen.
 */
export function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    // Private-mode Safari and similar can throw on localStorage access.
    return DEFAULT_THEME;
  }
}

export function writeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* preference only — losing it costs one tap */
  }
}

/**
 * Puts the theme on the document. Everything else follows from the CSS
 * variables keyed off `data-theme`; the only extra work is the `theme-color`
 * meta tag, which browsers read rather than compute.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  // `dark` drives Tailwind's `dark:` variant, which the parchment theme is not.
  root.classList.toggle('dark', theme === 'grimdark');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', META_THEME_COLOUR[theme]);
}
