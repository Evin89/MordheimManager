import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { strings } from '../strings';
import { warbandDefinitions } from '../data/warbandRegistry';
import { createWarband } from '../lib/warbandFactory';
import { useAppStore } from '../store/useAppStore';

export default function NewWarbandScreen() {
  const navigate = useNavigate();
  const saveWarband = useAppStore((state) => state.saveWarband);
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState(warbandDefinitions[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const definition = warbandDefinitions.find((def) => def.id === typeId);

  function handleCreate() {
    if (!name.trim()) {
      setError(strings.newWarband.nameRequired);
      return;
    }
    if (!definition) return;

    const warband = createWarband(definition, name.trim());
    saveWarband(warband);
    navigate(`/warbands/${warband.id}`, { replace: true });
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.newWarband.title} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="warband-name">
            {strings.newWarband.nameLabel}
          </label>
          <input
            id="warband-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={strings.newWarband.namePlaceholder}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 placeholder:text-bone-300/50 focus:outline-none focus:border-ember-500"
          />
          {error && <p className="text-blood-500 text-sm">{error}</p>}
        </div>

        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="warband-type">
            {strings.newWarband.typeLabel}
          </label>
          <select
            id="warband-type"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          >
            {warbandDefinitions.map((def) => (
              <option key={def.id} value={def.id}>
                {def.name}
              </option>
            ))}
          </select>
          {definition && (
            <p className="text-bone-300 text-sm">
              Starting gold: {definition.startingGold ?? '?'} {strings.common.gold} · Max size: {definition.maxWarbandSize ?? '?'}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleCreate}
          className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold px-4 transition-colors"
        >
          {strings.newWarband.createButton}
        </button>
      </main>
    </div>
  );
}
