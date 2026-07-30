import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import NumberInput from '../components/NumberInput';
import { strings } from '../strings';
import { useSaveWarbandMutation, useWarbandLookup } from '../hooks/useWarbands';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { createHenchmenGroupFromType } from '../lib/warbandFactory';
import {
  maxAffordableHenchmen,
  remainingHenchmenSlots,
  remainingWarbandCapacity,
} from '../lib/warbandLimits';

export default function AddHenchmenScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const { warband, loading } = useWarbandLookup(warbandId);
  const saveWarband = useSaveWarbandMutation();

  const definition = warband ? getWarbandDefinition(warband.warbandType) : undefined;
  const [typeId, setTypeId] = useState(definition?.henchmenTypes[0]?.id ?? '');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [groupName, setGroupName] = useState('');
  const [existingGroupId, setExistingGroupId] = useState('');
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
  if (!warband) return <Navigate to="/warbands" replace />;
  if (!definition) return <Navigate to={`/warbands/${warband.id}`} replace />;

  const type = definition.henchmenTypes.find((t) => t.id === typeId);
  const existingGroupsOfType = warband.henchmenGroups.filter((g) => g.unitType === type?.unitType);
  const slotsLeft = type ? remainingHenchmenSlots(warband, type) : null;
  const totalCost = (type?.cost ?? 0) * count;
  const affordable = type ? maxAffordableHenchmen(warband, definition, type) : 0;

  function handleAdd() {
    if (!type || !warband || !definition) return;

    const perType = remainingHenchmenSlots(warband, type);
    if (perType !== null && count > perType && type.maxCount !== null) {
      if (!window.confirm(strings.roster.slotLimitWarning(type.unitType, type.maxCount))) return;
    }

    // The old code only checked the per-type cap, so a group could be sized
    // straight past the warband's own maximum — you could recruit 30 henchmen
    // into a warband capped at 15 and nothing said a word.
    const capacity = remainingWarbandCapacity(warband, definition);
    if (capacity !== null && count > capacity && definition.maxWarbandSize !== null) {
      if (!window.confirm(strings.roster.warbandSizeWarning(definition.maxWarbandSize))) return;
    }

    const totalCost = (type.cost ?? 0) * count;
    if (totalCost > warband.gold) {
      if (!window.confirm(strings.trading.insufficientGoldConfirm(totalCost, warband.gold))) return;
    }

    if (mode === 'existing') {
      const group = warband.henchmenGroups.find((g) => g.id === existingGroupId);
      if (!group) {
        setError('Choose a group to add to.');
        return;
      }
      const updated = warband.henchmenGroups.map((g) =>
        g.id === group.id ? { ...g, count: g.count + count } : g,
      );
      saveWarband({ ...warband, gold: warband.gold - totalCost, henchmenGroups: updated });
    } else {
      if (!groupName.trim()) {
        setError('Give the new group a name.');
        return;
      }
      const group = createHenchmenGroupFromType(type, groupName.trim(), count);
      saveWarband({
        ...warband,
        gold: warband.gold - totalCost,
        henchmenGroups: [...warband.henchmenGroups, group],
      });
    }

    navigate(`/warbands/${warband.id}`, { replace: true });
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.addHenchmen.title} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="henchmen-type">
            {strings.addHenchmen.pickType}
          </label>
          <select
            id="henchmen-type"
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value);
              setExistingGroupId('');
              setError(null);
            }}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          >
            {definition.henchmenTypes.map((t) => {
              const left = remainingHenchmenSlots(warband!, t);
              return (
                <option key={t.id} value={t.id} disabled={left === 0}>
                  {t.unitType} ({t.cost ?? '?'} {strings.common.gold})
                  {left === 0 ? ` — ${strings.roster.slotFull}` : ''}
                </option>
              );
            })}
          </select>
          {type && (
            <p className="text-bone-300 text-sm">
              {slotsLeft === null
                ? strings.roster.slotsUnlimited
                : strings.roster.slotsRemaining(slotsLeft, type.maxCount ?? 0)}
            </p>
          )}
          <p className={`text-sm ${totalCost <= warband.gold ? 'text-bone-300' : 'text-blood-500'}`}>
            {strings.roster.costVsTreasury(totalCost, warband.gold)}
          </p>
          {affordable === 0 ? (
            <p className="text-blood-500 text-sm">{strings.roster.cannotRecruitMore}</p>
          ) : (
            count > affordable && (
              <p className="text-blood-500 text-sm">{strings.roster.overLimitHint(affordable)}</p>
            )
          )}
        </div>

        {existingGroupsOfType.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex-1 min-h-[44px] rounded-md text-sm font-semibold border ${
                mode === 'new' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
              }`}
            >
              {strings.addHenchmen.newGroup}
            </button>
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex-1 min-h-[44px] rounded-md text-sm font-semibold border ${
                mode === 'existing' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
              }`}
            >
              {strings.addHenchmen.addToExisting}
            </button>
          </div>
        )}

        {mode === 'new' ? (
          <div className="space-y-2">
            <label className="block text-bone-200 text-sm font-semibold" htmlFor="group-name">
              {strings.addHenchmen.groupNameLabel}
            </label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setError(null);
              }}
              placeholder={strings.addHenchmen.groupNamePlaceholder}
              className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 placeholder:text-bone-300/50 focus:outline-none focus:border-ember-500"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-bone-200 text-sm font-semibold" htmlFor="existing-group">
              {strings.addHenchmen.pickType}
            </label>
            <select
              id="existing-group"
              value={existingGroupId}
              onChange={(e) => {
                setExistingGroupId(e.target.value);
                setError(null);
              }}
              className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
            >
              <option value="">—</option>
              {existingGroupsOfType.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.groupName} ({g.count})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="count">
            {strings.addHenchmen.countLabel}
          </label>
          <NumberInput
            id="count"
            min={1}
            value={count}
            onChange={setCount}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          />
        </div>

        {error && <p className="text-blood-500 text-sm">{error}</p>}

        <button
          type="button"
          onClick={handleAdd}
          className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold px-4 transition-colors"
        >
          {strings.common.add}
        </button>
      </main>
    </div>
  );
}
