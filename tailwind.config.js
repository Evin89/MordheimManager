/** @type {import('tailwindcss').Config} */

// Every colour resolves through a CSS variable so a theme can be swapped by
// redefining those variables, rather than rewriting the ~1200 utility classes
// that reference them. `<alpha-value>` keeps Tailwind's opacity modifiers
// (bg-ink-950/95) working, which the save bar and connection banner rely on.
const themed = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces. 950 is the page, 900 a raised card, 800/700 borders.
        // Parchment keeps those roles and only changes what they look like.
        ink: {
          // Spec §5.1's `ink`: body text, icons, borders. Themed rather than a
          // fixed hex, because Rulebook is one of two themes and not the whole
          // app — under Grimdark the same *role* has to become bone-on-black.
          // Available as `text-ink` / `border-ink` alongside the older numbered
          // surfaces, so screens can migrate one at a time.
          DEFAULT: themed('ink'),
          950: themed('ink-950'),
          900: themed('ink-900'),
          800: themed('ink-800'),
          700: themed('ink-700'),
        },
        // Secondary text and placeholders (§5.1). Never for information the
        // user must read in order to act.
        'ink-faded': themed('ink-faded'),
        // Text, strongest to faintest. 400 was used in 29 places without ever
        // being defined, so those elements silently inherited their parent's
        // colour instead of going dimmer.
        bone: {
          100: themed('bone-100'),
          200: themed('bone-200'),
          300: themed('bone-300'),
          400: themed('bone-400'),
        },
        ember: {
          400: themed('ember-400'),
          500: themed('ember-500'),
          600: themed('ember-600'),
        },
        blood: {
          // Spec §5.1's single `blood` accent. Under Grimdark this role is
          // carried by the ember orange that theme is built around, which is
          // why it resolves through a variable rather than the literal hex.
          // The numbered scale below belongs to the older palette and stays
          // until the last screen has migrated.
          DEFAULT: themed('accent'),
          500: themed('blood-500'),
          600: themed('blood-600'),
        },

        // --- Rulebook design language (spec §5.1) ---
        // Role names come from the spec. Values per theme live in index.css,
        // together with the measured contrast ratios.
        parchment: {
          DEFAULT: themed('parchment'), // app background, flat base
          raised: themed('parchment-raised'), // cards, sheets, inputs
        },
        // Whatever is legible on `blood`/accent in the active theme — white on
        // Rulebook's dark red, near-black on Grimdark's orange. A shared
        // component cannot hardcode either and stay accessible in both.
        'on-accent': themed('on-accent'),
        verdigris: themed('verdigris'), // success/confirm — aged copper, never bright green
      },

      // Spec §5.2: three roles, four families. `display` is blackletter and is
      // barred from anything but titles ≥24px — see the guard in index.css.
      fontFamily: {
        display: ['"Pirata One"', 'Georgia', 'serif'],
        heading: ['"IM Fell English"', 'Georgia', 'serif'],
        'heading-sc': ['"IM Fell English SC"', 'Georgia', 'serif'],
        body: ['Alegreya', 'Georgia', 'serif'],
        ui: ['"Alegreya Sans"', 'system-ui', 'sans-serif'],
      },

      // §5.4 floors, as named sizes so a screen can't quietly go under them.
      fontSize: {
        'stat-min': ['0.875rem', { lineHeight: '1.1' }], // 14px — statline numbers
        'body-min': ['1rem', { lineHeight: '1.5' }], // 16px — running text
      },
    },
  },
  plugins: [],
};
