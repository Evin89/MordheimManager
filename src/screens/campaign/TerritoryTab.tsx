import { useState } from 'react';
import ConfirmByTyping from '../../components/ConfirmByTyping';
import { Button, Card, SectionHeading, Field, TextField, Textarea, Select } from '../../components/ui';
import { strings } from '../../strings';
import {
  useCampaignWarbandsQuery } from '../../hooks/useCampaign';
import {
  useTerritoriesQuery,
  useCreateTerritoryMutation,
  useSetTerritoryControllerMutation,
  useDeleteTerritoryMutation,
} from '../../hooks/useTerritories';
import { CampaignWarbandRow } from '../../api/warbands';

/**
 * §17.1 — the territories a campaign's warbands hold.
 *
 * Any member can add a territory, claim it for any warband in the campaign, or
 * reassign it after a battle — the 0020 policy allows the whole table to
 * members, so the map is a shared board rather than a leader's ledger. Removing
 * one is type-to-confirm, the same guard the rest of the app uses for deletes.
 */
export function TerritoryTab({ campaignId }: { campaignId: string }) {
  const { data: territories } = useTerritoriesQuery(campaignId);
  const { data: warbands } = useCampaignWarbandsQuery(campaignId);
  const createTerritory = useCreateTerritoryMutation(campaignId);
  const setController = useSetTerritoryControllerMutation(campaignId);
  const removeTerritory = useDeleteTerritoryMutation(campaignId);
  const s = strings.campaign.territory;

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const warbandName = (id: string | null) =>
    id ? (warbands ?? []).find((w: CampaignWarbandRow) => w.id === id)?.name ?? strings.campaign.unknownWarband : null;

  function add() {
    if (name.trim().length === 0) return;
    createTerritory({ name, kind, notes }, () => {
      setName('');
      setKind('');
      setNotes('');
      setAdding(false);
    });
  }

  return (
    <section className="space-y-3">
      <SectionHeading>{s.section}</SectionHeading>
      <p className="text-bone-300 text-xs">{s.hint}</p>

      {!adding ? (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          {s.addButton}
        </Button>
      ) : (
        <Card gap="sm">
          <TextField
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={s.namePlaceholder}
          />
          <TextField
            type="text"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            placeholder={s.kindPlaceholder}
          />
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={s.notesLabel}
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="dense" fullWidth={false} disabled={name.trim().length === 0} onClick={add} className="flex-1">
              {s.add}
            </Button>
            <Button size="dense" variant="secondary" fullWidth={false} onClick={() => setAdding(false)} className="flex-1">
              {s.cancel}
            </Button>
          </div>
        </Card>
      )}

      {(territories?.length ?? 0) === 0 ? (
        <p className="text-bone-300 text-sm">{s.empty}</p>
      ) : (
        <div className="space-y-2">
          {(territories ?? []).map((t) => (
            <Card key={t.id} gap="sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-bone-100 font-semibold">{t.name}</p>
                  {t.kind && <p className="text-bone-400 text-xs">{t.kind}</p>}
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    t.controlledByWarbandId ? 'text-ember-400' : 'text-bone-400'
                  }`}
                >
                  {t.controlledByWarbandId ? s.controlledBy(warbandName(t.controlledByWarbandId)!) : s.unclaimed}
                </span>
              </div>
              {t.notes && <p className="text-bone-300 text-sm whitespace-pre-wrap">{t.notes}</p>}

              <Field label={s.claimLabel}>
                <Select
                  value={t.controlledByWarbandId ?? ''}
                  onChange={(e) => setController(t.id, e.target.value || null)}
                >
                  <option value="">{s.unclaimed}</option>
                  {(warbands ?? []).map((w: CampaignWarbandRow) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.playerName ? ` — ${w.playerName}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              {confirmingId === t.id ? (
                <div className="space-y-2">
                  <ConfirmByTyping
                    phrase={t.name}
                    label={s.removeTypeLabel(t.name)}
                    action={s.remove}
                    onConfirm={() => {
                      removeTerritory(t.id);
                      setConfirmingId(null);
                    }}
                    impact={<p>{s.removeImpact}</p>}
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="w-full min-h-[40px] rounded-md text-bone-300 text-sm"
                  >
                    {s.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(t.id)}
                  className="text-danger text-xs font-semibold"
                >
                  {s.remove}
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
