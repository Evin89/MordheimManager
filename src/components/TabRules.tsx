import RuleEntryList from './RuleEntryList';
import { getTradingTabRuleEntries, getWarbandsTabRuleEntries } from '../lib/rulesIndex';
import { strings } from '../strings';

/**
 * The rules panel embedded in the Warbands and Trading tabs.
 *
 * Its own module purely so it can be a lazy chunk. `rulesIndex` pulls in
 * rules.json, the full equipment catalogue, every skill list and all 22 warband
 * files — around 400 kB of JSON. Imported directly by a primary tab, all of
 * that lands in the entry bundle and is downloaded by someone who only ever
 * opens their roster. Behind a lazy boundary it arrives when the Rules toggle
 * is actually pressed.
 */
export default function TabRules({ tab }: { tab: 'warbands' | 'trading' }) {
  const entries = tab === 'warbands' ? getWarbandsTabRuleEntries() : getTradingTabRuleEntries();
  return <RuleEntryList entries={entries} emptyMessage={strings.rules.noEntriesInCategory} />;
}
