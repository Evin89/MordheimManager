import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClaimableCampaignsQuery, useClaimLeadershipMutation } from '../hooks/useCampaign';
import { writeActiveCampaignId } from '../lib/activeCampaign';
import { strings } from '../strings';
import { Button } from './ui';

/**
 * §10.3.1 — the claim pop-up for a campaign whose leaders have gone quiet.
 *
 * Shown to members of a campaign in which every leader has been unseen for 30
 * days (migration 0051). Claiming makes the member a co-leader; the absent
 * leader keeps their role. The first member to claim wins — after that the
 * campaign has an active leader and the pop-up stops appearing for everyone.
 *
 * Arrives two ways: on its own, on any app load while a campaign is claimable;
 * and from the notification email, whose link carries `?claim=<campaign id>` —
 * which opens it even if the member dismissed it earlier. "Not now" hides it
 * for the rest of this browser session only (sessionStorage), so it comes back
 * next visit rather than being lost; the choice to lead is too important to
 * bury behind one tap.
 */

const DISMISS_PREFIX = 'mordheim.claimDismissed.';

function dismissedThisSession(id: string): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

function dismissForSession(id: string): void {
  try {
    window.sessionStorage.setItem(DISMISS_PREFIX + id, '1');
  } catch {
    /* storage unavailable — it simply shows again */
  }
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

type Outcome = { kind: 'claimed' | 'taken' | 'notClaimable' | 'error'; campaignName?: string; campaignId?: string };

export default function LeaderClaimPrompt() {
  const { data: claimable } = useClaimableCampaignsQuery();
  const claim = useClaimLeadershipMutation();
  const location = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // The campaign the email linked to: shown even if dismissed earlier.
  const [forced, setForced] = useState<string | null>(null);

  // The email's deep link. Read once the claimable list has loaded, then
  // stripped from the URL so a refresh doesn't re-trigger it.
  const linkedId = new URLSearchParams(location.search).get('claim');
  useEffect(() => {
    if (!linkedId || claimable === undefined) return;
    const params = new URLSearchParams(location.search);
    params.delete('claim');
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : '' }, { replace: true });
    if (!claimable.some((c) => c.campaignId === linkedId)) setOutcome({ kind: 'notClaimable' });
    else setForced(linkedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedId, claimable]);

  const s = strings.leaderClaim;

  if (outcome) {
    const message =
      outcome.kind === 'claimed'
        ? s.claimed(outcome.campaignName ?? '')
        : outcome.kind === 'taken'
          ? s.taken
          : outcome.kind === 'notClaimable'
            ? s.notClaimable
            : s.error;
    return (
      <Dialog label={s.title('')}>
        <p className="text-bone-200 text-sm">{message}</p>
        <div className="flex justify-end">
          <Button
            fullWidth={false}
            onClick={() => {
              setOutcome(null);
              if (outcome.kind === 'claimed') navigate('/campaign');
            }}
          >
            {outcome.kind === 'claimed' ? s.openCampaign : s.close}
          </Button>
        </div>
      </Dialog>
    );
  }

  const candidate =
    claimable?.find((c) => c.campaignId === forced) ??
    claimable?.find((c) => !dismissed.has(c.campaignId) && !dismissedThisSession(c.campaignId));
  if (!candidate) return null;

  const days = daysAgo(candidate.leadersLastSeen);

  async function onClaim() {
    try {
      const ok = await claim.mutateAsync(candidate!.campaignId);
      if (ok) {
        // Their newly-led campaign becomes the one the campaign screens show.
        writeActiveCampaignId(candidate!.campaignId);
        setOutcome({ kind: 'claimed', campaignName: candidate!.campaignName, campaignId: candidate!.campaignId });
      } else {
        setOutcome({ kind: 'taken' });
      }
    } catch {
      setOutcome({ kind: 'error' });
    }
    setForced(null);
  }

  function notNow() {
    dismissForSession(candidate!.campaignId);
    setDismissed((d) => new Set(d).add(candidate!.campaignId));
    setForced(null);
  }

  return (
    <Dialog label={s.title(candidate.campaignName)}>
      <h2 className="text-bone-100 font-semibold text-lg">{s.title(candidate.campaignName)}</h2>
      <p className="text-bone-200 text-sm">{s.body(days)}</p>
      <p className="text-bone-300 text-sm">{s.coLeader}</p>
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button fullWidth={false} variant="ghost" onClick={notNow} disabled={claim.isPending}>
          {s.notNow}
        </Button>
        <Button fullWidth={false} onClick={() => void onClaim()} disabled={claim.isPending}>
          {claim.isPending ? s.claiming : s.claim}
        </Button>
      </div>
    </Dialog>
  );
}

function Dialog({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-950/70"
    >
      <div className="w-full max-w-md rounded-lg bg-ink-900 border border-ink-800 p-5 space-y-3">{children}</div>
    </div>
  );
}
