import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import EquipmentShop from '../components/EquipmentShop';
import SkillPicker from '../components/SkillPicker';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { generateId } from '../lib/id';
import { getUniqueInjuries } from '../lib/injuryLookup';
import { ResolvedEquipmentItem } from '../lib/equipmentLookup';
import { STAT_KEYS } from '../lib/statLine';
import { EquipmentItem, Hero, HiredSword, ModelStatus, StatLine } from '../types';

type EditableModel = Hero | HiredSword;

type ModelDetailScreenProps = {
  kind: 'hero' | 'hiredSword';
};

const STATUS_OPTIONS: ModelStatus[] = ['active', 'missNextGame', 'dead', 'captured', 'left'];

export default function ModelDetailScreen({ kind }: ModelDetailScreenProps) {
  const { warbandId, modelId } = useParams<{ warbandId: string; modelId: string }>();
  const navigate = useNavigate();
  const warband = useAppStore((state) => state.warbands.find((w) => w.id === warbandId));
  const saveWarband = useAppStore((state) => state.saveWarband);

  const [advanceMode, setAdvanceMode] = useState<'stat' | 'skill' | null>(null);
  const [addingInjury, setAddingInjury] = useState(false);
  const [injuryChoice, setInjuryChoice] = useState('custom');
  const [customInjuryName, setCustomInjuryName] = useState('');
  const [customInjuryEffect, setCustomInjuryEffect] = useState('');
  const [shoppingOpen, setShoppingOpen] = useState(false);

  if (!warband) return <Navigate to="/warbands" replace />;

  const listKey = kind === 'hero' ? 'heroes' : 'hiredSwords';
  const list = warband[listKey] as EditableModel[];
  const model = list.find((m) => m.id === modelId);
  if (!model) return <Navigate to={`/warbands/${warband.id}`} replace />;

  function updateModel(patch: Partial<EditableModel>) {
    if (!warband || !model) return;
    const updatedList = list.map((m) => (m.id === model.id ? ({ ...m, ...patch } as EditableModel) : m));
    saveWarband({ ...warband, [listKey]: updatedList });
  }

  function updateStat(key: keyof StatLine, value: number) {
    if (!model) return;
    updateModel({ stats: { ...model.stats, [key]: Math.max(0, value) } });
  }

  function applyStatAdvance(key: keyof StatLine) {
    if (!model) return;
    updateModel({
      stats: { ...model.stats, [key]: model.stats[key] + 1 },
      advances: [...model.advances, { id: generateId(), type: 'stat', detail: `+1 ${key}` }],
    });
    setAdvanceMode(null);
  }

  function applySkillAdvance(skillName: string) {
    if (!model) return;
    updateModel({
      skills: [...model.skills, skillName],
      advances: [...model.advances, { id: generateId(), type: 'skill', detail: skillName }],
    });
    setAdvanceMode(null);
  }

  function addInjury() {
    if (!model) return;
    const uniqueInjuries = getUniqueInjuries();
    const picked = uniqueInjuries.find((i) => i.name === injuryChoice);
    const name = picked ? picked.name : customInjuryName.trim();
    const effect = picked ? picked.effect : customInjuryEffect.trim();
    if (!name) return;

    updateModel({
      injuries: [
        ...model.injuries,
        { id: generateId(), name, effect, dateAcquired: new Date().toISOString().slice(0, 10) },
      ],
    });
    setAddingInjury(false);
    setInjuryChoice('custom');
    setCustomInjuryName('');
    setCustomInjuryEffect('');
  }

  function moveToTreasury(itemId: string) {
    if (!warband || !model) return;
    const item = model.equipment.find((e) => e.id === itemId);
    if (!item) return;
    const updatedList = list.map((m) =>
      m.id === model.id ? { ...m, equipment: m.equipment.filter((e) => e.id !== itemId) } : m,
    );
    saveWarband({ ...warband, [listKey]: updatedList, treasury: [...warband.treasury, item] });
  }

  function assignFromTreasury(itemId: string) {
    if (!warband || !model) return;
    const item = warband.treasury.find((e) => e.id === itemId);
    if (!item) return;
    const updatedList = list.map((m) => (m.id === model.id ? { ...m, equipment: [...m.equipment, item] } : m));
    saveWarband({
      ...warband,
      [listKey]: updatedList,
      treasury: warband.treasury.filter((e) => e.id !== itemId),
    });
  }

  function buyForModel(item: ResolvedEquipmentItem, price: number) {
    if (!warband || !model) return;
    if (price > warband.gold) {
      if (!window.confirm(strings.trading.insufficientGoldConfirm(price, warband.gold))) return;
    }
    const newItem: EquipmentItem = {
      id: generateId(),
      name: item.name,
      category: item.category,
      cost: price,
      notes: item.restriction || undefined,
    };
    const updatedList = list.map((m) =>
      m.id === model.id ? { ...m, equipment: [...m.equipment, newItem] } : m,
    );
    saveWarband({ ...warband, [listKey]: updatedList, gold: warband.gold - price });
  }

  function handleDelete() {
    if (!warband || !model) return;
    if (window.confirm(strings.modelDetail.deleteModelConfirm(model.name))) {
      saveWarband({ ...warband, [listKey]: list.filter((m) => m.id !== model.id) });
      navigate(`/warbands/${warband.id}`, { replace: true });
    }
  }

  const unitTypeLabel = 'unitType' in model ? model.unitType : model.type;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={model.name} subtitle={unitTypeLabel} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="model-name">
            Name
          </label>
          <input
            id="model-name"
            type="text"
            value={model.name}
            onChange={(e) => updateModel({ name: e.target.value })}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="model-status">
            {strings.modelDetail.statusLabel}
          </label>
          <select
            id="model-status"
            value={model.status}
            onChange={(e) => updateModel({ status: e.target.value as ModelStatus })}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <section className="space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.modelDetail.statsSection}</h2>
          <div className="grid grid-cols-3 gap-3">
            {STAT_KEYS.map((key) => {
              const atMax = model.stats[key] >= model.statMaximums[key];
              return (
                <div
                  key={key}
                  className={`rounded-md border p-2 text-center ${
                    atMax ? 'border-ember-500 bg-ink-900' : 'border-ink-700 bg-ink-900'
                  }`}
                >
                  <p className="text-bone-300 text-xs uppercase">{key}</p>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={model.stats[key]}
                    onChange={(e) => updateStat(key, Number(e.target.value))}
                    className="w-full bg-transparent text-center text-bone-100 text-lg font-semibold focus:outline-none"
                  />
                  <p className="text-bone-300 text-[10px]">
                    max {model.statMaximums[key]}
                    {atMax && <span className="text-ember-400"> · {strings.modelDetail.atMax}</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.modelDetail.xpSection}</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => updateModel({ xp: Math.max(0, model.xp - 1) })}
              className="min-h-[48px] min-w-[48px] rounded-md border border-ink-700 text-bone-100 text-xl font-bold"
            >
              −
            </button>
            <p className="text-bone-100 text-2xl font-bold flex-1 text-center">{model.xp}</p>
            <button
              type="button"
              onClick={() => updateModel({ xp: model.xp + 1 })}
              className="min-h-[48px] min-w-[48px] rounded-md border border-ink-700 text-bone-100 text-xl font-bold"
            >
              +
            </button>
          </div>

          {advanceMode === null && (
            <button
              type="button"
              onClick={() => setAdvanceMode('stat')}
              className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
            >
              {strings.modelDetail.recordAdvance}
            </button>
          )}

          {advanceMode !== null && (
            <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdvanceMode('stat')}
                  className={`flex-1 min-h-[44px] rounded-md text-sm font-semibold border ${
                    advanceMode === 'stat' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
                  }`}
                >
                  {strings.modelDetail.advanceTypeStat}
                </button>
                <button
                  type="button"
                  onClick={() => setAdvanceMode('skill')}
                  className={`flex-1 min-h-[44px] rounded-md text-sm font-semibold border ${
                    advanceMode === 'skill' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
                  }`}
                >
                  {strings.modelDetail.advanceTypeSkill}
                </button>
              </div>

              {advanceMode === 'stat' && (
                <div className="space-y-2">
                  <p className="text-bone-300 text-sm">{strings.modelDetail.pickStat}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {STAT_KEYS.map((key) => {
                      const atMax = model.stats[key] >= model.statMaximums[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyStatAdvance(key)}
                          className={`min-h-[44px] rounded-md border font-semibold ${
                            atMax ? 'border-blood-500 text-blood-500' : 'border-ink-700 text-bone-100'
                          }`}
                        >
                          {key}
                          {atMax && ' ⚠'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {advanceMode === 'skill' && (
                <SkillPicker
                  skillLists={model.skillLists}
                  knownSkills={model.skills}
                  warbandType={warband.warbandType}
                  isLeader={model.isLeader}
                  onAdd={applySkillAdvance}
                />
              )}

              <button
                type="button"
                onClick={() => setAdvanceMode(null)}
                className="w-full min-h-[40px] rounded-md text-bone-300 text-sm"
              >
                {strings.common.cancel}
              </button>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-bone-100 font-semibold">{strings.modelDetail.skillsSection}</h2>
          {model.skills.length === 0 ? (
            <p className="text-bone-300 text-sm">{strings.modelDetail.noSkills}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {model.skills.map((skill, i) => (
                <li key={`${skill}-${i}`} className="px-2 py-1 rounded bg-ink-800 border border-ink-700 text-bone-200 text-sm">
                  {skill}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-bone-100 font-semibold">{strings.modelDetail.injuriesSection}</h2>
            {!addingInjury && (
              <button type="button" onClick={() => setAddingInjury(true)} className="text-ember-400 text-sm font-semibold">
                {strings.modelDetail.addInjury}
              </button>
            )}
          </div>

          {model.injuries.length === 0 && <p className="text-bone-300 text-sm">{strings.modelDetail.noInjuries}</p>}
          <div className="space-y-2">
            {model.injuries.map((injury) => (
              <div key={injury.id} className="rounded-md bg-ink-900 border border-ink-800 p-3">
                <p className="text-bone-100 font-semibold">{injury.name}</p>
                {injury.effect && <p className="text-bone-300 text-sm mt-1">{injury.effect}</p>}
              </div>
            ))}
          </div>

          {addingInjury && (
            <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
              <select
                value={injuryChoice}
                onChange={(e) => setInjuryChoice(e.target.value)}
                className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
              >
                <option value="custom">Custom…</option>
                {getUniqueInjuries().map((injury) => (
                  <option key={injury.name} value={injury.name}>
                    {injury.name}
                  </option>
                ))}
              </select>

              {injuryChoice === 'custom' && (
                <>
                  <input
                    type="text"
                    placeholder={strings.modelDetail.injuryNameLabel}
                    value={customInjuryName}
                    onChange={(e) => setCustomInjuryName(e.target.value)}
                    className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
                  />
                  <textarea
                    placeholder={strings.modelDetail.injuryEffectLabel}
                    value={customInjuryEffect}
                    onChange={(e) => setCustomInjuryEffect(e.target.value)}
                    className="w-full min-h-[80px] rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-bone-100"
                  />
                </>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addInjury}
                  className="flex-1 min-h-[44px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold"
                >
                  {strings.common.add}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingInjury(false)}
                  className="flex-1 min-h-[44px] rounded-md text-bone-300"
                >
                  {strings.common.cancel}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-bone-100 font-semibold">{strings.modelDetail.equipmentSection}</h2>
            <button
              type="button"
              onClick={() => setShoppingOpen((v) => !v)}
              className="text-ember-400 text-sm font-semibold shrink-0"
            >
              {shoppingOpen ? strings.modelDetail.hideShop : strings.modelDetail.buyEquipment}
            </button>
          </div>
          {model.equipment.length === 0 && <p className="text-bone-300 text-sm">{strings.modelDetail.noEquipment}</p>}
          <div className="space-y-2">
            {model.equipment.map((item) => (
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

          {shoppingOpen && (
            <div className="space-y-3 rounded-lg border border-ink-800 p-3">
              <p className="text-ember-400 font-semibold text-sm">
                {strings.modelDetail.shopGoldLabel}: {warband.gold} {strings.common.gold}
              </p>
              <EquipmentShop warband={warband} onPurchase={buyForModel} />
            </div>
          )}

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
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="model-notes">
            {strings.modelDetail.notesLabel}
          </label>
          <textarea
            id="model-notes"
            value={model.notes}
            onChange={(e) => updateModel({ notes: e.target.value })}
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
