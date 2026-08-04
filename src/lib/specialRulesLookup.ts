import specialRulesData from '../data/specialRules.json';
import {
  ResolvedSpecialRule,
  SharedSpecialRule,
  UnitSpecialRule,
} from '../data/types';

const SHARED = (specialRulesData as unknown as { rules: Record<string, SharedSpecialRule> }).rules;

export function getSharedSpecialRule(id: string): SharedSpecialRule | undefined {
  return SHARED[id];
}

/** Every shared rule, A–Z, for the rules browser. */
export function allSharedSpecialRules(): SharedSpecialRule[] {
  return Object.values(SHARED).sort((a, b) => a.name.localeCompare(b.name));
}

function isRef(rule: UnitSpecialRule): rule is Extract<UnitSpecialRule, { ref: string }> {
  return 'ref' in rule;
}

/** Substitutes `{range}`-style placeholders. */
function fill(text: string, params: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key) => params[key] ?? whole);
}

/**
 * Turns a stored rule into something renderable.
 *
 * A reference to a shared rule that doesn't exist resolves to a visible marker
 * rather than disappearing: a rule silently missing from a warrior's card is
 * the failure mode that matters here, since nobody would notice it was gone.
 */
export function resolveSpecialRule(rule: UnitSpecialRule): ResolvedSpecialRule {
  if (!isRef(rule)) return { name: rule.name, description: rule.description };

  const shared = getSharedSpecialRule(rule.ref);
  if (!shared) {
    return {
      name: rule.ref,
      description: `Unknown shared rule "${rule.ref}" — check specialRules.json.`,
      note: rule.note,
    };
  }

  const params = { ...(shared.params ?? {}), ...(rule.params ?? {}) };
  return {
    name: shared.name,
    description: fill(shared.description, params),
    note: rule.note,
    sharedId: shared.id,
  };
}

export function resolveSpecialRules(rules: UnitSpecialRule[] | undefined): ResolvedSpecialRule[] {
  return (rules ?? []).map(resolveSpecialRule);
}
