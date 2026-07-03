import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import InlineNumberField from '../components/InlineNumberField';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { generateId } from '../lib/id';
import { STAT_KEYS } from '../lib/statLine';
import { HenchmenGroup, StatLine } from '../types';

export default function HenchmenDetailScreen() {
  const { warbandId, groupId } = useParams<{ warbandId: string; groupId: string }>();
  const navigate = useNavigate();
  const warband = useAppStore((state) => state.warbands.find((w) => w.id === warbandId));
  const saveWarband = useAppStore((state) => state.saveWarband);

  if (!warband) return <Navigate to="/warbands" replace />;

  const group = warband.henchmenGroups.find((g) => g.id === groupId);
  if (!group) return <Navigate to={`/warbands/${warband.id}`} replace />;

  function updateGroup(patch: Partial<HenchmenGroup>) {
    if (!warband || !group) return;
    const updated = warband.henchmenGroups.map((g) => (g.id === group.id ? { ...g, ...patch } : g));
    saveWarband({ ...warband, henchmenGroups: updated });
  }

  function updateStat(key: keyof StatLine, value: number) {
    if (!group) return;
    updateGroup({ stats: { ...group.stats, [key]: Math.max(0, value) } });
  }

  function applyStatAdvance(key: keyof StatLine) {
    if (!group) return;
    updateGroup({
      stats: { ...group.stats, [key]: group.stats[key] + 1 },
      advances: [...group.advances, { id: generateId(), type: 'stat', detail: `+1 ${key}` }],
    });
  }

  function moveToTreasury(itemId: string) {
    if (!warband || !group) return;
    const item = group.equipment.find((e) => e.id === itemId);
    if (!item) return;
    const updated = warband.henchmenGroups.map((g) =>
      g.id === group.id ? { ...g, equipment: g.equipment.filter((e) => e.id !== itemId) } : g,
    );
    saveWarband({ ...warband, henchmenGroups: updated, treasury: [...warband.treasury, item] });
  }

  function assignFromTreasury(itemId: string) {
    if (!warband || !group) return;
    const item = warband.treasury.find((e) => e.id === itemId);
    if (!item) return;
    const updated = warband.henchmenGroups.map((g) =>
      g.id === group.id ? { ...g, equipment: [...g.equipment, item] } : g,
    );
    saveWarband({ ...warband, henchmenGroups: updated, treasury: warband.treasury.filter((e) => e.id !== itemId) });
  }

  function handleDelete() {
    if (!warband || !group) return;
    if (window.confirm(strings.modelDetail.deleteModelConfirm(group.groupName))) {
      saveWarband({ ...warband, henchmenGroups: warband.henchmenGroups.filter((g) => g.id !== group.id) });
      navigate(`/warbands/${warband.id}`, { replace: true });
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={group.groupName} subtitle={`${group.count}x ${group.unitType}`} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="group-name">
            Group name
          </label>
          <input
            id="group-name"
            type="text"
            value={group.groupName}
            onChange={(e) => updateGroup({ groupName: e.target.value })}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          />
        </div>

        <InlineNumberField
          label={strings.addHenchmen.countLabel}
          value={group.count}
          min={0}
          onCommit={(count) => updateGroup({ count })}
        />

        <section className="space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.modelDetail.statsSection}</h2>
          <p className="text-bone-300 text-xs">
            {group.isAnimal ? 'Animal — does not gain Experience.' : 'Shared by the whole group.'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {STAT_KEYS.map((key) => (
              <div key={key} className="rounded-md border border-ink-700 bg-ink-900 p-2 text-center">
                <p className="text-bone-300 text-xs uppercase">{key}</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={group.stats[key]}
                  onChange={(e) => updateStat(key, Number(e.target.value))}
                  className="w-full bg-transparent text-center text-bone-100 text-lg font-semibold focus:outline-none"
                />
              </div>
            ))}
          </div>
        </section>

        {!group.isAnimal && (
          <section className="space-y-3">
            <h2 className="text-bone-100 font-semibold">{strings.modelDetail.xpSection}</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateGroup({ xp: Math.max(0, group.xp - 1) })}
                className="min-h-[48px] min-w-[48px] rounded-md border border-ink-700 text-bone-100 text-xl font-bold"
              >
                −
              </button>
              <p className="text-bone-100 text-2xl font-bold flex-1 text-center">{group.xp}</p>
              <button
                type="button"
                onClick={() => updateGroup({ xp: group.xp + 1 })}
                className="min-h-[48px] min-w-[48px] rounded-md border border-ink-700 text-bone-100 text-xl font-bold"
              >
                +
              </button>
            </div>
            <p className="text-bone-300 text-xs">
              Henchmen advances are always a +1 characteristic increase (never more than +1 per stat, per the
              rulebook) — tap a characteristic below when the group earns an advance.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {STAT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyStatAdvance(key)}
                  className="min-h-[44px] rounded-md border border-ink-700 text-bone-100 font-semibold"
                >
                  +1 {key}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.modelDetail.equipmentSection}</h2>
          {group.equipment.length === 0 && <p className="text-bone-300 text-sm">{strings.modelDetail.noEquipment}</p>}
          <div className="space-y-2">
            {group.equipment.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-ink-900 border border-ink-800 p-3">
                <p className="text-bone-100">{item.name}</p>
                <button
                  type="button"
                  onClick={() => moveToTreasury(item.id)}
                  className="text-ember-400 text-sm font-semibold shrink-0"
                >
                  {strings.modelDetail.moveToTreasury}
                </button>
              </div>
            ))}
          </div>

          <h3 className="text-bone-200 text-sm font-semibold pt-2">{strings.modelDetail.treasurySection}</h3>
          {warband.treasury.length === 0 && <p className="text-bone-300 text-sm">{strings.modelDetail.noTreasury}</p>}
          <div className="space-y-2">
            {warband.treasury.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-ink-900 border border-ink-800 p-3">
                <p className="text-bone-100">{item.name}</p>
                <button
                  type="button"
                  onClick={() => assignFromTreasury(item.id)}
                  className="text-ember-400 text-sm font-semibold shrink-0"
                >
                  {strings.modelDetail.assignToModel}
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="group-notes">
            {strings.modelDetail.notesLabel}
          </label>
          <textarea
            id="group-notes"
            value={group.notes}
            onChange={(e) => updateGroup({ notes: e.target.value })}
            className="w-full min-h-[80px] rounded-md bg-ink-900 border border-ink-700 px-3 py-2 text-bone-100 focus:outline-none focus:border-ember-500"
          />
        </div>

        <button
          type="button"
          onClick={handleDelete}
          className="w-full min-h-[48px] rounded-md border border-blood-600 text-blood-500 font-semibold hover:bg-blood-600 hover:text-bone-100 transition-colors"
        >
          {strings.modelDetail.deleteModel}
        </button>
      </main>
    </div>
  );
}
