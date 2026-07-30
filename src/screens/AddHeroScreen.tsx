import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { strings } from '../strings';
import { useSaveWarbandMutation, useWarbandLookup } from '../hooks/useWarbands';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { createHeroFromSlot } from '../lib/warbandFactory';
import { remainingHeroSlots, remainingWarbandCapacity } from '../lib/warbandLimits';

export default function AddHeroScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const { warband, loading } = useWarbandLookup(warbandId);
  const saveWarband = useSaveWarbandMutation();

  const definition = warband ? getWarbandDefinition(warband.warbandType) : undefined;
  const [slotId, setSlotId] = useState(definition?.heroSlots[0]?.id ?? '');
  const [name, setName] = useState('');
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

  const slot = definition.heroSlots.find((s) => s.id === slotId);
  const cost = slot?.cost ?? 0;
  const capacity = remainingWarbandCapacity(warband, definition);
  const slotsLeft = slot ? remainingHeroSlots(warband, slot) : null;
  const atSlotLimit = slotsLeft === 0;
  const atSizeLimit = capacity === 0;
  const canAfford = cost <= warband.gold;

  function handleAdd() {
    if (!name.trim()) {
      setError(strings.newWarband.nameRequired);
      return;
    }
    if (!slot || !warband || !definition) return;

    // Both limits are rulebook limits rather than app invariants, and groups do
    // bend them by agreement, so these confirm rather than refuse.
    if (atSlotLimit && slot.maxCount !== null) {
      if (!window.confirm(strings.roster.slotLimitWarning(slot.unitType, slot.maxCount))) return;
    }
    if (atSizeLimit && definition.maxWarbandSize !== null) {
      if (!window.confirm(strings.roster.warbandSizeWarning(definition.maxWarbandSize))) return;
    }
    if (!canAfford) {
      if (!window.confirm(strings.trading.insufficientGoldConfirm(cost, warband.gold))) return;
    }

    const hero = createHeroFromSlot(slot, name.trim());
    saveWarband({
      ...warband,
      gold: warband.gold - cost,
      heroes: [...warband.heroes, hero],
    });
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
            {definition.heroSlots.map((s) => {
              const left = remainingHeroSlots(warband!, s);
              return (
                // Kept selectable but visibly spent, so you can still see the
                // unit exists and what it costs — a silently missing option
                // reads as a bug.
                <option key={s.id} value={s.id} disabled={left === 0}>
                  {s.unitType} ({s.cost ?? '?'} {strings.common.gold})
                  {left === 0 ? ` — ${strings.roster.slotFull}` : ''}
                </option>
              );
            })}
          </select>
          {slot && (
            <p className="text-bone-300 text-sm">
              {slotsLeft === null
                ? strings.roster.slotsUnlimited
                : strings.roster.slotsRemaining(slotsLeft, slot.maxCount ?? 0)}{' '}
              · {strings.roster.startingXpLabel(slot.startingXp ?? 0)}
            </p>
          )}
          <p className={`text-sm ${canAfford ? 'text-bone-300' : 'text-blood-500'}`}>
            {strings.roster.costVsTreasury(cost, warband.gold)}
          </p>
          {atSizeLimit && definition.maxWarbandSize !== null && (
            <p className="text-blood-500 text-sm">{strings.roster.atMaxSize(definition.maxWarbandSize)}</p>
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
