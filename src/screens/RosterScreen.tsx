import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import InlineNumberField from '../components/InlineNumberField';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { computeWarbandRating } from '../lib/rating';
import { Hero, HiredSword, ModelStatus } from '../types';

const STATUS_BADGE: Partial<Record<ModelStatus, string>> = {
  missNextGame: strings.roster.missNextGameBadge,
  dead: strings.roster.deadBadge,
  captured: strings.roster.capturedBadge,
  left: strings.roster.leftBadge,
};

function ModelRow({ to, model }: { to: string; model: Hero | HiredSword }) {
  const badge = STATUS_BADGE[model.status];
  const unitTypeLabel = 'unitType' in model ? model.unitType : model.type;
  return (
    <Link
      to={to}
      className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-bone-100 font-semibold truncate">{model.name}</p>
          <p className="text-bone-300 text-sm truncate">{unitTypeLabel}</p>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <p className="text-bone-300 text-sm">{model.xp} XP</p>
          {badge && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blood-600 text-bone-100">{badge}</span>
          )}
          {model.injuries.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-ink-800 text-bone-300 border border-ink-700">
              {model.injuries.length} injur{model.injuries.length === 1 ? 'y' : 'ies'}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function RosterScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const warband = useAppStore((state) => state.warbands.find((w) => w.id === warbandId));
  const saveWarband = useAppStore((state) => state.saveWarband);
  const deleteWarband = useAppStore((state) => state.deleteWarband);
  const lastBattleSnapshot = useAppStore((state) => state.lastBattleSnapshot);
  const undoLastBattle = useAppStore((state) => state.undoLastBattle);

  if (!warband) {
    return <Navigate to="/warbands" replace />;
  }

  function handleDelete() {
    if (!warband) return;
    if (window.confirm(strings.roster.deleteWarbandConfirm(warband.name))) {
      deleteWarband(warband.id);
      navigate('/warbands', { replace: true });
    }
  }

  function handleUndo() {
    if (window.confirm(strings.postBattle.undoConfirm)) {
      undoLastBattle();
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={warband.name} subtitle={warband.warbandType} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-4">
          <p className="text-ember-400 font-semibold">
            {strings.roster.ratingLabel}: {computeWarbandRating(warband)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <InlineNumberField
              label={strings.roster.goldLabel}
              value={warband.gold}
              onCommit={(gold) => saveWarband({ ...warband, gold })}
            />
            <InlineNumberField
              label={strings.roster.shardsLabel}
              value={warband.wyrdstoneShards}
              onCommit={(wyrdstoneShards) => saveWarband({ ...warband, wyrdstoneShards })}
            />
          </div>
        </section>

        <Link
          to={`/warbands/${warband.id}/pre-battle`}
          className="block text-center w-full min-h-[48px] leading-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
        >
          {strings.battle.startBattleButton}
        </Link>

        <Link
          to={`/warbands/${warband.id}/trading`}
          className="block text-center w-full min-h-[48px] leading-[48px] rounded-md border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800 transition-colors"
        >
          {strings.roster.visitTrading}
        </Link>

        <Link
          to={`/warbands/${warband.id}/post-battle`}
          className="block text-center w-full min-h-[40px] leading-[40px] text-bone-300 text-sm"
        >
          {strings.postBattle.startButton}
        </Link>

        {lastBattleSnapshot?.warbandId === warband.id && (
          <button
            type="button"
            onClick={handleUndo}
            className="w-full min-h-[48px] rounded-md border border-ink-700 text-bone-200 font-semibold hover:bg-ink-800 transition-colors"
          >
            {strings.postBattle.undoLastBattle}
          </button>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-bone-100 font-semibold">{strings.roster.heroesSection}</h2>
            <Link to={`/warbands/${warband.id}/add-hero`} className="text-ember-400 text-sm font-semibold">
              {strings.roster.addHero}
            </Link>
          </div>
          {warband.heroes.length === 0 && <p className="text-bone-300 text-sm">{strings.roster.noHeroes}</p>}
          <div className="space-y-2">
            {warband.heroes.map((hero) => (
              <ModelRow key={hero.id} to={`/warbands/${warband.id}/hero/${hero.id}`} model={hero} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-bone-100 font-semibold">{strings.roster.henchmenSection}</h2>
            <Link to={`/warbands/${warband.id}/add-henchmen`} className="text-ember-400 text-sm font-semibold">
              {strings.roster.addHenchmen}
            </Link>
          </div>
          {warband.henchmenGroups.length === 0 && (
            <p className="text-bone-300 text-sm">{strings.roster.noHenchmen}</p>
          )}
          <div className="space-y-2">
            {warband.henchmenGroups.map((group) => (
              <Link
                key={group.id}
                to={`/warbands/${warband.id}/henchmen/${group.id}`}
                className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-bone-100 font-semibold truncate">{group.groupName}</p>
                    <p className="text-bone-300 text-sm truncate">
                      {group.count}x {group.unitType}
                    </p>
                  </div>
                  <p className="text-bone-300 text-sm shrink-0">{group.xp} XP</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.roster.hiredSwordsSection}</h2>
          {warband.hiredSwords.length === 0 && (
            <p className="text-bone-300 text-sm">{strings.roster.noHiredSwords}</p>
          )}
          <div className="space-y-2">
            {warband.hiredSwords.map((sword) => (
              <ModelRow key={sword.id} to={`/warbands/${warband.id}/hired-sword/${sword.id}`} model={sword} />
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={handleDelete}
          className="w-full min-h-[48px] rounded-md border border-blood-600 text-blood-500 font-semibold hover:bg-blood-600 hover:text-bone-100 transition-colors"
        >
          {strings.roster.deleteWarband}
        </button>
      </main>
    </div>
  );
}
