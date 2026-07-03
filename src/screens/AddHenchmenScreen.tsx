import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { createHenchmenGroupFromType } from '../lib/warbandFactory';

export default function AddHenchmenScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const warband = useAppStore((state) => state.warbands.find((w) => w.id === warbandId));
  const saveWarband = useAppStore((state) => state.saveWarband);

  const definition = warband ? getWarbandDefinition(warband.warbandType) : undefined;
  const [typeId, setTypeId] = useState(definition?.henchmenTypes[0]?.id ?? '');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [groupName, setGroupName] = useState('');
  const [existingGroupId, setExistingGroupId] = useState('');
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  if (!warband) return <Navigate to="/warbands" replace />;
  if (!definition) return <Navigate to={`/warbands/${warband.id}`} replace />;

  const type = definition.henchmenTypes.find((t) => t.id === typeId);
  const existingGroupsOfType = warband.henchmenGroups.filter((g) => g.unitType === type?.unitType);

  function handleAdd() {
    if (!type || !warband) return;

    const currentCount = warband.henchmenGroups
      .filter((g) => g.unitType === type.unitType)
      .reduce((sum, g) => sum + g.count, 0);
    if (type.maxCount !== null && currentCount + count > type.maxCount) {
      const proceed = window.confirm(strings.roster.slotLimitWarning(type.unitType, type.maxCount));
      if (!proceed) return;
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
      saveWarband({ ...warband, henchmenGroups: updated });
    } else {
      if (!groupName.trim()) {
        setError('Give the new group a name.');
        return;
      }
      const group = createHenchmenGroupFromType(type, groupName.trim(), count);
      saveWarband({ ...warband, henchmenGroups: [...warband.henchmenGroups, group] });
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
            {definition.henchmenTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.unitType} ({t.cost ?? '?'} {strings.common.gold})
              </option>
            ))}
          </select>
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
          <input
            id="count"
            type="number"
            inputMode="numeric"
            min={1}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
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
