import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import ProfileBlock from '../components/ProfileBlock';
import { Button, Card, TextField, Select } from '../components/ui';
import { strings } from '../strings';
import { useSaveWarbandMutation, useWarbandLookup } from '../hooks/useWarbands';
import { createHiredSwordFromDefinition } from '../lib/warbandFactory';
import { resolveStatLine } from '../lib/statLine';
import hiredSwordsData from '../data/hiredSwords.json';
import { HiredSwordDefinition, HiredSwordsData } from '../data/types';
import { goldWarning, usePurchase } from '../hooks/usePurchase';

const hiredSwords = [...(hiredSwordsData as HiredSwordsData).hiredSwords].sort((a, b) =>
  a.name.localeCompare(b.name),
);

/**
 * Splits the list into those the source names for this warband and the rest.
 *
 * Seventy Hired Swords in one dropdown is mostly noise for any one warband, but
 * the source's lists aren't the last word — `mayBeHiredBy` has exceptions the
 * lists can't hold, and a custom warband appears on none of them — so the rest
 * stay hireable, just further down.
 */
function splitByEligibility(warbandType: string) {
  const listed: HiredSwordDefinition[] = [];
  const others: HiredSwordDefinition[] = [];
  for (const h of hiredSwords) {
    (h.permittedWarbands?.includes(warbandType) ? listed : others).push(h);
  }
  return { listed, others };
}

function priceLabel(gold: number | null, text: string | undefined): string {
  if (text) return text;
  return gold === null ? '?' : `${gold} ${strings.common.gold}`;
}

export default function AddHiredSwordScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const { warband, loading } = useWarbandLookup(warbandId);
  const saveWarband = useSaveWarbandMutation();

  const [definitionId, setDefinitionId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const purchase = usePurchase();

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
  if (!warband) return <Navigate to="/warbands" replace />;

  const { listed, others } = splitByEligibility(warband.warbandType);
  const definition =
    hiredSwords.find((h) => h.id === definitionId) ?? listed[0] ?? others[0];
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
    purchase.attempt({
      warnings: [!canAfford && goldWarning(fee, warband.gold)],
      action: strings.trading.hireAnyway,
      proceed: () => {
        const sword = createHiredSwordFromDefinition(definition, name.trim());
        saveWarband({
          ...warband,
          gold: warband.gold - fee,
          hiredSwords: [...warband.hiredSwords, sword],
        });
        navigate(`/warbands/${warband.id}`, { replace: true });
      },
    });
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
          <Select id="hired-sword" value={definition?.id ?? ''} onChange={(e) => setDefinitionId(e.target.value)}>
            {listed.length > 0 ? (
              <>
                <optgroup label={strings.addHiredSword.listedGroup}>
                  {listed.map(renderOption)}
                </optgroup>
                <optgroup label={strings.addHiredSword.othersGroup}>
                  {others.map(renderOption)}
                </optgroup>
              </>
            ) : (
              others.map(renderOption)
            )}
          </Select>
          <p className={`text-sm ${canAfford ? 'text-bone-300' : 'text-danger'}`}>
            {strings.roster.costVsTreasury(fee, warband.gold)}
          </p>
          <p className="text-bone-400 text-xs">{strings.addHiredSword.notCountedHint}</p>
        </div>

        {definition && (
          <Card as="section">
            <p className="text-bone-100 font-semibold">{definition.name}</p>

            {stats && (
              <ProfileBlock stats={stats} />
            )}

            <p className="text-bone-300 text-sm">
              <span className="text-bone-200 font-semibold">{strings.addHiredSword.upkeepLabel}: </span>
              {definition.upkeepText ?? `${definition.upkeep ?? '?'} ${strings.common.gold}`}{' '}
              {strings.addHiredSword.perBattle}
            </p>
            {definition.hireFeeText && (
              <p className="text-bone-300 text-sm">
                <span className="text-bone-200 font-semibold">{strings.addHiredSword.hireFeeLabel}: </span>
                {definition.hireFeeText}
              </p>
            )}
            {listed.length > 0 && !listed.includes(definition) && (
              <p className="text-danger text-sm">{strings.addHiredSword.notListedHint}</p>
            )}
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
              <p className="text-bone-300 text-sm whitespace-pre-line">
                <span className="text-bone-200 font-semibold">{strings.addHiredSword.specialRulesLabel}: </span>
                {definition.specialRules}
              </p>
            )}
            <p className="text-bone-400 text-xs">
              {definition.source}
              {definition.url && (
                <>
                  {' · '}
                  <a href={definition.url} target="_blank" rel="noreferrer" className="underline">
                    mordheimer.net ↗
                  </a>
                </>
              )}
            </p>
          </Card>
        )}

        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="hired-sword-name">
            {strings.addHiredSword.nameLabel}
          </label>
          <TextField
            id="hired-sword-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={strings.addHiredSword.namePlaceholder}
          />
          {error && <p className="text-danger text-sm">{error}</p>}
        </div>

        {purchase.panel}
        <Button onClick={handleHire}>{strings.addHiredSword.hireButton}</Button>
      </main>
    </div>
  );
}

function renderOption(h: HiredSwordDefinition) {
  return (
    <option key={h.id} value={h.id}>
      {h.name} ({priceLabel(h.hireFee, h.hireFeeText)})
    </option>
  );
}
