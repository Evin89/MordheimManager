import RuleEntryList from '../components/RuleEntryList';
import { strings } from '../strings';
import { getSkillsTabRuleEntries } from '../lib/rulesIndex';

export default function SkillsScreen() {
  const entries = getSkillsTabRuleEntries();

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.skills.title}</h1>
      </header>

      <main className="flex-1 px-4 py-4">
        <RuleEntryList entries={entries} emptyMessage={strings.skills.emptyMessage} />
      </main>
    </div>
  );
}
