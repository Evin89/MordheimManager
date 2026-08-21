import { Link, useParams } from 'react-router-dom';
import { useAdminCampaignDetailQuery } from '../../hooks/useIssues';
import { getWarbandTypeName } from '../../data/warbandRegistry';
import { strings } from '../../strings';
import { Stat, ago } from './shared';

/**
 * §4.9.5 detail — one campaign's metadata, counts and member list, reached as
 * operator rather than member. Content-blind (§4.9.7): shows who and how many,
 * never the battle log, event bodies, objectives, or warband rating (which is
 * derived from roster content).
 */
export default function AdminCampaignDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { data, isError, error } = useAdminCampaignDetailQuery(id);

  const back = (
    <Link to="/admin/campaigns" className="inline-flex items-center min-h-[40px] text-ember-400 text-sm font-semibold">
      ← All campaigns
    </Link>
  );

  if (isError) {
    return (
      <div className="space-y-2">
        {back}
        <p className="text-blood-500 text-sm">{(error as Error).message}</p>
      </div>
    );
  }
  if (!data) return <p className="text-bone-400 text-sm">{strings.common.loading}</p>;

  const c = data.campaign;

  return (
    <section className="space-y-4">
      {back}

      <div>
        <h2 className="text-bone-100 font-semibold text-lg">{c.name}</h2>
        <p className="font-ui text-xs text-bone-400">
          {c.visibility} · created by {c.creator_name || 'Unknown'} ·{' '}
          {new Date(c.created_at).toLocaleDateString()} · active {ago(c.last_activity)}
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
        <div className="overflow-x-auto rounded-lg border border-ink-800 bg-ink-900">
          <table className="w-full text-sm">
            <tbody>
              {data.members.map((m) => (
                <tr key={m.user_id} className="border-b border-ink-800 last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="text-bone-100">{m.display_name || 'Unnamed'}</span>
                    {m.role === 'campaign_leader' && (
                      <span className="ml-2 rounded border border-ember-500 px-1.5 py-0.5 font-ui text-[11px] uppercase tracking-wide text-ember-400">
                        leader
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-bone-300">
                    {m.warband_name ? (
                      <>
                        {m.warband_name}
                        {m.warband_type && (
                          <span className="block font-ui text-xs text-bone-400">
                            {getWarbandTypeName(m.warband_type)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="font-ui text-xs text-bone-400">no warband entered</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
