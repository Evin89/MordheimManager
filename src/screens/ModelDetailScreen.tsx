import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { getUnitSpecialRules, getUnitNotes, getWarbandDefinition } from '../data/warbandRegistry';
import SpecialRulesList from '../components/SpecialRulesList';
import ConfirmAction from '../components/ConfirmAction';
import { allowedEquipmentIds, checkEligibility } from '../lib/equipmentEligibility';
import ProfileBlock from '../components/ProfileBlock';
import WarbandPhotoEditor from '../components/WarbandPhoto';
import { STAT_KEYS } from '../lib/statLine';
import EquipmentShop from '../components/EquipmentShop';
import EquipmentHistory from '../components/EquipmentHistory';
import { appendEquipmentLog } from '../lib/equipmentLog';
import SkillPicker from '../components/SkillPicker';
import SpellBlock from '../components/SpellBlock';
import WeaponRulesDisclosure from '../components/WeaponRulesDisclosure';
import SaveBar from '../components/SaveBar';
import { Button, Card, SectionHeading } from '../components/ui';
import { strings } from '../strings';
import { useWarbandLookup } from '../hooks/useWarbands';
import { useUnsavedChangesWarning, useWarbandDraft } from '../hooks/useWarbandDraft';
import { useBattlesQuery, useMyCampaignQuery } from '../hooks/useCampaign';
import { generateId } from '../lib/id';
import { getSpell, resolveSpellLists, spellBlockLabel } from '../lib/spellLookup';
import { getUniqueInjuries } from '../lib/injuryLookup';
import { ResolvedEquipmentItem } from '../lib/equipmentLookup';
import { hasFoughtFirstBattle } from '../lib/battleHistory';
import { MAX_MELEE, MAX_MISSILE_TYPES, canAddWeapon, countWeaponSlots } from '../lib/weaponSlots';
import { getAdvanceProgress } from '../lib/xpThresholds';
import { Advance, EquipmentItem, Hero, HiredSword, ModelStatus, StatLine, Warband } from '../types';

/** Weapon categories a skill can un-restrict (§9.3): Weapons Training / Expert. */
const LIST_LIFTING_SKILLS = ['Weapons Training', 'Weapons Expert'];

type EditableModel = Hero | HiredSword;

type ModelDetailScreenProps = {
  kind: 'hero' | 'hiredSword';
};

const STATUS_OPTIONS: ModelStatus[] = ['active', 'missNextGame', 'dead', 'captured', 'left'];

/** Names a spell for an advance record, falling back to the id. */
function spellName(spellId: string): string {
  return getSpell(spellId)?.name ?? spellId;
}

export default function ModelDetailScreen({ kind }: ModelDetailScreenProps) {
  const { warbandId, modelId } = useParams<{ warbandId: string; modelId: string }>();
  const navigate = useNavigate();
  const { warband, loading } = useWarbandLookup(warbandId);
  const { draft, update, dirty, save, saveNow, discard } = useWarbandDraft(warband);
  useUnsavedChangesWarning(dirty);
  const { data: campaign } = useMyCampaignQuery();
  const { data: battles } = useBattlesQuery(campaign?.id);

  const [advanceMode, setAdvanceMode] = useState<'stat' | 'skill' | 'spell' | null>(null);
  // §4.2.1 hand-editing: which skill/advance is mid-confirm, the add-skill picker,
  // and a transient toast naming what was removed.
  const [confirmSkill, setConfirmSkill] = useState<string | null>(null);
  const [addingSkill, setAddingSkill] = useState(false);
  const [confirmAdvanceId, setConfirmAdvanceId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [addingInjury, setAddingInjury] = useState(false);
  const [injuryChoice, setInjuryChoice] = useState('custom');
  const [customInjuryName, setCustomInjuryName] = useState('');
  const [customInjuryEffect, setCustomInjuryEffect] = useState('');
  const [shoppingOpen, setShoppingOpen] = useState(false);

  // The removed-toast clears itself; a removal is re-derivable, so it's a note,
  // not something to dismiss.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
  if (!warband || !draft) return <Navigate to="/warbands" replace />;

  const listKey = kind === 'hero' ? 'heroes' : 'hiredSwords';
  // Render from the draft so typed edits appear immediately; `warband` is only
  // the last saved copy.
  const list = draft[listKey] as EditableModel[];
  const model = list.find((m) => m.id === modelId);
  if (!model) return <Navigate to={`/warbands/${draft.id}`} replace />;

  // From the game data, not from the model's stored copy — a caster recruited
  // before spell lists existed has an empty one, and would show no magic.
  const spellLists = resolveSpellLists(draft.warbandType, model);

  const unitType = 'unitType' in model ? model.unitType : model.type;
  const buyer = kind === 'hero' ? ('hero' as const) : ('hiredSword' as const);
  const allowedIds = allowedEquipmentIds(getWarbandDefinition(draft.warbandType), unitType);

  /**
   * §4.2.1 / §9.3 flag — assigned weapons a lifting skill (Weapons Training /
   * Expert) is the only reason the model may carry. Given a hypothetical skill
   * set, returns those now ineligible: carried, priced (the free dagger is off
   * the list rule), in a liftable category, off the unit's list, and only made
   * legal by a lifting skill the set lacks. Used both to preview the impact of
   * removing a skill and to flag the roster after one is gone.
   */
  const currentModel = model;
  function flaggedEquipment(skills: string[]): EquipmentItem[] {
    if (!allowedIds) return [];
    const ctx = { buyer, warbandType: draft!.warbandType, allowedIds, skills };
    return currentModel.equipment.filter((e) => {
      if (!e.cost) return false;
      if (checkEligibility({ id: e.id, category: e.category }, ctx).allowed) return false;
      const lifted = checkEligibility(
        { id: e.id, category: e.category },
        { ...ctx, skills: [...skills, ...LIST_LIFTING_SKILLS] },
      );
      return lifted.allowed;
    });
  }
  const flaggedNow = flaggedEquipment(model.skills);

  function modelPatch(patch: Partial<EditableModel>) {
    return (current: Warband) => ({
      [listKey]: (current[listKey] as EditableModel[]).map((m) =>
        m.id === modelId ? ({ ...m, ...patch } as EditableModel) : m,
      ),
    });
  }

  /** Typed fields — held locally until the user saves. */
  function updateModel(patch: Partial<EditableModel>) {
    update(modelPatch(patch));
  }

  /** Deliberate actions (advances, injuries, gear) — written straight away. */
  function commitModel(patch: Partial<EditableModel>) {
    saveNow(modelPatch(patch));
  }

  function updateStat(key: keyof StatLine, value: number) {
    if (!model) return;
    updateModel({ stats: { ...model.stats, [key]: Math.max(0, value) } });
  }

  function applyStatAdvance(key: keyof StatLine) {
    if (!model) return;
    commitModel({
      stats: { ...model.stats, [key]: model.stats[key] + 1 },
      advances: [...model.advances, { id: generateId(), type: 'stat', detail: `+1 ${key}` }],
    });
    setAdvanceMode(null);
  }

  function applySkillAdvance(skillName: string) {
    if (!model) return;
    commitModel({
      skills: [...model.skills, skillName],
      advances: [...model.advances, { id: generateId(), type: 'skill', detail: skillName }],
    });
    setAdvanceMode(null);
  }

  /**
   * A caster may spend a "new skill" advance on an entry from his own list
   * instead — the Warlock's entry says so outright. Recorded as a skill
   * advance, since that is the advance that was rolled; the detail names the
   * spell taken in its place.
   */
  function applySpellAdvance(spellId: string) {
    if (!model) return;
    if ((model.spells ?? []).includes(spellId)) return;
    commitModel({
      spells: [...(model.spells ?? []), spellId],
      advances: [
        ...model.advances,
        { id: generateId(), type: 'skill', detail: spellName(spellId) },
      ],
    });
    setAdvanceMode(null);
  }

  function addSpell(spellId: string) {
    if (!model) return;
    // Guarded rather than assumed: the picker filters known entries out, but a
    // roll and a pick can race, and a duplicate is unresolvable after the fact.
    if ((model.spells ?? []).includes(spellId)) return;
    commitModel({ spells: [...(model.spells ?? []), spellId] });
  }

  function removeSpell(spellId: string) {
    if (!model) return;
    commitModel({ spells: (model.spells ?? []).filter((id) => id !== spellId) });
    setToast(strings.modelDetail.removedToast(spellName(spellId)));
  }

  // §4.2.1 — skills by hand: add (not gated, adding isn't destructive) and
  // remove (through ConfirmAction, since it's re-derivable).
  function addSkillByHand(skillName: string) {
    if (!model || model.skills.includes(skillName)) return;
    commitModel({ skills: [...model.skills, skillName] });
    setAddingSkill(false);
  }

  function removeSkill(skillName: string) {
    if (!model) return;
    commitModel({ skills: model.skills.filter((s) => s !== skillName) });
    setToast(strings.modelDetail.removedToast(skillName));
    setConfirmSkill(null);
  }

  /**
   * §4.2.1 — removing an advance is a pure log correction: it does not touch the
   * statline (authoritative, edited directly) and, by default, not a granted
   * skill/spell either. The opt-in drops the linked grant in the same action —
   * a `skill`-type advance's `detail` names the skill it granted, or the spell
   * (matched by name) where a caster spent the advance on a spell instead.
   */
  function removeAdvance(adv: Advance, alsoRemoveGrant: boolean) {
    if (!model) return;
    const patch: Partial<EditableModel> = { advances: model.advances.filter((a) => a.id !== adv.id) };
    if (alsoRemoveGrant && adv.type === 'skill') {
      if (model.skills.includes(adv.detail)) {
        patch.skills = model.skills.filter((s) => s !== adv.detail);
      } else {
        const spellId = (model.spells ?? []).find((id) => spellName(id) === adv.detail);
        if (spellId) patch.spells = (model.spells ?? []).filter((id) => id !== spellId);
      }
    }
    commitModel(patch);
    setToast(strings.modelDetail.removedToast(adv.detail));
    setConfirmAdvanceId(null);
  }

  function addInjury() {
    if (!model) return;
    const uniqueInjuries = getUniqueInjuries();
    const picked = uniqueInjuries.find((i) => i.name === injuryChoice);
    const name = picked ? picked.name : customInjuryName.trim();
    const effect = picked ? picked.effect : customInjuryEffect.trim();
    if (!name) return;

    commitModel({
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
    if (!model) return;
    const item = model.equipment.find((e) => e.id === itemId);
    if (!item) return;
    saveNow((current: Warband) => ({
      [listKey]: (current[listKey] as EditableModel[]).map((m) =>
        m.id === modelId
          ? {
              ...m,
              equipment: m.equipment.filter((e: EquipmentItem) => e.id !== itemId),
              equipmentLog: appendEquipmentLog(
                m.equipmentLog,
                'lost',
                item.name,
                strings.modelDetail.logMovedToTreasury,
              ),
            }
          : m,
      ),
      treasury: [...current.treasury, item],
    }));
  }

  function assignFromTreasury(itemId: string) {
    if (!draft || !model) return;
    const item = draft.treasury.find((e) => e.id === itemId);
    if (!item) return;
    if (!allowWeapon(item)) return;
    saveNow((current: Warband) => ({
      [listKey]: (current[listKey] as EditableModel[]).map((m) =>
        m.id === modelId
          ? {
              ...m,
              equipment: [...m.equipment, item],
              equipmentLog: appendEquipmentLog(
                m.equipmentLog,
                'acquired',
                item.name,
                strings.modelDetail.logFromTreasury,
              ),
            }
          : m,
      ),
      treasury: current.treasury.filter((e: EquipmentItem) => e.id !== itemId),
    }));
  }

  /**
   * The two-weapon limits. Enforced on both routes onto a model — buying and
   * assigning from the treasury — since either would otherwise slip past it.
   * The treasury itself stays unlimited: the rules cap what a warrior carries,
   * not what the warband owns.
   */
  function allowWeapon(item: { name: string; category: EquipmentItem['category'] }): boolean {
    if (!model) return false;
    const verdict = canAddWeapon(model.equipment, item);
    if (verdict.allowed) return true;
    window.alert(
      verdict.reason === 'meleeFull'
        ? strings.modelDetail.meleeFull(MAX_MELEE)
        : strings.modelDetail.missileFull(MAX_MISSILE_TYPES),
    );
    return false;
  }

  function buyForModel(item: ResolvedEquipmentItem, price: number) {
    if (!draft || !model) return;
    if (!allowWeapon(item)) return;
    if (price > draft.gold) {
      if (!window.confirm(strings.trading.insufficientGoldConfirm(price, draft.gold))) return;
    }
    const newItem: EquipmentItem = {
      id: generateId(),
      name: item.name,
      category: item.category,
      cost: price,
      notes: item.restriction || undefined,
    };
    saveNow((current: Warband) => ({
      [listKey]: (current[listKey] as EditableModel[]).map((m) =>
        m.id === modelId
          ? {
              ...m,
              equipment: [...m.equipment, newItem],
              equipmentLog: appendEquipmentLog(
                m.equipmentLog,
                'acquired',
                newItem.name,
                strings.modelDetail.logBought(price),
              ),
            }
          : m,
      ),
      gold: current.gold - price,
    }));
  }

  function handleDelete() {
    if (!draft || !model) return;
    if (window.confirm(strings.modelDetail.deleteModelConfirm(model.name))) {
      saveNow((current: Warband) => ({
        [listKey]: (current[listKey] as EditableModel[]).filter((m) => m.id !== modelId),
      }));
      navigate(`/warbands/${draft.id}`, { replace: true });
    }
  }

  const unitTypeLabel = 'unitType' in model ? model.unitType : model.type;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={model.name} subtitle={unitTypeLabel} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="model-name">
            {strings.modelDetail.nameLabel}
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
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="model-nickname">
            {strings.modelDetail.nicknameLabel}
          </label>
          <input
            id="model-nickname"
            type="text"
            value={model.nickname ?? ''}
            onChange={(e) => updateModel({ nickname: e.target.value })}
            placeholder={strings.modelDetail.nicknamePlaceholder}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 placeholder:text-ink-faded focus:outline-none focus:border-ember-500"
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

        {/* §11.4: above the profile block. A painted model is how you recognise
            him on the table; the numbers are what you look up once you have. */}
        <section className="space-y-3">
          <SectionHeading>{strings.photo.modelSection}</SectionHeading>
          <WarbandPhotoEditor warbandId={warbandId!} warbandName={model.name} modelId={model.id} />
        </section>

        <section className="space-y-3">
          <SectionHeading>{strings.modelDetail.statsSection}</SectionHeading>
          <ProfileBlock
            stats={model.stats}
            maximums={model.statMaximums}
            onStatChange={updateStat}
            showMaximums
          />
          <p className="text-ink-faded text-xs">{strings.modelDetail.atMaxLegend}</p>
        </section>

        <SpecialRulesList
          rules={getUnitSpecialRules(warband.warbandType, 'unitType' in model ? model.unitType : model.type)}
          notes={getUnitNotes(warband.warbandType, 'unitType' in model ? model.unitType : model.type)}
        />

        <section className="space-y-3">
          <SectionHeading>{strings.modelDetail.xpSection}</SectionHeading>
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

          {(() => {
            const progress = getAdvanceProgress(model.xp, 'hero');
            if (progress.atThreshold)
              return <p className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold text-center">{strings.modelDetail.xpAtAdvance}</p>;
            if (progress.maxed) return <p className="text-bone-300 text-sm text-center">{strings.modelDetail.xpMaxed}</p>;
            if (progress.xpToNext !== null && progress.nextThreshold !== null)
              return (
                <p className="text-bone-300 text-sm text-center">
                  {strings.modelDetail.xpToNextAdvance(progress.xpToNext, progress.nextThreshold)}
                </p>
              );
            return null;
          })()}

          {advanceMode === null && (
            <Button onClick={() => setAdvanceMode('stat')}>{strings.modelDetail.recordAdvance}</Button>
          )}

          {advanceMode !== null && (
            <Card>
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
                {/* Only a caster is offered this; for everyone else the tab
                    would be a dead end rather than a choice. */}
                {spellLists.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAdvanceMode('spell')}
                    className={`flex-1 min-h-[44px] rounded-md text-sm font-semibold border ${
                      advanceMode === 'spell' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
                    }`}
                  >
                    {spellBlockLabel(spellLists, false)}
                  </button>
                )}
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

              {advanceMode === 'spell' && (
                <SpellBlock
                  spellLists={spellLists}
                  known={model.spells ?? []}
                  pickerOnly
                  onAdd={applySpellAdvance}
                />
              )}

              {advanceMode === 'skill' && (
                <SkillPicker
                  skillLists={model.skillLists}
                  knownSkills={model.skills}
                  warbandType={draft.warbandType}
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
            </Card>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionHeading>{strings.modelDetail.skillsSection}</SectionHeading>
            {!addingSkill && (
              <button
                type="button"
                onClick={() => setAddingSkill(true)}
                className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
              >
                {strings.modelDetail.addSkill}
              </button>
            )}
          </div>

          {model.skills.length === 0 ? (
            <p className="text-bone-300 text-sm">{strings.modelDetail.noSkills}</p>
          ) : (
            <ul className="space-y-1">
              {model.skills.map((skill, i) => (
                <li key={`${skill}-${i}`} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 px-2 py-1 rounded bg-ink-800 border border-ink-700">
                    <span className="text-bone-200 text-sm">{skill}</span>
                    <button
                      type="button"
                      onClick={() => setConfirmSkill(skill)}
                      className="shrink-0 text-blood-500 text-xs font-semibold"
                    >
                      {strings.common.remove}
                    </button>
                  </div>
                  {confirmSkill === skill &&
                    (() => {
                      // §9.3: name the weapons this skill is the only reason the
                      // model may carry — they'll be flagged once it's gone.
                      const affected = flaggedEquipment(model.skills.filter((s) => s !== skill));
                      return (
                        <ConfirmAction
                          prompt={strings.modelDetail.removeSkillPrompt(skill, model.name)}
                          impact={
                            affected.length > 0
                              ? strings.modelDetail.removeSkillImpact(
                                  model.name,
                                  affected.map((e) => e.name).join(', '),
                                )
                              : undefined
                          }
                          action={strings.modelDetail.removeSkillAction}
                          onConfirm={() => removeSkill(skill)}
                          onCancel={() => setConfirmSkill(null)}
                        />
                      );
                    })()}
                </li>
              ))}
            </ul>
          )}

          {/* Persistent §9.3 flag — remains until the item is unassigned or a
              lifting skill is re-added. */}
          {flaggedNow.length > 0 && (
            <p className="text-blood-500 text-sm">
              {strings.modelDetail.ineligibleEquipmentWarning(flaggedNow.map((e) => e.name).join(', '))}
            </p>
          )}

          {addingSkill && (
            <Card>
              <SkillPicker
                skillLists={model.skillLists}
                knownSkills={model.skills}
                warbandType={draft.warbandType}
                isLeader={model.isLeader}
                onAdd={addSkillByHand}
              />
              <button
                type="button"
                onClick={() => setAddingSkill(false)}
                className="w-full min-h-[40px] rounded-md text-bone-300 text-sm"
              >
                {strings.common.cancel}
              </button>
            </Card>
          )}
        </section>

        {/* Between skills and equipment: a caster's list belongs with the other
            things the unit brings, not buried under its rules text. */}
        <SpellBlock
          spellLists={spellLists}
          known={model.spells ?? []}
          modelName={model.name}
          onAdd={addSpell}
          onRemove={removeSpell}
        />

        {/* §4.2.1 — the advance log, now correctable by hand. */}
        <section className="space-y-2">
          <SectionHeading>{strings.modelDetail.advancesSection}</SectionHeading>
          {model.advances.length === 0 ? (
            <p className="text-bone-300 text-sm">{strings.modelDetail.noAdvances}</p>
          ) : (
            <ul className="space-y-1">
              {model.advances.map((adv) => (
                <li key={adv.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 px-2 py-1 rounded bg-ink-800 border border-ink-700">
                    <span className="text-bone-200 text-sm">
                      {adv.type === 'stat'
                        ? strings.modelDetail.advanceStatLabel(adv.detail)
                        : strings.modelDetail.advanceSkillLabel(adv.detail)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmAdvanceId(adv.id)}
                      className="shrink-0 text-blood-500 text-xs font-semibold"
                    >
                      {strings.common.remove}
                    </button>
                  </div>
                  {confirmAdvanceId === adv.id && (
                    <ConfirmAction
                      prompt={strings.modelDetail.removeAdvancePrompt(model.name)}
                      impact={strings.modelDetail.removeAdvanceNote}
                      // A skill-type advance links its grant by name; offer to
                      // drop it too, defaulted off (§4.2.1).
                      option={
                        adv.type === 'skill'
                          ? { label: strings.modelDetail.removeAdvanceGrantOption(adv.detail) }
                          : undefined
                      }
                      action={strings.modelDetail.removeAdvanceAction}
                      onConfirm={(alsoGrant) => removeAdvance(adv, alsoGrant)}
                      onCancel={() => setConfirmAdvanceId(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeading>{strings.modelDetail.injuriesSection}</SectionHeading>
            {!addingInjury && (
              <button type="button" onClick={() => setAddingInjury(true)} className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
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
                <Button fullWidth={false} onClick={addInjury} className="flex-1">
                  {strings.common.add}
                </Button>
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
            <SectionHeading>{strings.modelDetail.equipmentSection}</SectionHeading>
            {/* Shown rather than only enforced: knowing a slot is full before
                you go shopping beats being refused at the till. */}
            <p className="text-ink-faded text-sm">
              {(() => {
                const usage = countWeaponSlots(model.equipment);
                return strings.modelDetail.weaponSlots(
                  usage.melee,
                  MAX_MELEE,
                  usage.missileTypes,
                  MAX_MISSILE_TYPES,
                );
              })()}
            </p>
            <button
              type="button"
              onClick={() => setShoppingOpen((v) => !v)}
              className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold shrink-0"
            >
              {shoppingOpen ? strings.modelDetail.hideShop : strings.modelDetail.buyEquipment}
            </button>
          </div>
          {model.equipment.length === 0 && <p className="text-bone-300 text-sm">{strings.modelDetail.noEquipment}</p>}
          <div className="space-y-2">
            {model.equipment.map((item) => (
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
                buyer={kind === 'hero' ? 'hero' : 'hiredSword'}
                unitType={'unitType' in model ? model.unitType : model.type}
                skills={model.skills}
                warband={warband}
                onPurchase={buyForModel}
                skipRarityRoll={!hasFoughtFirstBattle(draft.id, battles)}
              />
            </div>
          )}

          <h3 className="text-bone-200 text-sm font-semibold pt-2">{strings.modelDetail.treasurySection}</h3>
          {draft.treasury.length === 0 && <p className="text-bone-300 text-sm">{strings.modelDetail.noTreasury}</p>}
          <div className="space-y-2">
            {draft.treasury.map((item: EquipmentItem) => (
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

          <EquipmentHistory log={model.equipmentLog} />
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

        <Button variant="danger" onClick={handleDelete}>
          {strings.modelDetail.deleteModel}
        </Button>

        <SaveBar dirty={dirty} onSave={save} onDiscard={discard} />
      </main>

      {/* §4.2.1 — names what was removed; self-dismissing, since re-adding
          reverses it. */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-md bg-ink-800 border border-ink-700 px-4 py-2 text-bone-100 text-sm shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
