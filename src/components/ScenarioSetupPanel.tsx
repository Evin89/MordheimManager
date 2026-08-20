import { Link } from 'react-router-dom';
import { getScenarioSetup } from '../lib/scenarioSetup';
import { strings } from '../strings';

/**
 * Shows the chosen scenario's setup in the pre-battle screen: its objective,
 * player mode, the Experience on offer, an optional deployment map, and a link
 * to the full rules. Renders nothing for an unset or unknown scenario, so it can
 * be dropped in unconditionally.
 */
export default function ScenarioSetupPanel({ scenarioName }: { scenarioName: string }) {
  const setup = getScenarioSetup(scenarioName);
  if (!setup) return null;
  const t = strings.battle.preBattle.setup;
  const allAwards = [...setup.awards, setup.universalAward];

  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-bone-300 text-xs uppercase tracking-wide">{t.heading}</p>
        {setup.playerMode && (
          <p className="text-bone-400 text-xs">{t.players(setup.playerMode)}</p>
        )}
      </div>

      {setup.description && <p className="text-bone-100">{setup.description}</p>}

      {/* Optional deployment map — shown only when the scenario carries one. */}
      {setup.image && (
        <img
          src={setup.image}
          alt={t.mapAlt(setup.name)}
          className="w-full rounded-md border border-ink-800"
          loading="lazy"
        />
      )}

      {allAwards.length > 0 && (
        <div className="space-y-1">
          <p className="text-ember-400 text-xs font-semibold uppercase tracking-wide">
            {t.awardsHeading}
          </p>
          <ul className="space-y-1">
            {allAwards.map((a) => (
              <li key={a.id} className="text-sm text-bone-300">
                <span className="text-ember-400 font-semibold tabular-nums">{a.amount}</span>{' '}
                <span className="text-bone-100">{a.label}</span>
                {a.note && <span className="text-bone-400"> — {a.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {setup.ruleId && (
        <Link
          to={`/rules/${setup.ruleId}`}
          className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
        >
          {t.fullRules}
        </Link>
      )}
    </div>
  );
}
