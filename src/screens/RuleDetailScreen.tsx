import { Link, Navigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import WeaponProfileView from '../components/WeaponProfileView';
import { SectionHeading } from '../components/ui';
import { strings } from '../strings';
import { getRuleEntry, getRulesCategories } from '../lib/rulesIndex';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { getCostForRuleId } from '../lib/weaponRules';
import { parseWarbandSpecialRules } from '../lib/warbandRulesFormat';
import WarbandRosterDetail from '../components/WarbandRosterDetail';

/** A warband's special rules, laid out like the rulebook: a lead-in, then each
 * named rule as a bold run-in heading. */
function WarbandRulesBody({ body }: { body: string }) {
  const { lead, rules } = parseWarbandSpecialRules(body);
  return (
    <div className="space-y-4">
      {lead.map((paragraph, i) => (
        <p key={`l${i}`} className="text-bone-300 text-sm leading-relaxed italic">
          {paragraph}
        </p>
      ))}
      {rules.length > 0 && (
        <dl className="space-y-3">
          {rules.map((rule, i) => (
            <div key={`r${i}`} className="text-sm leading-relaxed">
              <dt className="inline font-semibold text-bone-100">{rule.name}.</dt>{' '}
              <dd className="inline text-bone-200">{rule.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function RuleDetailScreen() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const entry = ruleId ? getRuleEntry(ruleId) : undefined;

  if (!entry) return <Navigate to="/rules" replace />;

  // Warband rule pages carry the warband's full roster (profiles + equipment
  // lists) below the special rules, looked up from the same id.
  const warbandDef = entry.id.startsWith('warband-')
    ? getWarbandDefinition(entry.id.replace('warband-', ''))
    : undefined;

  const category = getRulesCategories().find((c) => c.id === entry.category);
  const related = (entry.relatedIds ?? []).map((id) => getRuleEntry(id)).filter((e): e is NonNullable<typeof e> => !!e);
  const subtitle = category && category.name !== entry.chapter ? `${category.name} · ${entry.chapter}` : entry.chapter;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={entry.title} subtitle={subtitle} />

      <main className="flex-1 px-4 py-6 space-y-4">
        {entry.weapon ? (
          <WeaponProfileView profile={entry.weapon} {...getCostForRuleId(entry.id)} />
        ) : entry.id.startsWith('warband-') ? (
          <div className="space-y-6">
            <WarbandRulesBody body={entry.body} />
            {warbandDef && (
              <div className="border-t border-ink-800 pt-5">
                <WarbandRosterDetail definition={warbandDef} />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {entry.body.split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-bone-200 text-sm whitespace-pre-line leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        )}

        <p className="text-bone-300 text-xs">
          {strings.rules.sourceLabel}: {entry.source}
        </p>

        {related.length > 0 && (
          <section className="space-y-2 pt-2">
            <SectionHeading className="text-sm">{strings.rules.relatedSection}</SectionHeading>
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
