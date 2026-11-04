import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdminCampaignContentQuery, useAdminCampaignDetailQuery } from '../../hooks/useIssues';
import type { AdminCampaignContent } from '../../api/adminCampaigns';
import { buildStandingsRows } from '../../api/campaign';
import BattleRow from '../../components/BattleRow';
import { getWarbandTypeName } from '../../data/warbandRegistry';
import { HOUSE_RULES } from '../../data/houseRules';
import { strings } from '../../strings';
import { Stat, ago } from './shared';

const s = strings.adminCampaign;

function day(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** A collapsible section — the screen is long, and most visits want one part. */
function Section({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-ink-800 bg-ink-900">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
        <span className="text-bone-100 font-semibold">
          {title}
          {count !== undefined && count > 0 && <span className="text-bone-400 font-normal"> ({count})</span>}
        </span>
        <span aria-hidden className="text-bone-400 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="border-t border-ink-800 px-3 py-3 space-y-2">{children}</div>
    </details>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-bone-400 text-sm">{children}</p>;
}

function Settings({ content }: { content: AdminCampaignContent }) {
  const c = content.campaign;
  // Only rules whose effective state differs from the rulebook default — the
  // same "what did this group change" view the house-rules panel gives.
  const changed = HOUSE_RULES.filter((r) => (c.houseRules[r.id] ?? r.defaultOn) !== r.defaultOn);
  return (
    <Section title={s.settings} defaultOpen>
      <p className="font-ui text-xs text-bone-400">
        {c.usesBTB ? s.btb : s.btbOff}
        {' · '}
        {content.hasJoinCode ? s.joinCodeActive : s.joinCodeRevoked}
        {' · '}
        {c.concludedAt ? s.concluded(day(c.concludedAt)) : s.ongoing}
      </p>
      {c.pinnedAnnouncement && (
        <div>
          <p className="font-ui text-xs uppercase tracking-wide text-bone-400">
            {s.announcement}
            {c.pinnedAnnouncementAt && ` · ${day(c.pinnedAnnouncementAt)}`}
          </p>
          <p className="text-bone-200 text-sm whitespace-pre-wrap">{c.pinnedAnnouncement}</p>
        </div>
      )}
      {c.notes && (
        <div>
          <p className="font-ui text-xs uppercase tracking-wide text-bone-400">{s.notes}</p>
          <p className="text-bone-200 text-sm whitespace-pre-wrap">{c.notes}</p>
        </div>
      )}
      <div>
        <p className="font-ui text-xs uppercase tracking-wide text-bone-400">{s.houseRules}</p>
        {changed.length === 0 ? (
          <p className="text-bone-300 text-sm">{s.houseRulesNone}</p>
        ) : (
          <ul className="text-bone-200 text-sm list-disc pl-5">
            {changed.map((r) => (
              <li key={r.id}>
                {r.label}: {(c.houseRules[r.id] ?? r.defaultOn) ? 'on' : 'off'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

/** Same derivation the member Standings tab uses — one implementation, so the
 * admin view can't drift from what players see. */
function Standings({ content }: { content: AdminCampaignContent }) {
  const rows = buildStandingsRows(content.members, content.warbands, content.battles);
  return (
    <Section title={s.standings} count={rows.length} defaultOpen>
      <div className="overflow-x-auto -mx-3">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.ownerId}-${r.warbandId ?? 'none'}`} className="border-b border-ink-800 last:border-b-0">
                <td className="px-3 py-2">
                  {r.warbandId ? (
                    <Link
                      to={`/admin/players/${r.ownerId}/warbands/${r.warbandId}`}
                      className="text-bone-100 hover:text-ember-400"
                    >
                      {r.warbandName}
                    </Link>
                  ) : (
                    <span className="font-ui text-xs text-bone-400">{s.noWarband}</span>
                  )}
                  <span className="block font-ui text-xs text-bone-400">
                    <Link to={`/admin/players/${r.ownerId}`} className="hover:text-ember-400">
                      {r.playerName || 'Unnamed'}
                    </Link>
                    {r.warbandType && ` · ${getWarbandTypeName(r.warbandType)}`}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-ui tabular-nums lining-nums text-bone-300 whitespace-nowrap">
                  {r.wins}–{r.losses}–{r.draws}
                </td>
                <td className="px-3 py-2 text-right font-ui tabular-nums lining-nums text-bone-100 whitespace-nowrap">
                  {r.rating ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Battles({ content }: { content: AdminCampaignContent }) {
  const warbandName = (id: string) => content.warbands.find((w) => w.id === id)?.name ?? 'Unknown warband';
  const memberName = (id: string | undefined) =>
    content.members.find((m) => m.userId === id)?.displayName || 'a former member';
  return (
    <Section title={s.battles} count={content.battles.length}>
      {content.battles.length === 0 ? (
        <Empty>{s.noBattles}</Empty>
      ) : (
        // Newest first, like the member battle log. No onDelete — read-only.
        [...content.battles].reverse().map((battle) => (
          <div key={battle.id} className="space-y-1">
            <BattleRow battle={battle} warbandName={warbandName(battle.warbandId)} />
            <p className="font-ui text-xs text-bone-400 pl-1">{s.reportedBy(memberName(content.reporters[battle.id]))}</p>
          </div>
        ))
      )}
    </Section>
  );
}

function Events({ content }: { content: AdminCampaignContent }) {
  const now = Date.now();
  const upcoming = content.events.filter((e) => new Date(e.eventDateTime).getTime() >= now);
  const past = content.events.filter((e) => new Date(e.eventDateTime).getTime() < now).reverse();
  const name = (id: string) => content.members.find((m) => m.userId === id)?.displayName || 'Unnamed';

  const renderEvent = (e: AdminCampaignContent['events'][number]) => {
    const replies = content.rsvps.filter((r) => r.eventId === e.id);
    const group = (status: 'going' | 'maybe' | 'cant', label: string) => {
      const who = replies.filter((r) => r.status === status).map((r) => name(r.userId));
      return who.length > 0 ? (
        <p className="font-ui text-xs text-bone-300">
          <span className="font-semibold">
            {label} ({who.length}):
          </span>{' '}
          {who.join(', ')}
        </p>
      ) : null;
    };
    return (
      <div key={e.id} className="rounded-md border border-ink-800 px-3 py-2 space-y-1">
        <p className="text-bone-100 font-semibold">{e.title}</p>
        <p className="font-ui text-xs text-bone-400">
          {dateTime(e.eventDateTime)}
          {e.location && ` · ${e.location}`}
          {` · by ${name(e.createdBy)}`}
        </p>
        {e.notes && <p className="text-bone-300 text-sm whitespace-pre-wrap">{e.notes}</p>}
        {group('going', s.rsvpGoing)}
        {group('maybe', s.rsvpMaybe)}
        {group('cant', s.rsvpCant)}
      </div>
    );
  };

  return (
    <Section title={s.events} count={content.events.length}>
      {content.events.length === 0 ? (
        <Empty>{s.noEvents}</Empty>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <p className="font-ui text-xs uppercase tracking-wide text-bone-400">{s.upcoming}</p>
              {upcoming.map(renderEvent)}
            </>
          )}
          {past.length > 0 && (
            <>
              <p className="font-ui text-xs uppercase tracking-wide text-bone-400 pt-2">{s.past}</p>
              {past.map(renderEvent)}
            </>
          )}
        </>
      )}
    </Section>
  );
}

function Log({ content }: { content: AdminCampaignContent }) {
  return (
    <Section title={s.log} count={content.log.length}>
      {content.log.length === 0 ? (
        <Empty>{s.noLog}</Empty>
      ) : (
        content.log.map((entry) => (
          <div key={entry.id} className="rounded-md border border-ink-800 px-3 py-2 space-y-1">
            <p className="text-bone-100 font-semibold">{entry.title}</p>
            <p className="font-ui text-xs text-bone-400">
              {entry.authorDisplayName || 'Unnamed'} · {day(entry.createdAt)}
            </p>
            {entry.body && <p className="text-bone-300 text-sm whitespace-pre-wrap">{entry.body}</p>}
          </div>
        ))
      )}
    </Section>
  );
}

function Territories({ content }: { content: AdminCampaignContent }) {
  const holder = (id: string | null) => (id ? content.warbands.find((w) => w.id === id)?.name : null);
  return (
    <Section title={s.territories} count={content.territories.length}>
      {content.territories.length === 0 ? (
        <Empty>{s.noTerritories}</Empty>
      ) : (
        content.territories.map((t) => (
          <div key={t.id} className="border-b border-ink-800 last:border-b-0 pb-2 last:pb-0">
            <p className="text-bone-100">
              {t.name}
              {t.kind && <span className="font-ui text-xs text-bone-400"> · {t.kind}</span>}
            </p>
            <p className="font-ui text-xs text-bone-400">{holder(t.controlledByWarbandId) ?? s.unclaimed}</p>
            {t.notes && <p className="text-bone-300 text-sm">{t.notes}</p>}
          </div>
        ))
      )}
    </Section>
  );
}

function Honours({ content }: { content: AdminCampaignContent }) {
  const warband = (id: string) => content.warbands.find((w) => w.id === id)?.name ?? 'a removed warband';
  return (
    <Section title={s.honours} count={content.awards.length}>
      {content.awards.length === 0 ? (
        <Empty>{s.noHonours}</Empty>
      ) : (
        content.awards.map((a) => (
          <div key={a.id} className="border-b border-ink-800 last:border-b-0 pb-2 last:pb-0">
            <p className="text-bone-100">
              {a.title}
              <span className="font-ui text-xs text-bone-400"> · {warband(a.warbandId)}</span>
            </p>
            <p className="font-ui text-xs text-bone-400">
              {a.kind === 'computed' ? 'frozen at conclusion' : 'granted by a leader'} · {day(a.createdAt)}
            </p>
            {a.note && <p className="text-bone-300 text-sm">{a.note}</p>}
          </div>
        ))
      )}
    </Section>
  );
}

/**
 * §4.9.5 + §4.9.8 — one campaign, reached as operator rather than member.
 *
 * The header and member list come from `admin_campaign_detail` (metadata). The
 * rest is the campaign's full content, read-only, from `admin_campaign_content`
 * (migration 0057), which logs every open. Shows what a member sees — never
 * more: no BTB objectives, no join code, no write controls.
 */
export default function AdminCampaignDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { data, isError, error } = useAdminCampaignDetailQuery(id);
  const content = useAdminCampaignContentQuery(id);

  const back = (
    <Link to="/admin/campaigns" className="inline-flex items-center min-h-[40px] text-ember-400 text-sm font-semibold">
      ← All campaigns
    </Link>
  );

  if (isError) {
    return (
      <div className="space-y-2">
        {back}
        <p className="text-danger text-sm">{(error as Error).message}</p>
      </div>
    );
  }
  if (!data) return <p className="text-bone-400 text-sm">{strings.common.loading}</p>;

  const c = data.campaign;

  return (
    <section className="space-y-4">
      {back}

      {/* Pinned, so this can never be mistaken for the member's own screen. */}
      <div className="sticky top-0 z-10 rounded-md border border-ember-500/60 bg-ink-900 px-3 py-2 font-ui text-xs font-semibold uppercase tracking-wide text-ember-400">
        {s.banner}
      </div>

      <div>
        <h2 className="text-bone-100 font-semibold text-lg">{c.name}</h2>
        <p className="font-ui text-xs text-bone-400">
          {c.visibility} · created by{' '}
          <Link to={`/admin/players/${c.creator_id}`} className="hover:text-ember-400">
            {c.creator_name || 'Unknown'}
          </Link>{' '}
          · {new Date(c.created_at).toLocaleDateString()} · active {ago(c.last_activity)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Members" value={c.member_count} />
        <Stat label="Leaders" value={c.leader_count} />
        <Stat label="Battles" value={c.battle_count} />
        <Stat label="Warbands" value={c.warband_count} />
        <Stat label="Events" value={c.event_count} />
      </div>

      <div className="space-y-2">
        <p className="font-ui text-xs uppercase tracking-wide text-bone-400">Members</p>
        <div className="rounded-lg border border-ink-800 bg-ink-900 divide-y divide-ink-800">
          {data.members.map((m) => (
            <Link
              key={m.user_id}
              to={`/admin/players/${m.user_id}`}
              className="flex items-center gap-2 px-3 py-2 min-h-[44px] text-sm hover:bg-ink-800"
            >
              <span className="min-w-0 flex-1">
                <span className="text-bone-100">{m.display_name || 'Unnamed'}</span>
                {m.role === 'campaign_leader' && (
                  <span className="ml-2 rounded border border-ember-500 px-1.5 py-0.5 font-ui text-xs uppercase tracking-wide text-ember-400">
                    leader
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right text-bone-300">
                {m.warband_name ? (
                  <>
                    {m.warband_name}
                    {m.warband_type && (
                      <span className="block font-ui text-xs text-bone-400">{getWarbandTypeName(m.warband_type)}</span>
                    )}
                  </>
                ) : (
                  <span className="font-ui text-xs text-bone-400">{s.noWarband}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {content.isError && (
        <div className="space-y-1">
          <p className="text-danger text-sm">{s.loadError}</p>
          <p className="font-ui text-xs text-bone-400">
            {(content.error as Error).message} — {s.migrationHint}
          </p>
        </div>
      )}

      {!content.data && !content.isError && <p className="text-bone-400 text-sm">{strings.common.loading}</p>}

      {content.data && (
        <div className="space-y-3">
          <Settings content={content.data} />
          <Standings content={content.data} />
          <Battles content={content.data} />
          <Events content={content.data} />
          <Log content={content.data} />
          <Territories content={content.data} />
          <Honours content={content.data} />
        </div>
      )}

      <p className="font-ui text-xs text-bone-400">{s.footer}</p>
    </section>
  );
}
