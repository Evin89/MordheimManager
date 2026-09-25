import { useState } from 'react';
import { Button, Card, SectionHeading } from './ui';
import { strings } from '../strings';
import { capture } from '../lib/posthog';
import { hasFoughtFirstBattle } from '../lib/battleHistory';
import { useBattlesQuery, usePersonalBattlesQuery } from '../hooks/useCampaign';
import { useSetWarbandVisibilityMutation, useWarbandSharing } from '../hooks/useWarbands';

/**
 * §26.5 — private by default, public on invitation.
 *
 * Warbands stay private unless their owner chooses otherwise; this only makes
 * "public" a choice they see rather than one they have to discover. It appears
 * on the owner's own warband screen, while the warband is private, once it has
 * a logged battle — a roster with history is worth showing, and that's a moment
 * of pride rather than an interruption on day one.
 *
 * "Not now" is remembered per warband in localStorage: a per-viewer convenience,
 * so browser storage is the right home, and every access is guarded because it
 * can throw (private mode, blocked site data) — the card then simply reappears.
 */

const DISMISS_PREFIX = 'mordheim.shareNudgeDismissed.';

function isDismissed(warbandId: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_PREFIX + warbandId) === '1';
  } catch {
    return false;
  }
}

function rememberDismissed(warbandId: string): void {
  try {
    window.localStorage.setItem(DISMISS_PREFIX + warbandId, '1');
  } catch {
    /* storage unavailable — the card just comes back next visit */
  }
}

/** The public roster link, tagged so §23.4 attributes any signup it brings in. */
function shareLink(warbandId: string): string {
  return `${window.location.origin}/app/rosters/${warbandId}?ref=share-link`;
}

export default function ShareNudgeCard({ warbandId }: { warbandId: string }) {
  const s = strings.shareNudge;
  const { campaignId, visibility } = useWarbandSharing(warbandId);
  // Battles live in the campaign log when the warband is entered in one, and in
  // the player's personal log otherwise (§4.3) — either counts as "has fought".
  const { data: campaignBattles } = useBattlesQuery(campaignId ?? undefined);
  const { data: personalBattles } = usePersonalBattlesQuery();
  const setVisibility = useSetWarbandVisibilityMutation();

  const [dismissed, setDismissed] = useState(() => isDismissed(warbandId));
  // Once made public the card stays up to hand over the link, even though the
  // warband is no longer private.
  const [madePublic, setMadePublic] = useState(false);
  const [copied, setCopied] = useState(false);

  const fought = hasFoughtFirstBattle(warbandId, [...(campaignBattles ?? []), ...(personalBattles ?? [])]);

  if (dismissed) return null;
  if (!madePublic && (visibility !== 'private' || !fought)) return null;

  function dismiss() {
    rememberDismissed(warbandId);
    setDismissed(true);
  }

  function makePublic() {
    setVisibility(warbandId, 'public', () => {
      void capture('warband_visibility_changed', { visibility: 'public' });
      setMadePublic(true);
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink(warbandId));
      setCopied(true);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  }

  if (madePublic) {
    return (
      <Card as="section" gap="sm">
        <SectionHeading>{s.publicTitle}</SectionHeading>
        <p className="text-bone-300 text-sm">{s.publicBody}</p>
        <p className="break-all rounded-md border border-ink-700 bg-ink-800 px-3 py-2 font-ui text-sm text-bone-100">
          {shareLink(warbandId)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="dense" onClick={() => void copyLink()}>
            {copied ? s.copied : s.copyLink}
          </Button>
          <Button size="dense" variant="ghost" onClick={dismiss}>
            {s.done}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card as="section" gap="sm">
      <SectionHeading>{s.title}</SectionHeading>
      <p className="text-bone-300 text-sm">{campaignId ? s.bodyInCampaign : s.body}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="dense" onClick={makePublic}>
          {s.makePublic}
        </Button>
        <Button size="dense" variant="ghost" onClick={dismiss}>
          {s.notNow}
        </Button>
      </div>
    </Card>
  );
}
