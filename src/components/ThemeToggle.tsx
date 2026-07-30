import { Theme, THEMES } from '../lib/theme';
import { strings } from '../strings';

/** Swatch colours are hard-coded rather than themed: each half has to show what
 * it *would* look like, so it can't follow the theme currently in effect. */
const SWATCH: Record<Theme, { paper: string; accent: string }> = {
  grimdark: { paper: '#141210', accent: '#f2751a' },
  parchment: { paper: '#f4eede', accent: '#7a521a' },
};

/**
 * Two-position slider for the theme.
 *
 * A radiogroup rather than a switch: both options are named and equal, and a
 * switch implies one is "on" and the other simply its absence. The sliding
 * indicator sits behind the labels and is purely decorative — selection is
 * conveyed by `aria-checked`, so it still reads correctly with animations
 * disabled or a screen reader in use.
 */
export default function ThemeToggle({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
}) {
  const index = THEMES.indexOf(theme);

  return (
    <div
      role="radiogroup"
      aria-label={strings.settings.appearanceSection}
      className="relative flex rounded-full border border-ink-700 bg-ink-800 p-1"
      onKeyDown={(e) => {
        // Arrow keys are the expected way through a radiogroup.
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const next = e.key === 'ArrowRight' ? index + 1 : index - 1;
        const clamped = Math.min(THEMES.length - 1, Math.max(0, next));
        onChange(THEMES[clamped]);
      }}
    >
      {/* The travelling highlight. `aria-hidden` because the checked state is
          already on the buttons. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-ember-500 transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }}
      />

      {THEMES.map((option) => {
        const active = option === theme;
        const swatch = SWATCH[option];
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option)}
            className={`relative z-10 flex-1 min-h-[44px] rounded-full px-3 flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
              active ? 'text-ink-950' : 'text-bone-300'
            }`}
          >
            {/* A plain disc of the theme's own paper colour, ringed in its
                accent. Anything more detailed turns to mush at this size — an
                earlier version drew miniature lines of text and read as a
                minus sign. */}
            <span
              aria-hidden="true"
              className="h-4 w-4 rounded-full border-2 shrink-0"
              style={{ background: swatch.paper, borderColor: swatch.accent }}
            />
            {strings.settings.themeNames[option]}
          </button>
        );
      })}
    </div>
  );
}
