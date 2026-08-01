import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { getUnitSpecialRules, getUnitNotes } from '../data/warbandRegistry';
import SpecialRulesList from '../components/SpecialRulesList';
import InlineNumberField from '../components/InlineNumberField';
import ProfileBlock from '../components/ProfileBlock';
import { STAT_KEYS } from '../lib/statLine';
import EquipmentShop from '../components/EquipmentShop';
import WeaponRulesDisclosure from '../components/WeaponRulesDisclosure';
import SaveBar from '../components/SaveBar';
import { strings } from '../strings';
import { useWarbandLookup } from '../hooks/useWarbands';
import { useUnsavedChangesWarning, useWarbandDraft } from '../hooks/useWarbandDraft';
import { useBattlesQuery, useMyCampaignQuery } from '../hooks/useCampaign';
import { generateId } from '../lib/id';
import { ResolvedEquipmentItem } from '../lib/equipmentLookup';
import { hasFoughtFirstBattle } from '../lib/battleHistory';
import { getAdvanceProgress } from '../lib/xpThresholds';
import { EquipmentItem, HenchmenGroup, StatLine, Warband } from '../types';

export default function HenchmenDetailScreen() {
  const { warbandId, groupId } = useParams<{ warbandId: string; groupId: string }>();
  const navigate = useNavigate();
  const { warband, loading } = useWarbandLookup(warbandId);
  const { draft, update, dirty, save, saveNow, discard } = useWarbandDraft(warband);
  useUnsavedChangesWarning(dirty);
  const { data: campaign } = useMyCampaignQuery();
  const { data: battles } = useBattlesQuery(campaign?.id);
  const [shoppingOpen, setShoppingOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
  if (!warband || !draft) return <Navigate to="/warbands" replace />;

  // Render from the draft so typed edits show immediately.
  const group = draft.henchmenGroups.find((g) => g.id === groupId);
  if (!group) return <Navigate to={`/warbands/${draft.id}`} replace />;

  function groupPatch(patch: Partial<HenchmenGroup>) {
    return (current: Warband) => ({
      henchmenGroups: current.henchmenGroups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
    });
  }

  /** Typed fields — held until the user saves. */
  function updateGroup(patch: Partial<HenchmenGroup>) {
    update(groupPatch(patch));
  }

  /** Deliberate actions — written straight away. */
  function commitGroup(patch: Partial<HenchmenGroup>) {
    saveNow(groupPatch(patch));
  }

  function updateStat(key: keyof StatLine, value: number) {
    if (!group) return;
    updateGroup({ stats: { ...group.stats, [key]: Math.max(0, value) } });
  }

  function applyStatAdvance(key: keyof StatLine) {
    if (!group) return;
    commitGroup({
      stats: { ...group.stats, [key]: group.stats[key] + 1 },
      advances: [...group.advances, { id: generateId(), type: 'stat', detail: `+1 ${key}` }],
    });
  }

  function moveToTreasury(itemId: string) {
    if (!group) return;
    const item = group.equipment.find((e) => e.id === itemId);
    if (!item) return;
    saveNow((current: Warband) => ({
      henchmenGroups: current.henchmenGroups.map((g) =>
        g.id === groupId ? { ...g, equipment: g.equipment.filter((e) => e.id !== itemId) } : g,
      ),
      treasury: [...current.treasury, item],
    }));
  }

  function assignFromTreasury(itemId: string) {
    if (!draft || !group) return;
    const item = draft.treasury.find((e) => e.id === itemId);
    if (!item) return;
    saveNow((current: Warband) => ({
      henchmenGroups: current.henchmenGroups.map((g) =>
        g.id === groupId ? { ...g, equipment: [...g.equipment, item] } : g,
      ),
      treasury: current.treasury.filter((e) => e.id !== itemId),
    }));
  }

  function buyForGroup(item: ResolvedEquipmentItem, price: number) {
    if (!draft || !group) return;

    // "Every model in each Henchman group must be armed and armoured in the
    // same way... if your Henchman group has four warriors, and you want to buy
    // them swords, you must buy four swords." The group's equipment list holds
    // one entry meaning "each model carries this", so the entry is added once
    // but paid for once per model.
    const total = price * group.count;

    if (total > draft.gold) {
      if (!window.confirm(strings.trading.insufficientGoldConfirm(total, draft.gold))) return;
    } else if (group.count > 1) {
      // Worth a confirm of its own: the shop showed a single item's price, and
      // the warband is about to be charged several times that.
      if (!window.confirm(strings.trading.groupPurchaseConfirm(item.name, group.count, total))) return;
    }

    const newItem: EquipmentItem = {
      id: generateId(),
      name: item.name,
      category: item.category,
      cost: price,
      notes: item.restriction || undefined,
    };
    saveNow((current: Warband) => ({
      henchmenGroups: current.henchmenGroups.map((g) =>
        g.id === groupId ? { ...g, equipment: [...g.equipment, newItem] } : g,
      ),
      gold: current.gold - total,
    }));
  }

  function handleDelete() {
    if (!draft || !group) return;
    if (window.confirm(strings.modelDetail.deleteModelConfirm(group.groupName))) {
      saveNow((current: Warband) => ({
        henchmenGroups: current.henchmenGroups.filter((g) => g.id !== groupId),
      }));
      navigate(`/warbands/${draft.id}`, { replace: true });
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

        <SpecialRulesList
          rules={getUnitSpecialRules(draft.warbandType, group.unitType)}
          notes={getUnitNotes(draft.warbandType, group.unitType)}
        />

        <section className="space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.modelDetail.statsSection}</h2>
          <p className="text-bone-300 text-xs">
            {group.isAnimal ? 'Animal — does not gain Experience.' : 'Shared by the whole group.'}
          </p>
          <ProfileBlock stats={group.stats} onStatChange={updateStat} />
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
            {(() => {
              const progress = getAdvanceProgress(group.xp, 'henchmen');
              if (progress.atThreshold)
                return (
                  <p className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold text-center">{strings.modelDetail.xpAtAdvance}</p>
                );
              if (progress.maxed)
                return <p className="text-bone-300 text-sm text-center">{strings.modelDetail.xpMaxed}</p>;
              if (progress.xpToNext !== null && progress.nextThreshold !== null)
                return (
                  <p className="text-bone-300 text-sm text-center">
                    {strings.modelDetail.xpToNextAdvance(progress.xpToNext, progress.nextThreshold)}
                  </p>
                );
              return null;
            })()}
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
          <div className="flex items-center justify-between">
            <h2 className="text-bone-100 font-semibold">{strings.modelDetail.equipmentSection}</h2>
            <button
              type="button"
              onClick={() => setShoppingOpen((v) => !v)}
              className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold shrink-0"
            >
              {shoppingOpen ? strings.modelDetail.hideShop : strings.modelDetail.buyEquipment}
            </button>
          </div>
          {group.equipment.length === 0 && <p className="text-bone-300 text-sm">{strings.modelDetail.noEquipment}</p>}
          <div className="space-y-2">
            {group.equipment.map((item) => (
              <WeaponRulesDisclosure
                key={item.id}
                name={item.name}
                action={
                  <button
                    type="button"
                    onClick={() => moveToTreasury(item.id)}
                    className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold shrink-0"
                  >
                    {strings.modelDetail.moveToTreasury}
                  </button>
                }
              />
            ))}
          </div>

          {shoppingOpen && (
            <div className="space-y-3 rounded-lg border border-ink-800 p-3">
              <p className="text-ember-400 font-semibold text-sm">
                {strings.modelDetail.shopGoldLabel}: {draft.gold} {strings.common.gold}
              </p>
              <EquipmentShop
                buyer={'henchmenGroup'}
                unitType={group.unitType}
                warband={draft}
                onPurchase={buyForGroup}
                skipRarityRoll={!hasFoughtFirstBattle(draft.id, battles)}
              />
            </div>
          )}

          <h3 className="text-bone-200 text-sm font-semibold pt-2">{strings.modelDetail.treasurySection}</h3>
          {draft.treasury.length === 0 && <p className="text-bone-300 text-sm">{strings.modelDetail.noTreasury}</p>}
          <div className="space-y-2">
            {draft.treasury.map((item) => (
              <WeaponRulesDisclosure
                key={item.id}
                name={item.name}
                action={
                  <button
                    type="button"
                    onClick={() => assignFromTreasury(item.id)}
                    className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold shrink-0"
                  >
                    {strings.modelDetail.assignToModel}
                  </button>
                }
              />
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

        <SaveBar dirty={dirty} onSave={save} onDiscard={discard} />
      </main>
    </div>
  );
}
