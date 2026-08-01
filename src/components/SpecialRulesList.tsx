import { useState } from 'react';
import DisclosureChevron from './DisclosureChevron';
import { UnitSpecialRule } from '../data/types';
import { strings } from '../strings';

function RuleRow({ rule, isTodo = false }: { rule: UnitSpecialRule; isTodo?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ink/15 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-[44px] flex items-center gap-2 py-2 text-left"
      >
        <DisclosureChevron open={open} />
        <span
          className={`font-heading-sc uppercase tracking-[0.06em] ${
            isTodo ? 'text-ink-faded' : 'text-ink'
          }`}
        >
          {rule.name}
        </span>
        {isTodo && (
          // Flagged rather than hidden: this text hasn't been split into named
          // rules yet, and pretending otherwise would make a gap look finished.
          <span className="ml-auto shrink-0 rounded border border-ink/40 px-1.5 py-0.5 font-ui text-xs uppercase tracking-wide text-ink-faded">
            {strings.modelDetail.todoBadge}
          </span>
        )}
      </button>
      {open && (
        <p
          className={`pb-3 pl-6 pr-1 text-sm whitespace-pre-line ${
            isTodo ? 'text-ink-faded' : 'text-ink'
          }`}
        >
          {rule.description}
        </p>
      )}
    </div>
  );
}

/**
 * A unit's printed special rules, each expanding to its text.
 *
 * These used to sit inside the free-text `notes` blob, where a rule like
 * Bloodgreed was a clause in the middle of a paragraph that also carried the
 * hire cost and a data-quality remark — unfindable at the table. Splitting them
 * out means a warrior's abilities read as a list you can scan, which is how
 * they appear in the book.
 */
export default function SpecialRulesList({
  rules,
  notes = '',
}: {
  rules: UnitSpecialRule[];
  /** Whatever survived the split into named rules — flavour, warband quirks,
   * and data-quality remarks. Shown as an explicit TODO rather than dropped. */
  notes?: string;
}) {
  const leftover = notes.trim();
  if (rules.length === 0 && !leftover) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-bone-100 font-semibold">{strings.modelDetail.specialRulesSection}</h2>
      <div className="rounded-md bg-ink-900 border border-ink-800 px-3">
        {rules.map((rule) => (
          <RuleRow key={rule.name} rule={rule} />
        ))}
        {leftover && (
          <RuleRow
            rule={{ name: strings.modelDetail.unstructuredNotes, description: leftover }}
            isTodo
          />
        )}
      </div>
    </section>
  );
}
