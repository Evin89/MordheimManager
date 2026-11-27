import { TrackerRules } from '../BattleTrackerPanel';
import { strings } from '../../strings';

export default function EmptyStep({ reason, rule }: { reason: string; rule: string }) {
  return (
    <div>
      <p className="text-bone-300 text-sm">{reason}</p>
      <TrackerRules ids={[rule]} label={strings.postBattle.rulesForStep} />
    </div>
  );
}
