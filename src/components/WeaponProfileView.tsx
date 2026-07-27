import { strings } from '../strings';
import { WeaponProfile } from '../data/types';

type Props = {
  profile: WeaponProfile;
  /** "5 gc", "35 + 2D6 gc", ... — omitted when unknown/ambiguous. */
  cost?: string;
  /** "Common" or "Rare N" — omitted when unknown/ambiguous. */
  availability?: string;
};

/**
 * Renders a weapon/armour stat block in the rulebook's own layout: Cost and
 * Availability up top, an italic note, Range/Strength, then SPECIAL RULES with
 * each rule's name in bold. Shared by the shop/roster dropdowns, the Rules tab's
 * inline expanders, and the rule detail page.
 */
export default function WeaponProfileView({ profile, cost, availability }: Props) {
  const labels = strings.weaponRules;
  return (
    <div className="space-y-2 text-sm">
      {(cost || availability) && (
        <div>
          {cost && (
            <p className="text-bone-200">
              <span className="font-semibold text-bone-100">{labels.costLabel}:</span>{' '}
              <span className="text-ember-400">{cost}</span>
            </p>
          )}
          {availability && (
            <p className="text-bone-200">
              <span className="font-semibold text-bone-100">{labels.availabilityLabel}:</span> {availability}
            </p>
          )}
        </div>
      )}

      {profile.notes && <p className="text-bone-300 italic">{profile.notes}</p>}

      {(profile.range || profile.strength) && (
        <div>
          {profile.range && (
            <p className="text-bone-200">
              <span className="font-semibold text-bone-100">{labels.rangeLabel}:</span> {profile.range}
            </p>
          )}
          {profile.strength && (
            <p className="text-bone-200">
              <span className="font-semibold text-bone-100">{labels.strengthLabel}:</span> {profile.strength}
            </p>
          )}
        </div>
      )}

      {profile.specialRules.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-bone-100 font-semibold text-xs uppercase tracking-wide">{labels.specialRulesHeading}</p>
          {profile.specialRules.map((rule) => (
            <p key={rule.name} className="text-bone-200">
              <span className="font-semibold text-bone-100">{rule.name}:</span> {rule.text}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-bone-300">{labels.noSpecialRules}</p>
      )}
    </div>
  );
}
