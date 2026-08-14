import { generateId } from './id';
import { EquipmentLogEntry } from '../types';

/**
 * Appends one entry to a model's equipment history (spec §18.2).
 *
 * A side effect of actions that already exist — buying, selling, a dead model's
 * gear going to the treasury — rather than a form anyone fills in. Fills forward:
 * a model with no `equipmentLog` yet (every model predating the feature) simply
 * starts one here, which is why the parameter is optional and the return is
 * always a fresh array.
 */
export function appendEquipmentLog(
  log: EquipmentLogEntry[] | undefined,
  action: EquipmentLogEntry['action'],
  itemName: string,
  context?: string,
): EquipmentLogEntry[] {
  return [
    ...(log ?? []),
    { id: generateId(), itemName, action, date: new Date().toISOString(), context },
  ];
}
