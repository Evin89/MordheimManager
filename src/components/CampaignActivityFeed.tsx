import { useMemo, useState } from 'react';
import { Campaign } from '../types';
import { useBattlesQuery, useCampaignWarbandsQuery } from '../hooks/useCampaign';
import { useCampaignLogQuery } from '../hooks/useCampaignLog';
import { useCampaignEventsQuery } from '../hooks/useEvents';
import { useTerritoriesQuery } from '../hooks/useTerritories';
import { SectionHeading } from './ui';
import { strings } from '../strings';

/**
 * §17.x — one timeline merging what the campaign's separate tabs each hold in
 * isolation: battles, narrative log entries, scheduled game nights, the pinned
 * announcement, and territory claims. It answers "what happened since I last
 * looked" without opening five tabs to find out.
 *
 * Built entirely from data the campaign screen already loads (or would load for
 * its own tabs), merged and sorted client-side rather than through a new feed
 * table — the sources all carry their own timestamp. Event RSVPs are the one
 * activity left out: they have no campaign-wide query yet, only per-event.
 */

type Kind = 'battle' | 'log' | 'event' | 'announcement' | 'territory';

type FeedItem = {
  id: string;
  timestamp: string;
  kind: Kind;
  title: string;
  sub?: string;
};

const DOT: Record<Kind, string> = {
  battle: 'bg-ember-500',
  log: 'bg-bone-400',
  event: 'bg-verdigris',
  announcement: 'bg-ember-400',
  territory: 'bg-bone-300',
};

const INITIAL_SHOWN = 12;

export default function CampaignActivityFeed({ campaign }: { campaign: Campaign }) {
  const t = strings.campaign.activity;
  const { data: battles } = useBattlesQuery(campaign.id);
  const { data: logEntries } = useCampaignLogQuery(campaign.id);
  const { data: events } = useCampaignEventsQuery(campaign.id);
  const { data: territories } = useTerritoriesQuery(campaign.id);
  const { data: campaignWarbands } = useCampaignWarbandsQuery(campaign.id);

  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => {
    const names = new Map((campaignWarbands ?? []).map((w) => [w.id, w.name]));
    const out: FeedItem[] = [];

    for (const b of battles ?? []) {
      const result =
        b.result === 'win' ? strings.campaign.win : b.result === 'loss' ? strings.campaign.loss : strings.campaign.draw;
      const warband = names.get(b.warbandId) ?? strings.campaign.unknownWarband;
      const opponents = b.opponents.filter(Boolean).join(', ');
      out.push({
        id: `battle-${b.id}`,
        timestamp: b.date,
        kind: 'battle',
        title: t.battle(warband, result),
        sub: opponents ? t.battleVs(opponents) : undefined,
      });
    }

    for (const e of logEntries ?? []) {
      out.push({
        id: `log-${e.id}`,
        timestamp: e.createdAt,
        kind: 'log',
        title: t.log(e.authorDisplayName),
        sub: t.logTitle(e.title),
      });
    }

    // Only game nights that have already happened — a future one is "upcoming",
    // shown by the NextEventBanner, and its future date would otherwise sort to
    // the very top of a panel about what has *happened*.
    const now = Date.now();
    for (const ev of events ?? []) {
      if (new Date(ev.eventDateTime).getTime() > now) continue;
      out.push({
        id: `event-${ev.id}`,
        timestamp: ev.eventDateTime,
        kind: 'event',
        title: t.event(ev.title),
        sub: ev.location || undefined,
      });
    }

    for (const terr of territories ?? []) {
      if (!terr.createdAt) continue;
      const holder = terr.controlledByWarbandId ? names.get(terr.controlledByWarbandId) : undefined;
      out.push({
        id: `territory-${terr.id}`,
        timestamp: terr.createdAt,
        kind: 'territory',
        title: t.territory(terr.name),
        sub: holder ? t.territoryBy(holder) : undefined,
      });
    }

    if (campaign.pinnedAnnouncement && campaign.pinnedAnnouncementAt) {
      out.push({
        id: 'announcement',
        timestamp: campaign.pinnedAnnouncementAt,
        kind: 'announcement',
        title: t.announcement,
        sub: campaign.pinnedAnnouncement,
      });
    }

    return out.sort((a, z) => z.timestamp.localeCompare(a.timestamp));
  }, [battles, logEntries, events, territories, campaignWarbands, campaign, t]);

  const shown = showAll ? items : items.slice(0, INITIAL_SHOWN);

  return (
    <section className="space-y-3">
      <SectionHeading>{t.section}</SectionHeading>
      {items.length === 0 ? (
        <p className="text-bone-300 text-sm">{t.empty}</p>
      ) : (
        <div className="rounded-lg bg-ink-900 border border-ink-800 p-4">
          <ol className="space-y-3">
            {shown.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${DOT[item.kind]}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-bone-100 text-sm truncate">{item.title}</p>
                    <time className="text-bone-400 text-xs shrink-0 tabular-nums">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </time>
                  </div>
                  {item.sub && <p className="text-bone-400 text-xs truncate">{item.sub}</p>}
                </div>
              </li>
            ))}
          </ol>
          {items.length > INITIAL_SHOWN && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-3 min-h-[44px] text-ember-400 text-sm font-semibold"
            >
              {t.more(items.length - INITIAL_SHOWN)}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
