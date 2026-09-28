import { useState } from 'react';
import { ANY_FILTER, SETTINGS, SOURCE_GROUPS, ScenarioFilter } from '../lib/scenarioCatalog';

/**
 * A scenario filter remembered between visits, per viewer, in localStorage — a
 * convenience, not state anyone else needs, so a blocked or empty store just
 * means starting from "any". `key` separates independent filters: the scenario
 * pickers share one (a player who only plays Mordheim-set games wants that
 * everywhere they pick a game), the Rules Reference keeps its own.
 */
export function useScenarioFilter(key: 'picker' | 'rules') {
  const storageKey = `mordheim.scenarioFilter.${key}`;
  const [filter, setFilterState] = useState<ScenarioFilter>(() => read(storageKey));

  function setFilter(next: ScenarioFilter) {
    setFilterState(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage blocked — the filter still works for this visit.
    }
  }

  return [filter, setFilter] as const;
}

/** Read a stored filter, dropping anything that isn't a current option (a
 * setting or source the catalogue no longer has resets to "any"). */
function read(storageKey: string): ScenarioFilter {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return ANY_FILTER;
    const v = JSON.parse(raw) as Partial<ScenarioFilter>;
    return {
      setting: typeof v.setting === 'string' && SETTINGS.includes(v.setting) ? v.setting : 'any',
      players: v.players === '1v1' || v.players === 'Multiplayer' ? v.players : 'any',
      source: SOURCE_GROUPS.includes(v.source as never) ? (v.source as ScenarioFilter['source']) : 'any',
      fitsOnly: v.fitsOnly === true,
    };
  } catch {
    return ANY_FILTER;
  }
}
