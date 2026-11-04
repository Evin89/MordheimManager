import { Card, Field, Textarea, Select } from '../../components/ui';
import { strings } from '../../strings';
import { useObjectiveQuery, useSaveObjectiveMutation } from '../../hooks/useObjective';
import objectivesData from '../../data/btb/objectives.json';
import { BtbObjectivesData } from '../../data/types';
import { BtbObjective, Warband } from '../../types';

const objectives = (objectivesData as BtbObjectivesData).objectives;

/** The editable part of an objective — the row's id/warbandId are set server-side. */
type ObjectiveFields = Omit<BtbObjective, 'id' | 'warbandId'>;

/** BTB objectives are secret by the rules, so they live in their own owner-only
 * table rather than inside the (shareable) warband blob — each card owns its
 * own query/mutation for the warband it belongs to. */
export function ObjectiveCard({ warband }: { warband: Warband }) {
  const { data: current } = useObjectiveQuery(warband.id);
  const saveObjective = useSaveObjectiveMutation(warband.id);
  const chosen = current ? objectives.find((o) => o.name === current.name) : undefined;

  function updateField(patch: Partial<ObjectiveFields>) {
    const base: ObjectiveFields = current
      ? { name: current.name, progress: current.progress, completed: current.completed }
      : { name: '', progress: '', completed: false };
    saveObjective({ ...base, ...patch });
  }

  return (
    <Card>
      <p className="text-bone-100 font-semibold">{warband.name}</p>

      <Field label={strings.campaign.objectiveLabel}>
        <Select
          value={current?.name ?? ''}
          onChange={(e) => {
            const name = e.target.value;
            if (!name) {
              saveObjective(undefined);
              return;
            }
            updateField({ name });
          }}
        >
          <option value="">{strings.campaign.noObjective}</option>
          {objectives.map((o) => (
            <option key={o.id} value={o.name}>
              {o.name}
            </option>
          ))}
        </Select>
      </Field>

      {chosen && <p className="text-bone-300 text-xs">{chosen.description}</p>}

      {current && (
        <>
          <Field label={strings.campaign.progressLabel}>
            <Textarea
              value={current.progress}
              onChange={(e) => updateField({ progress: e.target.value })}
              placeholder={strings.campaign.progressPlaceholder}
              rows={2}
            />
          </Field>
          <label className="flex items-center gap-2 min-h-[44px] text-bone-200 text-sm">
            <input
              type="checkbox"
              checked={current.completed}
              onChange={(e) => updateField({ completed: e.target.checked })}
              className="h-5 w-5 shrink-0"
            />
            {strings.campaign.completedLabel}
          </label>
        </>
      )}
    </Card>
  );
}
