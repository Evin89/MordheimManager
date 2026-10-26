import { useState } from 'react';
import { HiredSword, EquipmentItem } from '../types';
import { strings } from '../strings';
import {
  buildStartingEquipment,
  describeGear,
  findHiredSwordDefinition,
  getStartingEquipment,
  lacksStartingEquipment,
} from '../lib/hiredSwordEquipment';
import { Button, Select } from './ui';

/**
 * Stands in for the shop on a Hired Sword's equipment section.
 *
 * He carries exactly what his entry lists, so there is nothing to buy. Models
 * hired before starting equipment existed got only the free dagger; for those
 * this offers to put on the entry's gear — with the entry's choice, if it has
 * one, since that was never asked at the time.
 */
export default function HiredSwordStartingGear({
  sword,
  onApply,
}: {
  sword: HiredSword;
  onApply: (equipment: EquipmentItem[]) => void;
}) {
  const [choiceIndex, setChoiceIndex] = useState(0);
  const definition = findHiredSwordDefinition(sword);
  const choice = definition ? getStartingEquipment(definition.id)?.choice : undefined;
  const needsGear = lacksStartingEquipment(sword);

  return (
    <div className="space-y-2">
      <p className="text-bone-400 text-xs">{strings.modelDetail.hiredSwordFixedGear}</p>
      {needsGear && definition && (
        <div className="space-y-2 rounded-lg border border-ink-800 p-3">
          <p className="text-bone-300 text-sm">{strings.modelDetail.hiredSwordMissingGear(definition.equipment)}</p>
          {choice && choice.length > 1 && (
            <Select
              aria-label={strings.addHiredSword.gearChoiceLabel}
              value={String(choiceIndex)}
              onChange={(e) => setChoiceIndex(Number(e.target.value))}
            >
              {choice.map((option, i) => (
                <option key={option.label} value={i}>
                  {option.label} ({describeGear(option.items)})
                </option>
              ))}
            </Select>
          )}
          <Button onClick={() => onApply(buildStartingEquipment(definition.id, choiceIndex))}>
            {strings.modelDetail.hiredSwordApplyGear}
          </Button>
        </div>
      )}
    </div>
  );
}
