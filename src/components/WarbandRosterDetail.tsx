import { HeroSlotDefinition, HenchmenTypeDefinition, WarbandDefinition, NullableStatLine } from '../data/types';
import { STAT_KEYS } from '../lib/statLine';
import { resolveEquipmentItem } from '../lib/equipmentLookup';
import { groupByCategory, EQUIPMENT_CATEGORY_SHORT_LABELS } from '../lib/equipmentCategories';

/**
 * A warband's roster as the rulebook prints it: every Hero and Henchman with its
 * cost, recruitment limit and full profile, then the warband's equipment lists
 * grouped by the book's own headings. Read-only — the editable statline lives in
 * ProfileBlock on the roster screens; this is the reference, so it shows a plain
 * table that also tolerates the profiles left blank in the data ("–").
 */

/** "mercenaryEquipmentList" → "Mercenary equipment list". */
function humanizeList(key: string): string {
  const words = key
    .replace(/EquipmentList$|List$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} equipment list`;
}

/** The rulebook's profile row, blank-tolerant. Matches §5.3's ink-framed table. */
function ProfileTable({ stats }: { stats: NullableStatLine }) {
  return (
    <div className="overflow-x-auto border-2 border-ink bg-parchment-raised ring-1 ring-inset ring-ink/35">
      <table className="w-full border-collapse tabular-nums lining-nums">
        <thead>
          <tr>
            {STAT_KEYS.map((key) => (
              <th
                key={key}
                scope="col"
                className="font-heading-sc text-ink border-b-2 border-ink font-normal uppercase tracking-[0.05em] text-stat-min px-1.5 py-1 sm:px-3 sm:py-1.5"
              >
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {STAT_KEYS.map((key) => (
              <td
                key={key}
                className="font-body text-ink text-center text-stat-min px-1.5 py-1.5 sm:px-3 sm:py-2 sm:text-base"
              >
                {stats[key] ?? '–'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function recruitLimit(unit: HeroSlotDefinition | HenchmenTypeDefinition): string | null {
  if (unit.maxCount == null) return null; // henchmen with no cap
  return unit.maxCount === 1 ? '0–1' : `0–${unit.maxCount}`;
}

function UnitEntry({
  unit,
  isHero,
}: {
  unit: HeroSlotDefinition | HenchmenTypeDefinition;
  isHero: boolean;
}) {
  const isLeader = isHero && (unit as HeroSlotDefinition).isLeader;
  const limit = recruitLimit(unit);
  const equipment = unit.equipmentOptions.map(humanizeList);

  const meta = [
    unit.cost != null ? `${unit.cost} gc to hire` : null,
    limit,
    isLeader ? 'Leader' : null,
    isHero && (unit as HeroSlotDefinition).startingXp
      ? `${(unit as HeroSlotDefinition).startingXp} starting XP`
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-bone-100 font-semibold">{unit.unitType}</h4>
      </div>
      {meta.length > 0 && <p className="font-ui text-xs text-bone-400">{meta.join(' · ')}</p>}
      <ProfileTable stats={unit.statLine} />
      {equipment.length > 0 && (
        <p className="text-bone-300 text-sm">
          <span className="text-bone-200 font-semibold">Weapons &amp; armour: </span>
          {equipment.join(', ')}
        </p>
      )}
    </div>
  );
}

/** One equipment list, its items grouped under the book's headings with prices. */
function EquipmentList({ listKey, ids, definition }: { listKey: string; ids: string[]; definition: WarbandDefinition }) {
  const items = ids
    .map((id) => resolveEquipmentItem(id, definition))
    .filter((i): i is NonNullable<typeof i> => !!i);
  const groups = groupByCategory(items);
  if (groups.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-bone-100 font-semibold">{humanizeList(listKey)}</h4>
      {groups.map((group) => (
        <div key={group.category} className="text-sm">
          <span className="font-ui text-xs uppercase tracking-wide text-bone-400">
            {EQUIPMENT_CATEGORY_SHORT_LABELS[group.category]}
          </span>
          <ul className="mt-0.5 space-y-0.5">
            {group.items.map((item) => (
              <li key={item.id} className="text-bone-200 flex justify-between gap-3">
                <span>
                  {item.name}
                  {item.rarity != null && (
                    <span className="text-bone-400 font-ui text-xs"> · Rare {item.rarity}</span>
                  )}
                </span>
                <span className="text-bone-400 tabular-nums whitespace-nowrap">{item.priceRange ?? '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function WarbandRosterDetail({ definition }: { definition: WarbandDefinition }) {
  return (
    <div className="space-y-6">
      {definition.heroSlots.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-bone-100 font-semibold text-lg">Heroes</h3>
          {definition.heroSlots.map((slot) => (
            <UnitEntry key={slot.id} unit={slot} isHero />
          ))}
        </section>
      )}

      {definition.henchmenTypes.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-bone-100 font-semibold text-lg">Henchmen</h3>
          {definition.henchmenTypes.map((type) => (
            <UnitEntry key={type.id} unit={type} isHero={false} />
          ))}
        </section>
      )}

      {Object.keys(definition.equipmentLists).length > 0 && (
        <section className="space-y-4">
          <h3 className="text-bone-100 font-semibold text-lg">Equipment lists</h3>
          {Object.entries(definition.equipmentLists).map(([listKey, ids]) => (
            <EquipmentList key={listKey} listKey={listKey} ids={ids} definition={definition} />
          ))}
        </section>
      )}
    </div>
  );
}
