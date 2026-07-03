import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { createHeroFromSlot } from '../lib/warbandFactory';

export default function AddHeroScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const warband = useAppStore((state) => state.warbands.find((w) => w.id === warbandId));
  const saveWarband = useAppStore((state) => state.saveWarband);

  const definition = warband ? getWarbandDefinition(warband.warbandType) : undefined;
  const [slotId, setSlotId] = useState(definition?.heroSlots[0]?.id ?? '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!warband) return <Navigate to="/warbands" replace />;
  if (!definition) return <Navigate to={`/warbands/${warband.id}`} replace />;

  const slot = definition.heroSlots.find((s) => s.id === slotId);

  function handleAdd() {
    if (!name.trim()) {
      setError(strings.newWarband.nameRequired);
      return;
    }
    if (!slot || !warband) return;

    const currentCount = warband.heroes.filter((h) => h.unitType === slot.unitType).length;
    if (slot.maxCount !== null && currentCount >= slot.maxCount) {
      const proceed = window.confirm(strings.roster.slotLimitWarning(slot.unitType, slot.maxCount));
      if (!proceed) return;
    }

    const hero = createHeroFromSlot(slot, name.trim());
    saveWarband({ ...warband, heroes: [...warband.heroes, hero] });
    navigate(`/warbands/${warband.id}`, { replace: true });
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.addHero.title} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="hero-slot">
            {strings.addHero.pickSlot}
          </label>
          <select
            id="hero-slot"
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          >
            {definition.heroSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.unitType} ({s.cost ?? '?'} {strings.common.gold})
              </option>
            ))}
          </select>
          {slot && (
            <p className="text-bone-300 text-sm">
              Max in warband: {slot.maxCount ?? 'unlimited'} · Starting XP: {slot.startingXp ?? 0}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="hero-name">
            {strings.addHero.nameLabel}
          </label>
          <input
            id="hero-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={strings.addHero.namePlaceholder}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 placeholder:text-bone-300/50 focus:outline-none focus:border-ember-500"
          />
          {error && <p className="text-blood-500 text-sm">{error}</p>}
        </div>

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
