import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminCampaignsQuery } from '../../hooks/useIssues';
import { isStranded } from '../../api/adminCampaigns';
import { TextField } from '../../components/ui';
import { strings } from '../../strings';
import { ago } from './shared';

/**
 * §4.9.5 — the per-campaign admin view, the symmetric mirror of Players. Reads
 * the content-blind RPC (migration 0026) so an admin can inspect a private
 * campaign they aren't in — metadata and counts only. The stranded filter
 * surfaces §10.3.1's one-leader, no-activity campaigns; it only shows them.
 */
export default function AdminCampaignsScreen() {
  const [search, setSearch] = useState('');
  const [strandedOnly, setStrandedOnly] = useState(false);
  const { data: rows, isError, error } = useAdminCampaignsQuery(search);

  if (isError) {
    return (
      <div className="space-y-1">
        <p className="text-blood-500 text-sm">Could not load campaigns.</p>
        <p className="font-ui text-xs text-bone-400">
          {(error as Error).message} — if this mentions <code>admin_campaign_overview</code>, migration 0026
          has not been applied yet.
        </p>
      </div>
    );
  }

  const shown = (rows ?? []).filter((r) => !strandedOnly || isStranded(r));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-bone-100 font-semibold">Campaigns</h2>
        <button
          type="button"
          onClick={() => setStrandedOnly((v) => !v)}
          aria-pressed={strandedOnly}
          className={`min-h-[36px] px-3 rounded-md border text-xs font-semibold ${
            strandedOnly ? 'bg-ember-500 text-on-accent border-ember-500' : 'border-ink-700 text-bone-300'
          }`}
        >
          Stranded only
        </button>
      </div>

      <TextField
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name…"
      />

      {!rows ? (
        <p className="text-bone-400 text-sm">{strings.common.loading}</p>
      ) : shown.length === 0 ? (
        <p className="text-bone-400 text-sm">No campaigns{strandedOnly ? ' are stranded' : ''}.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((c) => {
            const stranded = isStranded(c);
            return (
              <Link
                key={c.id}
                to={`/admin/campaigns/${c.id}`}
                className="block rounded-lg bg-ink-900 border border-ink-800 p-3 hover:border-ink-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-bone-100 font-semibold truncate">
                      {c.name}
                      {c.visibility === 'private' && (
                        <span className="ml-2 font-ui text-[11px] uppercase tracking-wide text-bone-400">private</span>
                      )}
                      {stranded && (
                        <span className="ml-2 rounded border border-blood-600 px-1.5 py-0.5 font-ui text-[11px] uppercase tracking-wide text-blood-500">
                          stranded
                        </span>
                      )}
                    </p>
                    <p className="font-ui text-xs text-bone-400 truncate">
                      {c.creator_name || 'Unknown'} · active {ago(c.last_activity)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-ui text-xs text-bone-400 tabular-nums">
                    <p className="text-bone-200">{c.member_count} members</p>
                    <p>{c.battle_count} battles · {c.warband_count} warbands</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
