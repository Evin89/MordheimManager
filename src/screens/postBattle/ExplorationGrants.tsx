import { useEffect, useState } from 'react';
import NumberInput from '../../components/NumberInput';
import { strings } from '../../strings';
import { rollD6, rollDiceExpression } from '../../lib/dice';
import { GrantOffers, magicalArtefacts } from '../../lib/exploration';
import { resolveEquipmentItem } from '../../lib/equipmentLookup';
import { getWarbandDefinition } from '../../data/warbandRegistry';
import { ExplorationGrant } from '../../data/types';
import { Warband } from '../../types';
import { AppliedGrant } from './types';

/**
 * §15 — what an Exploration result puts on the roster, offered for the player to
 * confirm before the result is applied: items to the treasury, Experience,
 * skill-list access and skills, standing Hero benefits, free Zombies or a
 * wardog, a recruited prisoner, a magical artefact.
 *
 * Dice counts are rolled once when the panel appears (like the gold beside
 * them) and stay editable, so a player who rolled at the table can type their
 * own number. Nothing here writes to the roster: it reports the confirmed grants
 * upward, and the wizard applies them at commit with everything else.
 */

export type GrantSelection = {
  applied: AppliedGrant[];
  gold: number;
  shards: number;
  /** One line per grant for the battle notes and the confirm summary. */
  lines: string[];
  /** Grants that only apply if the result's own gold roll was a 1 (the Shop). */
  onGoldRolledOne: AppliedGrant[];
};

const roll = (expr: string | undefined): number =>
  !expr ? 1 : /^\d+$/.test(expr) ? Number(expr) : rollDiceExpression(expr).total;

/** Every grant the offers could produce, keyed by where it sits, so each gets one stable roll. */
function allKeyed(offers: GrantOffers): [string, ExplorationGrant][] {
  const out: [string, ExplorationGrant][] = [];
  offers.grants.forEach((g, i) => out.push([`b${i}`, g]));
  offers.choices?.forEach((c, ci) => c.grants.forEach((g, i) => out.push([`c${ci}.${i}`, g])));
  offers.checklist.forEach((c, ci) => c.grants.forEach((g, i) => out.push([`k${ci}.${i}`, g])));
  return out;
}

function initialAmount(g: ExplorationGrant): number {
  switch (g.type) {
    case 'item':
      return roll(g.count);
    case 'gold':
    case 'shards':
    case 'xp':
      return roll(g.amount);
    case 'henchmen':
      return roll(g.count);
    default:
      return 0;
  }
}

export default function ExplorationGrants({
  warband,
  offers,
  onChange,
}: {
  /** The warband as it will stand after this battle's deaths — the Heroes who can receive. */
  warband: Warband;
  offers: GrantOffers;
  onChange: (selection: GrantSelection) => void;
}) {
  const t = strings.postBattle.income.exploration.grants;
  const definition = getWarbandDefinition(warband.warbandType);
  const heroes = warband.heroes;
  const leader = heroes.find((h) => h.isLeader) ?? heroes[0];
  const artefacts = magicalArtefacts();
  const recruitGroups = warband.henchmenGroups.filter((g) => !g.isAnimal && !g.isLargeCreature);

  const unitFor = (unit: 'zombie' | 'dog') =>
    definition?.henchmenTypes.find((h) => (unit === 'zombie' ? /zombie/i : /hound|dog/i).test(h.unitType));

  // One roll per potential grant, taken when the panel mounts.
  const [amount, setAmount] = useState<Record<string, number>>(() =>
    Object.fromEntries(allKeyed(offers).map(([k, g]) => [k, initialAmount(g)])),
  );
  const [include, setInclude] = useState<Record<string, boolean>>({});
  const [hero, setHero] = useState<Record<string, string>>({});
  const [xpAlloc, setXpAlloc] = useState<Record<string, Record<string, number>>>({});
  const [group, setGroup] = useState<Record<string, string>>({});
  const [artefact, setArtefact] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      allKeyed(offers)
        .filter(([, g]) => g.type === 'artefact')
        .map(([k]) => [k, artefacts.find((a) => Number(a.roll) === rollD6())?.name ?? artefacts[0]?.name ?? '']),
    ),
  );
  const [merchant] = useState<Record<string, [number, number]>>(() =>
    Object.fromEntries(
      allKeyed(offers)
        .filter(([, g]) => g.type === 'merchantRoll')
        .map(([k]) => [k, [rollD6(), rollD6()] as [number, number]]),
    ),
  );
  const [choice, setChoice] = useState(0);
  const [found, setFound] = useState<Record<number, boolean>>({});

  const heroFor = (k: string) => hero[k] ?? leader?.id ?? '';
  const heroName = (id: string) => heroes.find((h) => h.id === id)?.name ?? '';

  // The grants currently in play: the base ones, the picked choice, and every
  // checklist entry that was found (Auto entries are always found).
  const active: [string, ExplorationGrant][] = [
    ...offers.grants.map((g, i) => [`b${i}`, g] as [string, ExplorationGrant]),
    ...(offers.choices?.[choice]?.grants ?? []).map((g, i) => [`c${choice}.${i}`, g] as [string, ExplorationGrant]),
    ...offers.checklist.flatMap((c, ci) =>
      c.required === 'Auto' || found[ci] ? c.grants.map((g, i) => [`k${ci}.${i}`, g] as [string, ExplorationGrant]) : [],
    ),
  ];

  useEffect(() => {
    const selection: GrantSelection = { applied: [], gold: 0, shards: 0, lines: [], onGoldRolledOne: [] };
    for (const [k, g] of active) {
      if (include[k] === false) continue;
      const n = amount[k] ?? 0;
      switch (g.type) {
        case 'item': {
          const item = resolveEquipmentItem(g.equipmentId, definition);
          const name = g.name ?? item?.name ?? g.equipmentId;
          const applied: AppliedGrant = { type: 'item', equipmentId: g.equipmentId, name, count: n, notes: g.notes };
          if (n <= 0) break;
          if (g.when === 'goldRolledOne') selection.onGoldRolledOne.push(applied);
          else {
            selection.applied.push(applied);
            selection.lines.push(t.itemLine(n, name));
          }
          break;
        }
        case 'gold':
          selection.gold += n;
          break;
        case 'shards':
          selection.shards += n;
          break;
        case 'xp':
          if (g.to === 'leader' && leader) {
            selection.applied.push({ type: 'xp', heroId: leader.id, amount: n });
            selection.lines.push(t.xpLine(heroName(leader.id), n));
          } else {
            for (const [heroId, xp] of Object.entries(xpAlloc[k] ?? {})) {
              if (xp > 0) {
                selection.applied.push({ type: 'xp', heroId, amount: xp });
                selection.lines.push(t.xpLine(heroName(heroId), xp));
              }
            }
          }
          break;
        case 'skillList':
          if (heroFor(k)) {
            selection.applied.push({ type: 'skillList', heroId: heroFor(k), list: g.list });
            selection.lines.push(t.skillListLine(heroName(heroFor(k)), g.list));
          }
          break;
        case 'skill':
          if (heroFor(k)) {
            selection.applied.push({ type: 'skill', heroId: heroFor(k), skill: g.skill });
            selection.lines.push(t.skillLine(heroName(heroFor(k)), g.skill));
          }
          break;
        case 'heroNote':
          if (heroFor(k)) {
            selection.applied.push({ type: 'heroNote', heroId: heroFor(k), text: g.text });
            selection.lines.push(`${heroName(heroFor(k))}: ${g.text}`);
          }
          break;
        case 'henchmen': {
          const unit = unitFor(g.unit);
          const passed = !g.test || include[`${k}.test`] === true;
          if (unit && passed && n > 0) {
            selection.applied.push({ type: 'henchmen', unitType: unit.unitType, count: n });
            selection.lines.push(t.henchmenLine(n, unit.unitType));
          }
          break;
        }
        case 'recruit': {
          const groupId = group[k] ?? recruitGroups[0]?.id;
          const target = recruitGroups.find((gr) => gr.id === groupId);
          if (target) {
            selection.applied.push({ type: 'recruit', groupId: target.id });
            selection.lines.push(t.recruitLine(target.groupName));
          }
          break;
        }
        case 'artefact':
          if (artefact[k]) {
            selection.applied.push({ type: 'item', equipmentId: 'magicalArtefact', name: artefact[k], count: 1, notes: t.artefactNote });
            selection.lines.push(t.itemLine(1, artefact[k]));
          }
          break;
        case 'merchantRoll': {
          const [a, b] = merchant[k] ?? [1, 2];
          if (a === b) {
            if (heroFor(k)) {
              selection.applied.push({ type: 'skill', heroId: heroFor(k), skill: 'Haggle' });
              selection.lines.push(t.skillLine(heroName(heroFor(k)), 'Haggle'));
            }
          } else {
            selection.gold += (a + b) * 5;
          }
          break;
        }
      }
    }
    onChange(selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, include, hero, xpAlloc, group, artefact, choice, found]);

  if (active.length === 0 && !offers.choices && offers.checklist.length === 0) return null;

  const heroSelect = (k: string) => (
    <select
      value={heroFor(k)}
      onChange={(e) => setHero((h) => ({ ...h, [k]: e.target.value }))}
      aria-label={t.heroLabel}
      className="min-h-[40px] rounded-md bg-ink-800 border border-ink-700 px-2 text-bone-100 text-sm"
    >
      {heroes.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
        </option>
      ))}
    </select>
  );

  const includeBox = (k: string) => (
    <input
      type="checkbox"
      checked={include[k] !== false}
      onChange={(e) => setInclude((s) => ({ ...s, [k]: e.target.checked }))}
      aria-label={t.includeLabel}
      className="h-5 w-5 accent-ember-500"
    />
  );

  const count = (k: string) => (
    <div className="w-24">
      <NumberInput value={amount[k] ?? 0} min={0} onChange={(v) => setAmount((s) => ({ ...s, [k]: v }))} />
    </div>
  );

  function row(k: string, g: ExplorationGrant) {
    switch (g.type) {
      case 'item': {
        const name = g.name ?? resolveEquipmentItem(g.equipmentId, definition)?.name ?? g.equipmentId;
        if (g.when === 'goldRolledOne') {
          return <p className="text-bone-300 text-xs">{t.luckyCharm(name)}</p>;
        }
        return (
          <div className="flex items-center gap-2">
            {includeBox(k)}
            {count(k)}
            <span className="text-bone-100 text-sm">× {name}</span>
          </div>
        );
      }
      case 'gold':
        return (
          <div className="flex items-center gap-2">
            {count(k)}
            <span className="text-bone-100 text-sm">gc ({g.amount})</span>
          </div>
        );
      case 'shards':
        return (
          <div className="flex items-center gap-2">
            {count(k)}
            <span className="text-bone-100 text-sm">{t.shardsLabel(g.amount)}</span>
          </div>
        );
      case 'xp':
        if (g.to === 'leader') {
          return (
            <div className="flex items-center gap-2">
              {includeBox(k)}
              <span className="text-bone-100 text-sm">{t.xpLine(leader?.name ?? '', amount[k] ?? 0)}</span>
            </div>
          );
        }
        {
          const total = amount[k] ?? 0;
          const alloc = xpAlloc[k] ?? {};
          const used = Object.values(alloc).reduce((s, n) => s + n, 0);
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {count(k)}
                <span className="text-bone-100 text-sm">{t.xpSpread(g.amount, total - used)}</span>
              </div>
              {heroes.map((h) => (
                <div key={h.id} className="flex items-center gap-2 pl-2">
                  <div className="w-24">
                    <NumberInput
                      value={alloc[h.id] ?? 0}
                      min={0}
                      max={(alloc[h.id] ?? 0) + Math.max(0, total - used)}
                      onChange={(v) => setXpAlloc((s) => ({ ...s, [k]: { ...(s[k] ?? {}), [h.id]: v } }))}
                    />
                  </div>
                  <span className="text-bone-200 text-sm">{h.name}</span>
                </div>
              ))}
            </div>
          );
        }
      case 'skillList':
        return (
          <div className="flex flex-wrap items-center gap-2">
            {includeBox(k)}
            <span className="text-bone-100 text-sm">{t.skillListOffer(g.list)}</span>
            {heroSelect(k)}
          </div>
        );
      case 'skill':
        return (
          <div className="flex flex-wrap items-center gap-2">
            {includeBox(k)}
            <span className="text-bone-100 text-sm">{t.skillOffer(g.skill)}</span>
            {heroSelect(k)}
          </div>
        );
      case 'heroNote':
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {includeBox(k)}
              {heroSelect(k)}
            </div>
            <p className="text-bone-300 text-xs">{g.text}</p>
          </div>
        );
      case 'henchmen': {
        const unit = unitFor(g.unit);
        if (!unit) return <p className="text-bone-300 text-xs">{t.noUnit(g.unit)}</p>;
        return (
          <div className="space-y-1">
            {g.test && (
              <label className="flex items-center gap-2 text-bone-200 text-sm">
                <input
                  type="checkbox"
                  checked={include[`${k}.test`] === true}
                  onChange={(e) => setInclude((s) => ({ ...s, [`${k}.test`]: e.target.checked }))}
                  className="h-5 w-5 accent-ember-500"
                />
                {g.test}
              </label>
            )}
            <div className="flex items-center gap-2">
              {includeBox(k)}
              {count(k)}
              <span className="text-bone-100 text-sm">× {unit.unitType} {t.freeSuffix}</span>
            </div>
          </div>
        );
      }
      case 'recruit':
        if (recruitGroups.length === 0) return <p className="text-bone-300 text-xs">{t.noRecruitGroup}</p>;
        return (
          <div className="flex flex-wrap items-center gap-2">
            {includeBox(k)}
            <span className="text-bone-100 text-sm">{t.recruitOffer}</span>
            <select
              value={group[k] ?? recruitGroups[0].id}
              onChange={(e) => setGroup((s) => ({ ...s, [k]: e.target.value }))}
              aria-label={t.recruitOffer}
              className="min-h-[40px] rounded-md bg-ink-800 border border-ink-700 px-2 text-bone-100 text-sm"
            >
              {recruitGroups.map((gr) => (
                <option key={gr.id} value={gr.id}>
                  {gr.groupName}
                </option>
              ))}
            </select>
          </div>
        );
      case 'artefact':
        return (
          <div className="flex flex-wrap items-center gap-2">
            {includeBox(k)}
            <select
              value={artefact[k] ?? ''}
              onChange={(e) => setArtefact((s) => ({ ...s, [k]: e.target.value }))}
              aria-label={t.artefactLabel}
              className="min-h-[40px] rounded-md bg-ink-800 border border-ink-700 px-2 text-bone-100 text-sm"
            >
              {artefacts.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.roll}: {a.name}
                </option>
              ))}
            </select>
          </div>
        );
      case 'merchantRoll': {
        const [a, b] = merchant[k] ?? [1, 2];
        return a === b ? (
          <div className="space-y-1">
            <p className="text-bone-100 text-sm">{t.merchantDouble(a, b)}</p>
            <div className="flex items-center gap-2">
              {includeBox(k)}
              {heroSelect(k)}
            </div>
          </div>
        ) : (
          <p className="text-bone-100 text-sm">{t.merchantGold(a, b, (a + b) * 5)}</p>
        );
      }
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-ink-700 p-3">
      <p className="text-bone-300 text-xs uppercase tracking-wide">{t.heading}</p>

      {offers.grants.map((g, i) => (
        <div key={`b${i}`}>{row(`b${i}`, g)}</div>
      ))}

      {offers.choices && (
        <div className="space-y-2">
          {offers.choices.map((c, ci) => (
            <label key={c.label} className="flex items-center gap-2 text-bone-100 text-sm">
              <input
                type="radio"
                name="exploration-choice"
                checked={choice === ci}
                onChange={() => setChoice(ci)}
                className="h-5 w-5 accent-ember-500"
              />
              {c.label}
            </label>
          ))}
          {(offers.choices[choice]?.grants ?? []).map((g, i) => (
            <div key={`c${choice}.${i}`} className="pl-7">
              {row(`c${choice}.${i}`, g)}
            </div>
          ))}
        </div>
      )}

      {offers.checklist.length > 0 && (
        <div className="space-y-2">
          <p className="text-bone-300 text-xs">{t.checklistHint}</p>
          {offers.checklist.map((c, ci) => (
            <div key={c.item} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {c.required === 'Auto' ? (
                  <span className="text-bone-400 text-xs uppercase tracking-wide">{t.auto}</span>
                ) : (
                  <>
                    <input
                      type="checkbox"
                      checked={!!found[ci]}
                      onChange={(e) => setFound((s) => ({ ...s, [ci]: e.target.checked }))}
                      aria-label={t.foundLabel(c.item)}
                      className="h-5 w-5 accent-ember-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const need = Number(c.required.replace('+', ''));
                        setFound((s) => ({ ...s, [ci]: rollD6() >= need }));
                      }}
                      className="min-h-[36px] px-2 rounded-md border border-ink-700 text-bone-200 text-xs font-semibold"
                    >
                      {t.rollFor(c.required)}
                    </button>
                  </>
                )}
                <span className="text-bone-200 text-sm">{c.item}</span>
              </div>
              {(c.required === 'Auto' || found[ci]) &&
                c.grants.map((g, i) => (
                  <div key={`k${ci}.${i}`} className="pl-7">
                    {row(`k${ci}.${i}`, g)}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
