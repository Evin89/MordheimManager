import { useState } from 'react';
import DisclosureChevron from './DisclosureChevron';

/**
 * A skill or special-rule row whose name expands to its text — the same
 * read-at-a-glance disclosure the equipment rows (`WeaponRulesDisclosure`) use,
 * so skills, special rules and equipment all read alike on a model card. A name
 * with no resolved text renders as a plain, non-expandable row. The chevron is
 * the app's orange accent, matching the equipment disclosures.
 */
export default function RuleDisclosure({ name, text }: { name: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const canExpand = !!text?.trim();
  return (
    <div>
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={canExpand ? open : undefined}
        className="w-full min-h-[32px] flex items-center gap-1.5 text-left disabled:cursor-default"
      >
        {canExpand ? (
          <span className="text-ember-400">
            <DisclosureChevron open={open} className="h-3 w-3" />
          </span>
        ) : (
          <span className="w-3 shrink-0" aria-hidden="true" />
        )}
        <span className="text-bone-300 text-xs">{name}</span>
      </button>
      {open && canExpand && (
        // text-sm (14px) matches the readable body of the equipment weapon rules
        // and the model-detail special rules — the prose you read at the table.
        <p className="pl-[1.125rem] pr-1 pb-1.5 text-bone-300 text-sm whitespace-pre-line">{text}</p>
      )}
    </div>
  );
}
