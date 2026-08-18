import BackHeader from '../components/BackHeader';
import { Card } from '../components/ui';
import { strings } from '../strings';
import changelogData from '../data/changelog.json';

type ChangelogEntry = {
  date: string;
  title: string;
  description: string;
};

const entries = changelogData as ChangelogEntry[];

export default function ChangelogScreen() {
  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.changelog.title} />

      <main className="flex-1 px-4 py-6 space-y-4">
        {entries.map((entry, i) => (
          <Card key={i} gap="sm">
            <p className="text-bone-300 text-xs">{entry.date}</p>
            <p className="text-bone-100 font-semibold">{entry.title}</p>
            <p className="text-bone-300 text-sm">{entry.description}</p>
          </Card>
        ))}
      </main>
    </div>
  );
}
