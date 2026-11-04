import { useEffect, useState } from 'react';
import { EllipsisVertical, Share, X } from 'lucide-react';
import { Button, Card, SectionHeading } from './ui';
import { strings } from '../strings';
import { capture } from '../lib/posthog';
import { promptInstall, type InstallState } from '../lib/install';
import { useInstall } from '../hooks/useInstall';

/**
 * §36.4 — the two places the app offers to install itself: the permanent card
 * on Account, and a dismissible nudge on Home. Same states, same copy; the
 * nudge is the compact form. Both render nothing once installed, or where
 * there's no reliable install path to describe (desktop Firefox/Safari).
 */

type Surface = 'account' | 'home';

const OFFERED: InstallState[] = ['promptable', 'ios', 'android-manual'];

// `install_cta_shown` once per surface per session, however often it re-renders.
const shownThisSession = new Set<Surface>();

function useShownEvent(surface: Surface, state: InstallState, visible: boolean): void {
  useEffect(() => {
    if (!visible || shownThisSession.has(surface)) return;
    shownThisSession.add(surface);
    void capture('install_cta_shown', { surface, state });
  }, [surface, state, visible]);
}

function Steps({ steps, Icon }: { steps: readonly string[]; Icon: typeof Share }) {
  return (
    <ol className="list-decimal pl-5 space-y-1 text-bone-200 text-sm">
      {steps.map((step, i) => (
        <li key={step}>
          {step}
          {i === 0 && <Icon className="inline-block w-4 h-4 ml-1 align-text-bottom text-ember-400" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

/** The state-specific body shared by both surfaces. */
function InstallBody({ state, surface }: { state: InstallState; surface: Surface }) {
  const s = strings.install;

  if (state === 'just-installed') return <p className="text-bone-200 text-sm">{s.justInstalled}</p>;

  if (state === 'promptable') {
    return (
      <Button
        onClick={() => {
          void capture('install_clicked', { surface });
          // A dismissal spends the event; the store then falls back to the
          // manual steps on its own, so there's no dead button to handle here.
          void promptInstall();
        }}
      >
        {s.button}
      </Button>
    );
  }

  if (state === 'ios') {
    return (
      <>
        <Steps steps={s.iosSteps} Icon={Share} />
        <p className="text-bone-400 text-xs">{s.iosInAppHint}</p>
      </>
    );
  }

  return (
    <>
      <Steps steps={s.androidSteps} Icon={EllipsisVertical} />
      <p className="text-bone-400 text-xs">{s.androidInAppHint}</p>
      <p className="text-bone-400 text-xs">{s.androidFootnote}</p>
    </>
  );
}

/** Account → "Install the app". Device-level, so it shows signed in or out. */
export function InstallSection() {
  const state = useInstall();
  const visible = state !== 'installed' && state !== 'unsupported';
  useShownEvent('account', state, OFFERED.includes(state));
  if (!visible) return null;

  return (
    <Card as="section" id="install" className="scroll-mt-4">
      <SectionHeading>{strings.install.section}</SectionHeading>
      <p className="text-bone-300 text-sm">{strings.install.intro}</p>
      <InstallBody state={state} surface="account" />
    </Card>
  );
}

const NUDGE_DISMISSED_KEY = 'mordheim.installNudgeDismissed';

function nudgeDismissed(): boolean {
  try {
    return window.localStorage.getItem(NUDGE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Home nudge. The caller decides *who* sees it (signed in, at least one
 * warband — §26.4's empty state stays a single card); this decides *when*.
 * Dismissing it is per device and never hides the Account card.
 */
export function InstallNudgeCard() {
  const state = useInstall();
  const [dismissed, setDismissed] = useState(nudgeDismissed);
  // Kept up after a successful install from here, to say where the app went.
  const visible = !dismissed && (OFFERED.includes(state) || state === 'just-installed');
  useShownEvent('home', state, !dismissed && OFFERED.includes(state));
  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(NUDGE_DISMISSED_KEY, '1');
    } catch {
      /* storage unavailable — hidden for this visit only */
    }
    setDismissed(true);
    void capture('install_nudge_dismissed');
  }

  return (
    <Card as="section">
      <div className="flex items-start justify-between gap-3">
        <SectionHeading>{strings.install.nudgeTitle}</SectionHeading>
        <button
          type="button"
          onClick={dismiss}
          aria-label={strings.install.nudgeDismiss}
          className="-mt-2 -mr-2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-bone-400 hover:text-bone-100"
        >
          <X className="w-5 h-5" aria-hidden />
        </button>
      </div>
      <InstallBody state={state} surface="home" />
    </Card>
  );
}
