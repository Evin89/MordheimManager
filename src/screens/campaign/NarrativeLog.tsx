import { useState } from 'react';
import ConfirmAction from '../../components/ConfirmAction';
import { Button, Card, SectionHeading, TextField, Textarea, Select } from '../../components/ui';
import { strings } from '../../strings';
import {
  useCampaignLogQuery,
  useCreateLogEntryMutation,
  useDeleteLogEntryMutation,
} from '../../hooks/useCampaignLog';
import { BattleRecord } from '../../types';

export function NarrativeLog({
  campaignId,
  battles,
  isLeader,
  userId,
}: {
  campaignId: string;
  battles: BattleRecord[];
  isLeader: boolean;
  userId: string | undefined;
}) {
  const { data: entries } = useCampaignLogQuery(campaignId);
  const create = useCreateLogEntryMutation(campaignId);
  const remove = useDeleteLogEntryMutation(campaignId);
  const [confirmingEntry, setConfirmingEntry] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [battleId, setBattleId] = useState('');

  // The last handful of battles are the ones you'd narrate; the full log would
  // make the picker a scroll of its own.
  const recentBattles = [...battles].slice(-10).reverse();
  const scenarioOf = (id: string | null) =>
    id ? (battles.find((b) => b.id === id)?.scenario ?? '') : '';
  const canAdd = title.trim().length > 0 && !create.isPending;

  function add() {
    if (!canAdd) return;
    create.mutate(
      { title, body, battleId: battleId || null },
      { onSuccess: () => { setTitle(''); setBody(''); setBattleId(''); } },
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeading>{strings.campaign.narrative.section}</SectionHeading>
      <p className="text-bone-300 text-xs">{strings.campaign.narrative.hint}</p>

      <Card gap="sm">
        <TextField
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={strings.campaign.narrative.titlePlaceholder}
          aria-label={strings.campaign.narrative.titlePlaceholder}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={strings.campaign.narrative.bodyPlaceholder}
          aria-label={strings.campaign.narrative.bodyPlaceholder}
          rows={3}
        />
        {recentBattles.length > 0 && (
          <Select
            value={battleId}
            onChange={(e) => setBattleId(e.target.value)}
            aria-label={strings.campaign.narrative.battleLabel}
          >
            <option value="">{strings.campaign.narrative.noBattleOption}</option>
            {recentBattles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.scenario} — {new Date(b.date).toLocaleDateString()}
              </option>
            ))}
          </Select>
        )}
        <Button size="dense" disabled={!canAdd} onClick={add}>
          {create.isPending ? strings.campaign.narrative.adding : strings.campaign.narrative.add}
        </Button>
      </Card>

      {(entries?.length ?? 0) === 0 ? (
        <p className="text-bone-300 text-sm">{strings.campaign.narrative.empty}</p>
      ) : (
        <div className="space-y-2">
          {(entries ?? []).map((e) => {
            const canRemove = isLeader || e.authorId === userId;
            const linked = scenarioOf(e.battleId);
            return (
              <Card key={e.id} gap="sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-bone-100 font-semibold">{e.title}</p>
                  {canRemove && (
                    <button
                      type="button"
                      aria-expanded={confirmingEntry === e.id}
                      onClick={() => setConfirmingEntry((id) => (id === e.id ? null : e.id))}
                      className="shrink-0 text-danger text-xs font-semibold"
                    >
                      {strings.campaign.narrative.remove}
                    </button>
                  )}
                </div>
                {confirmingEntry === e.id && (
                  <ConfirmAction
                    prompt={strings.campaign.narrative.removeConfirm}
                    action={strings.campaign.narrative.remove}
                    onConfirm={() => {
                      remove.mutate(e.id);
                      setConfirmingEntry(null);
                    }}
                    onCancel={() => setConfirmingEntry(null)}
                  />
                )}
                <p className="text-bone-400 text-xs">
                  {strings.campaign.narrative.by(e.authorDisplayName, new Date(e.createdAt).toLocaleDateString())}
                  {linked && ` · ${strings.campaign.narrative.linkedTo(linked)}`}
                </p>
                {e.body && <p className="text-bone-300 text-sm whitespace-pre-wrap pt-1">{e.body}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
