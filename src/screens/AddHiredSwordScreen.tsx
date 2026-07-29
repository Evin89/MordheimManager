import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { strings } from '../strings';
import { useSaveWarbandMutation, useWarband } from '../hooks/useWarbands';
import { createHiredSwordFromDefinition } from '../lib/warbandFactory';
import { STAT_KEYS } from '../lib/statLine';
import { resolveStatLine } from '../lib/statLine';
import hiredSwordsData from '../data/hiredSwords.json';
import { HiredSwordsData } from '../data/types';

const hiredSwords = (hiredSwordsData as HiredSwordsData).hiredSwords;

export default function AddHiredSwordScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const warband = useWarband(warbandId);
  const saveWarband = useSaveWarbandMutation();

  const [definitionId, setDefinitionId] = useState(hiredSwords[0]?.id ?? '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!warband) return <Navigate to="/warbands" replace />;

  const definition = hiredSwords.find((h) => h.id === definitionId);
  const fee = definition?.hireFee ?? 0;
  const canAfford = fee <= warband.gold;

  function handleHire() {
    if (!definition || !warband) return;
    if (!name.trim()) {
      setError(strings.addHiredSword.nameRequired);
      return;
    }
    // Eligibility is free text in the source ("Any warband apart from Undead
    // and Skaven"), so it's shown for the player to read rather than enforced —
    // parsing prose into a rule would be guessing.
    if (!canAfford) {
      if (!window.confirm(strings.trading.insufficientGoldConfirm(fee, warband.gold))) return;
    }

    const sword = createHiredSwordFromDefinition(definition, name.trim());
    saveWarband({
      ...warband,
      gold: warband.gold - fee,
      hiredSwords: [...warband.hiredSwords, sword],
    });
    navigate(`/warbands/${warband.id}`, { replace: true });
  }

  const stats = definition ? resolveStatLine(definition.statLine).stats : null;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.addHiredSword.title} subtitle={warband.name} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="hired-sword">
            {strings.addHiredSword.pickType}
          </label>
          <select
            id="hired-sword"
            value={definitionId}
            onChange={(e) => setDefinitionId(e.target.value)}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          >
            {hiredSwords.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.hireFee ?? '?'} {strings.common.gold})
              </option>
            ))}
          </select>
          <p className={`text-sm ${canAfford ? 'text-bone-300' : 'text-blood-500'}`}>
            {strings.roster.costVsTreasury(fee, warband.gold)}
          </p>
          <p className="text-bone-400 text-xs">{strings.addHiredSword.notCountedHint}</p>
        </div>

        {definition && (
          <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
            <p className="text-bone-100 font-semibold">{definition.name}</p>

            {stats && (
              <div className="grid grid-cols-9 gap-1 text-center">
                {STAT_KEYS.map((key) => (
                  <div key={key}>
                    <p className="text-bone-300 text-[10px] uppercase">{key}</p>
                    <p className="text-bone-100 text-sm font-semibold">{stats[key]}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-bone-300 text-sm">
              <span className="text-bone-200 font-semibold">{strings.addHiredSword.upkeepLabel}: </span>
              {definition.upkeep ?? '?'} {strings.common.gold} {strings.addHiredSword.perBattle}
            </p>
            <p className="text-bone-300 text-sm">
              <span className="text-bone-200 font-semibold">{strings.addHiredSword.hiredByLabel}: </span>
              {definition.mayBeHiredBy}
            </p>
            {definition.equipment && (
              <p className="text-bone-300 text-sm">
                <span className="text-bone-200 font-semibold">{strings.addHiredSword.equipmentLabel}: </span>
                {definition.equipment}
              </p>
            )}
            {definition.specialRules && (
              <p className="text-bone-300 text-sm">
                <span className="text-bone-200 font-semibold">{strings.addHiredSword.specialRulesLabel}: </span>
                {definition.specialRules}
              </p>
            )}
            <p className="text-bone-400 text-xs">{definition.source}</p>
          </section>
        )}

        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="hired-sword-name">
            {strings.addHiredSword.nameLabel}
          </label>
          <input
            id="hired-sword-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={strings.addHiredSword.namePlaceholder}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 placeholder:text-bone-300/50 focus:outline-none focus:border-ember-500"
          />
          {error && <p className="text-blood-500 text-sm">{error}</p>}
        </div>

        <button
          type="button"
          onClick={handleHire}
          className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold px-4 transition-colors"
        >
          {strings.addHiredSword.hireButton}
        </button>
      </main>
    </div>
  );
}
