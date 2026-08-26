import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Field, SectionHeading, Select, TextField, Textarea } from './ui';
import { strings } from '../strings';
import { useCampaignWarbandsQuery } from '../hooks/useCampaign';
import {
  useCampaignAwardsQuery,
  useCreateCampaignAwardMutation,
  useDeleteCampaignAwardMutation,
} from '../hooks/useCampaignAwards';
import { CampaignWarbandRow } from '../api/warbands';
import { Campaign } from '../types';

/**
 * §17.4 (manual) — the honours a leader has granted by hand, beside the computed
 * award badges (`CampaignAwards`) on the Standings tab. Every member sees the
 * list; only the leader gets the grant form and the remove control — the 0027
 * policy enforces that server-side, this only hides the affordance.
 */
export default function CampaignHonours({
  campaign,
  isLeader,
}: {
  campaign: Campaign;
  isLeader: boolean;
}) {
  const { data: awards } = useCampaignAwardsQuery(campaign.id);
  const { data: warbands } = useCampaignWarbandsQuery(campaign.id);
  const createAward = useCreateCampaignAwardMutation(campaign.id);
  const removeAward = useDeleteCampaignAwardMutation(campaign.id);
  const s = strings.campaign.honours;

  const [adding, setAdding] = useState(false);
  const [warbandId, setWarbandId] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const warbandName = (id: string) =>
    (warbands ?? []).find((w: CampaignWarbandRow) => w.id === id)?.name ?? s.unknownWarband;

  const canGrant = warbandId !== '' && title.trim().length > 0;

  function grant() {
    if (!canGrant) return;
    createAward({ warbandId, title, note }, () => {
      setWarbandId('');
      setTitle('');
      setNote('');
      setAdding(false);
    });
  }

  return (
    <div className="space-y-3">
      <SectionHeading>{s.section}</SectionHeading>
      <p className="text-bone-300 text-xs">{s.hint}</p>

      {isLeader &&
        (!adding ? (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            {s.add}
          </Button>
        ) : (
          <Card gap="sm">
            <Field label={s.warbandLabel}>
              <Select value={warbandId} onChange={(e) => setWarbandId(e.target.value)}>
                <option value="">{s.choosePlaceholder}</option>
                {(warbands ?? []).map((w: CampaignWarbandRow) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.playerName ? ` — ${w.playerName}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={s.titleLabel}>
              <TextField
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={s.titlePlaceholder}
              />
            </Field>
            <Field label={s.noteLabel}>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={s.notePlaceholder}
                rows={2}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                size="dense"
                fullWidth={false}
                disabled={!canGrant}
                onClick={grant}
                className="flex-1"
              >
                {s.grant}
              </Button>
              <Button
                size="dense"
                variant="secondary"
                fullWidth={false}
                onClick={() => setAdding(false)}
                className="flex-1"
              >
                {s.cancel}
              </Button>
            </div>
          </Card>
        ))}

      {(awards?.length ?? 0) === 0 ? (
        <p className="text-bone-300 text-sm">{s.empty}</p>
      ) : (
        <div className="space-y-2">
          {(awards ?? []).map((award) => (
            <Card key={award.id} gap="sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ember-400 font-semibold">{award.title}</p>
                  <Link to={`/rosters/${award.warbandId}`} className="text-bone-100 text-sm">
                    {warbandName(award.warbandId)}
                  </Link>
                </div>
                {isLeader && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(s.removeConfirm(award.title))) removeAward(award.id);
                    }}
                    className="shrink-0 text-blood-500 text-xs font-semibold"
                  >
                    {s.remove}
                  </button>
                )}
              </div>
              {award.note && (
                <p className="text-bone-300 text-sm whitespace-pre-wrap">{award.note}</p>
              )}
              {award.createdAt && (
                <p className="text-bone-400 text-xs">
                  {s.granted(new Date(award.createdAt).toLocaleDateString())}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
