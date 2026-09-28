import { useState } from 'react';
import { ANY_FILTER, SETTINGS, SOURCE_GROUPS, ScenarioFilter, SourceGroup } from '../lib/scenarioCatalog';

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

/** Read a stored filter, dropping anything that isn't a current option. A
 * filter saved in the older one-setting/one-source shape starts over as "all". */
function read(storageKey: string): ScenarioFilter {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return ANY_FILTER;
    const v = JSON.parse(raw) as Partial<ScenarioFilter>;
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : []);
    return {
      hiddenSettings: list(v.hiddenSettings).filter((s) => SETTINGS.includes(s)),
      hiddenSources: list(v.hiddenSources).filter((s): s is SourceGroup => SOURCE_GROUPS.includes(s as SourceGroup)),
      players: v.players === '1v1' || v.players === 'Multiplayer' ? v.players : 'any',
      fitsOnly: v.fitsOnly === true,
    };
  } catch {
    return ANY_FILTER;
  }
}
