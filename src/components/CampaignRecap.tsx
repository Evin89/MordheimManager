import { useEffect, useRef, useState } from 'react';
import { BattleRecord, Campaign, StandingsRow } from '../types';
import { computeAwards } from '../lib/awards';
import { renderCampaignRecap } from '../lib/campaignRecap';
import { useSetConcludedMutation } from '../hooks/useCampaign';
import { Button, SectionHeading } from './ui';
import { strings } from '../strings';

/** The award-string bundle computeAwards expects, pulled from the campaign strings. */
const AWARD_STRINGS = {
  mostWyrdstone: strings.campaign.awardMostWyrdstone,
  mostWyrdstoneValue: strings.campaign.awardMostWyrdstoneValue,
  longestStreak: strings.campaign.awardLongestStreak,
  longestStreakValue: strings.campaign.awardLongestStreakValue,
  mostBattles: strings.campaign.awardMostBattles,
  mostBattlesValue: strings.campaign.awardMostBattlesValue,
  highestRating: strings.campaign.awardHighestRating,
  highestRatingValue: strings.campaign.awardHighestRatingValue,
};

/**
 * End-of-campaign recap (spec §recap): the leader can conclude the campaign, and
 * anyone can render its final standings and honours to a shareable image — the
 * same build/share/download flow as the warband card. Concluding is just a
 * timestamp; the live standings don't change, so a concluded campaign is a
 * recap you can still reopen.
 */
export default function CampaignRecap({
  campaign,
  standings,
  battles,
  isLeader,
}: {
  campaign: Campaign;
  standings: StandingsRow[];
  battles: BattleRecord[];
  isLeader: boolean;
}) {
  const t = strings.campaign.recap;
  const setConcluded = useSetConcludedMutation(campaign.id);
  const hasData = battles.length > 0 && standings.some((r) => r.warbandName);

  const [state, setState] = useState<'idle' | 'building' | 'ready' | 'error'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function build() {
    setState('building');
    try {
      const awards = computeAwards(battles, standings, AWARD_STRINGS);
      const blob = await renderCampaignRecap(campaign.name, standings, awards);
      blobRef.current = blob;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setState('ready');
    } catch {
      setState('error');
    }
  }

  const fileName = `${campaign.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'campaign'}-recap.png`;

  function download() {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const file = blobRef.current ? new File([blobRef.current], fileName, { type: 'image/png' }) : null;
  const canShare =
    !!file && typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] });

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: t.shareCaption(campaign.name) });
    } catch {
      /* dismissed */
    }
  }

  return (
    <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <SectionHeading>{t.concludeSection}</SectionHeading>

      {campaign.concludedAt && (
        <p className="text-ember-400 text-sm font-semibold">
          {t.concludedBanner(new Date(campaign.concludedAt).toLocaleDateString())}
        </p>
      )}

      {isLeader && (
        <>
          {!campaign.concludedAt && <p className="text-bone-400 text-xs">{t.concludeHint}</p>}
          {campaign.concludedAt ? (
            <Button variant="secondary" onClick={() => setConcluded(false)}>
              {t.reopenButton}
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                if (window.confirm(t.concludeConfirm)) setConcluded(true);
              }}
            >
              {t.concludeButton}
            </Button>
          )}
        </>
      )}

      {!hasData ? (
        <p className="text-bone-300 text-sm">{t.noStandings}</p>
      ) : (
        <>
          {state === 'ready' && previewUrl && (
            <img src={previewUrl} alt={t.shareCaption(campaign.name)} className="w-full rounded-md border border-ink-800" />
          )}
          {state === 'error' && <p className="text-blood-500 text-sm">{strings.roster.card.failed}</p>}

          {state !== 'ready' ? (
            <Button disabled={state === 'building'} onClick={build}>
              {state === 'building' ? t.sharing : t.shareButton}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              {canShare && <Button onClick={share}>{strings.roster.card.share}</Button>}
              <Button variant="secondary" onClick={download}>
                {strings.roster.card.download}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
