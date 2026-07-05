import { Link, Navigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { strings } from '../strings';
import { getRuleEntry, getRulesCategories } from '../lib/rulesIndex';

export default function RuleDetailScreen() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const entry = ruleId ? getRuleEntry(ruleId) : undefined;

  if (!entry) return <Navigate to="/rules" replace />;

  const category = getRulesCategories().find((c) => c.id === entry.category);
  const related = (entry.relatedIds ?? []).map((id) => getRuleEntry(id)).filter((e): e is NonNullable<typeof e> => !!e);
  const subtitle = category && category.name !== entry.chapter ? `${category.name} · ${entry.chapter}` : entry.chapter;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={entry.title} subtitle={subtitle} />

      <main className="flex-1 px-4 py-6 space-y-4">
        <div className="space-y-3">
          {entry.body.split('\n\n').map((paragraph, i) => (
            <p key={i} className="text-bone-200 text-sm whitespace-pre-line leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        <p className="text-bone-300 text-xs">
          {strings.rules.sourceLabel}: {entry.source}
        </p>

        {related.length > 0 && (
          <section className="space-y-2 pt-2">
            <h2 className="text-bone-100 font-semibold text-sm">{strings.rules.relatedSection}</h2>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/rules/${r.id}`}
                  className="px-3 py-1.5 rounded-md border border-ink-700 text-bone-200 text-xs font-semibold hover:border-ember-500 hover:text-ember-400"
                >
                  {r.title}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
