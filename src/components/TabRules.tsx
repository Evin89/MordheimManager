import { useNavigate } from 'react-router-dom';
import RuleEntryList from './RuleEntryList';
import { Field, Select } from './ui';
import { getRuleEntry, getTradingTabRuleEntries, getWarbandsTabRuleEntries } from '../lib/rulesIndex';
import { warbandDefinitionsByName } from '../data/warbandRegistry';
import { RuleEntry } from '../data/types';
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

// Creation rules that live under other chapters but belong with "how to build a
// warband", pulled in by id so the panel reads as one complete set.
const EXTRA_CREATION_IDS = ['rare-items-at-warband-creation'];

/** One creation rule, shown in full — title, then its body in paragraphs. */
function CreationRule({ entry }: { entry: RuleEntry }) {
  return (
    <section className="space-y-2">
      <h3 className="text-ember-400 text-xs font-semibold uppercase tracking-wide">{entry.title}</h3>
      {entry.body.split('\n\n').map((paragraph, i) => (
        <p key={i} className="text-bone-200 text-sm leading-relaxed whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </section>
  );
}

/**
 * The Warbands tab's rules: the rules for creating a warband laid out in full at
 * the top, then the individual warbands' rules pages listed below.
 */
function WarbandsTabRules() {
  const navigate = useNavigate();
  const entries = getWarbandsTabRuleEntries();
  const creation = entries.filter((e) => !e.id.startsWith('warband-'));
  const extras = EXTRA_CREATION_IDS.map((id) => getRuleEntry(id)).filter((e): e is RuleEntry => !!e);
  const creationRules = [...creation, ...extras];

  return (
    <div className="space-y-6">
      {creationRules.length > 0 && (
        <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-5">
          {creationRules.map((entry) => (
            <CreationRule key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* Every warband, in one dropdown — pick one to read its rules, profiles and
          equipment. Sourced from the registry so BTB warbands are included too. */}
      <Field label="Warband rules" htmlFor="warband-rules-select">
        <Select
          id="warband-rules-select"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) navigate(`/rules/warbands/${e.target.value}`);
          }}
        >
          <option value="" disabled>
            Choose a warband…
          </option>
          {warbandDefinitionsByName.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

export default function TabRules({ tab }: { tab: 'warbands' | 'trading' }) {
  if (tab === 'trading') {
    return (
      <RuleEntryList entries={getTradingTabRuleEntries()} emptyMessage={strings.rules.noEntriesInCategory} />
    );
  }
  return <WarbandsTabRules />;
}
