import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { strings } from '../strings';
import DisclosureChevron from './DisclosureChevron';
import WeaponProfileView from './WeaponProfileView';
import { WeaponRule, getWeaponRuleByName } from '../lib/weaponRules';

type Props = {
  /** Display name of the weapon/armour item (used for the header and, if no rule is passed, the lookup). */
  name: string;
  /** Pre-resolved rule; if omitted it's looked up from the name. */
  rule?: WeaponRule;
  /** Header/toggle text when it should differ from the item name (e.g. "Weapon rules" in the shop). */
  toggleLabel?: string;
  /** Small secondary line under the name (e.g. cost, restriction). */
  subtitle?: ReactNode;
  /** Right-aligned control (Buy / Move to treasury / etc.). */
  action?: ReactNode;
  /** Borderless, tighter layout for embedding inside another card (e.g. the battle roster). */
  compact?: boolean;
};

/**
 * A weapon/armour row whose name expands to reveal its rules (range, Strength,
 * special rules) pulled from the Weapons & Armour chapter, with a link through to
 * the full Rules Reference entry. Items with no matching rules render as a plain
 * (non-expandable) row so the same component can be dropped in everywhere.
 */
export default function WeaponRulesDisclosure({ name, rule, toggleLabel, subtitle, action, compact }: Props) {
  const resolved = rule ?? getWeaponRuleByName(name);
  const [open, setOpen] = useState(false);
  const canExpand = !!resolved;
  const headerLabel = toggleLabel ?? name;

  const wrapperClass = compact ? '' : 'rounded-md bg-ink-900 border border-ink-800';
  const headerClass = compact ? 'flex items-center justify-between gap-3' : 'flex items-center justify-between gap-3 p-3';
  const nameClass = compact ? 'block text-bone-300 text-xs truncate' : 'block text-bone-100 truncate';
  const bodyPad = compact ? 'pb-1 space-y-1' : 'px-3 pb-3 -mt-1 space-y-2';

  return (
    <div className={wrapperClass}>
      <div className={headerClass}>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            // §5.4: this is a tap target, not just a label — the row was 24px
            // tall, which is hard to hit with a thumb over a crowded table.
            className="flex items-center gap-2 min-w-0 min-h-[44px] text-left"
            aria-expanded={open}
          >
            <span className="text-ember-400">
              <DisclosureChevron open={open} className="h-3 w-3" />
            </span>
            <span className="min-w-0">
              <span className={nameClass}>{headerLabel}</span>
              {subtitle && <span className="block text-bone-300 text-xs">{subtitle}</span>}
            </span>
          </button>
        ) : (
          <div className="min-w-0">
            <p className={compact ? 'text-bone-300 text-xs truncate' : 'text-bone-100 truncate'}>{headerLabel}</p>
            {subtitle && <p className="text-bone-300 text-xs">{subtitle}</p>}
          </div>
        )}
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {canExpand && open && (
        <div className={bodyPad}>
          {resolved!.profile ? (
            <WeaponProfileView profile={resolved!.profile} cost={resolved!.cost} availability={resolved!.availability} />
          ) : (
            <p className="text-bone-200 text-sm whitespace-pre-line">{resolved!.body}</p>
          )}
          <Link to={`/rules/${resolved!.ruleId}`} className="inline-block text-ember-400 text-xs font-semibold">
            {strings.weaponRules.fullEntry}
          </Link>
        </div>
      )}
    </div>
  );
}
