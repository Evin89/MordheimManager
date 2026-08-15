import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { NAV_ITEMS } from './navItems';
import { strings } from '../strings';

/**
 * A guided click-through of the navigation (spec §20.4).
 *
 * A first-time player lands on a row of tabs whose icons don't yet mean
 * anything. This walks each one in turn — spotlighting the actual nav control
 * and saying in a sentence what it does — so the app explains its own shape
 * without a manual.
 *
 * It drives entirely off `NAV_ITEMS`, the single list both `BottomNav` and
 * `SideNav` render from, so the tour can never describe a tab that isn't there
 * or miss one that is. Each step finds its live DOM element by the
 * `data-nav-to` attribute both navs carry, and spotlights whichever copy is
 * visible — the bottom bar on a phone, the sidebar rail on a desktop.
 *
 * No dependency: an overlay, a CSS box-shadow cutout for the spotlight, and a
 * card positioned from `getBoundingClientRect()`, consistent with the
 * no-date-library / no-chart-library discipline elsewhere.
 *
 * Auto-offers once to a signed-in player (a localStorage flag suppresses it
 * after), and the floating ? reopens it forever — so it never nags a returning
 * player but is always there when someone new picks up the phone at the table.
 */

const SEEN_KEY = 'mordheim.navTourSeen';
const MD = 768; // Tailwind's md — below it the bottom bar shows, at/above the rail.

type Rect = { top: number; left: number; right: number; width: number; height: number };

/** The visible copy of a nav control (the hidden nav measures as zero). */
function findNavRect(to: string): Rect | null {
  const els = document.querySelectorAll<HTMLElement>(`[data-nav-to="${to}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { top: r.top, left: r.left, right: r.right, width: r.width, height: r.height };
    }
  }
  return null;
}

export default function NavTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const total = NAV_ITEMS.length;
  const item = NAV_ITEMS[step];

  const measure = useCallback(() => {
    setRect(open ? findNavRect(NAV_ITEMS[step].to) : null);
  }, [open, step]);

  // Measure after paint so the nav is laid out, and again on resize/orientation
  // change since the bottom bar and the sidebar swap at the md breakpoint.
  useLayoutEffect(() => {
    measure();
  }, [measure]);
  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, measure]);

  // Auto-offer once, to a signed-in player only — a casual signed-out visitor
  // hasn't asked for a tour. The short delay lets the nav mount first.
  useEffect(() => {
    if (!user) return;
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      /* private mode — just don't auto-run */
    }
    if (seen) return;
    const t = setTimeout(() => {
      setStep(0);
      setOpen(true);
    }, 700);
    return () => clearTimeout(t);
  }, [user]);

  function markSeen() {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  function close() {
    setOpen(false);
    markSeen();
  }

  function start() {
    setStep(0);
    setOpen(true);
  }

  const isBottomBar = typeof window !== 'undefined' && window.innerWidth < MD;

  // Card placement: above the bottom bar on a phone, beside the rail on desktop.
  const cardStyle: React.CSSProperties = !rect
    ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', maxWidth: 340 }
    : isBottomBar
      ? { left: 16, right: 16, bottom: window.innerHeight - rect.top + 12 }
      : {
          left: rect.right + 14,
          top: Math.min(Math.max(rect.top + rect.height / 2 - 90, 12), window.innerHeight - 210),
          width: 320,
        };

  return (
    <>
      {/* The floating control. Top-right per the request, opposite the
          bottom-anchored report button. Hidden while the tour is open. */}
      {!open && (
        <button
          type="button"
          onClick={start}
          aria-label={strings.tour.open}
          className="print:hidden fixed top-2 right-2 md:top-3 md:right-3 z-40 h-10 w-10 rounded-full bg-ink-900/90 border border-ink-700 text-ember-400 font-bold text-lg shadow-lg backdrop-blur-sm hover:bg-ink-800 transition-colors"
        >
          ?
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={strings.tour.title}>
          {/* Full-screen catcher: blocks the app beneath, and a tap anywhere
              outside the card advances — forgiving on a phone. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => (step < total - 1 ? setStep(step + 1) : close())}
            className="absolute inset-0 w-full h-full cursor-default"
          />

          {/* The spotlight: a transparent box over the target whose huge
              box-shadow dims everything else, leaving the highlighted tab
              showing through. Paint only — clicks pass to the catcher. */}
          {rect && (
            <div
              className="absolute rounded-lg pointer-events-none ring-2 ring-ember-400"
              style={{
                top: rect.top - 6,
                left: rect.left - 6,
                width: rect.width + 12,
                height: rect.height + 12,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
              }}
            />
          )}

          {/* The card. */}
          <div
            className="absolute rounded-xl bg-ink-900 border border-ink-700 shadow-2xl p-4 space-y-3"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-ui text-xs uppercase tracking-wide text-bone-400">
                {strings.tour.title}
              </span>
              <span className="font-ui text-xs tabular-nums text-bone-400">
                {strings.tour.progress(step + 1, total)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-9 w-9 shrink-0 rounded-md bg-ink-800 border border-ink-700 flex items-center justify-center text-ember-400">
                <item.Icon className="h-5 w-5" />
              </span>
              <h2 className="text-bone-100 font-semibold text-lg">{item.label}</h2>
            </div>

            <p className="text-bone-300 text-sm leading-snug">{item.help}</p>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={close}
                className="min-h-[44px] px-2 text-bone-400 text-sm"
              >
                {strings.tour.skip}
              </button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="min-h-[44px] px-4 rounded-md border border-ink-700 text-bone-200 text-sm font-semibold"
                  >
                    {strings.tour.back}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (step < total - 1 ? setStep(step + 1) : close())}
                  className="min-h-[44px] px-4 rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 text-sm font-semibold transition-colors"
                >
                  {step < total - 1 ? strings.tour.next : strings.tour.done}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
