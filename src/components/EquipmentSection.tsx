import { ReactNode, useEffect, useRef, useState } from 'react';
import { EquipmentItem } from '../types';
import { strings } from '../strings';
import { MAX_MELEE, MAX_MISSILE_TYPES, countWeaponSlots } from '../lib/weaponSlots';
import WeaponRulesDisclosure from './WeaponRulesDisclosure';
import ConfirmByTyping from './ConfirmByTyping';
import { Button, SectionHeading } from './ui';

/**
 * The equipment block shared by the Hero / Hired Sword detail screen and the
 * Henchmen group detail screen (§4.2): what the model carries, the shop, and
 * the warband's treasury to assign from.
 *
 * It was ~150 lines copied between the two screens, which is how they had
 * already started to drift. The screens keep what genuinely differs — how a
 * purchase is priced (per model for a group), which list the shop offers and
 * where the item lands — and pass it in.
 */
export function EquipmentSection({
  equipment,
  treasury,
  gold,
  onMoveToTreasury,
  onAssignFromTreasury,
  shop,
  purchasePanel,
  footer,
}: {
  /** What this model (or every model in the group) carries. */
  equipment: EquipmentItem[];
  treasury: EquipmentItem[];
  gold: number;
  onMoveToTreasury: (itemId: string) => void;
  onAssignFromTreasury: (itemId: string) => void;
  /** The `<EquipmentShop>` configured for this buyer. */
  shop: ReactNode;
  /** `usePurchase().panel` — the inline confirm or weapon-limit notice. */
  purchasePanel: ReactNode;
  /** Anything after the treasury, e.g. the equipment history log. */
  footer?: ReactNode;
}) {
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const usage = countWeaponSlots(equipment);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeading>{strings.modelDetail.equipmentSection}</SectionHeading>
        {/* Shown rather than only enforced: knowing a slot is full before
            you go shopping beats being refused at the till. */}
        <p className="text-ink-faded text-sm">
          {strings.modelDetail.weaponSlots(usage.melee, MAX_MELEE, usage.missileTypes, MAX_MISSILE_TYPES)}
        </p>
        <button
          type="button"
          onClick={() => setShoppingOpen((v) => !v)}
          className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold shrink-0"
        >
          {shoppingOpen ? strings.modelDetail.hideShop : strings.modelDetail.buyEquipment}
        </button>
      </div>
      {equipment.length === 0 && <p className="text-bone-300 text-sm">{strings.modelDetail.noEquipment}</p>}
      <ItemList
        items={equipment}
        actionLabel={strings.modelDetail.moveToTreasury}
        onAction={onMoveToTreasury}
      />

      {purchasePanel}

      {shoppingOpen && (
        <div className="space-y-3 rounded-lg border border-ink-800 p-3">
          <p className="text-ember-400 font-semibold text-sm">
            {strings.modelDetail.shopGoldLabel}: {gold} {strings.common.gold}
          </p>
          {shop}
        </div>
      )}

      <h3 className="text-bone-200 text-sm font-semibold pt-2">{strings.modelDetail.treasurySection}</h3>
      {treasury.length === 0 && <p className="text-bone-300 text-sm">{strings.modelDetail.noTreasury}</p>}
      <ItemList
        items={treasury}
        actionLabel={strings.modelDetail.assignToModel}
        onAction={onAssignFromTreasury}
      />

      {footer}
    </section>
  );
}

function ItemList({
  items,
  actionLabel,
  onAction,
}: {
  items: EquipmentItem[];
  actionLabel: string;
  onAction: (itemId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <WeaponRulesDisclosure
          key={item.id}
          name={item.name}
          action={
            <button
              type="button"
              onClick={() => onAction(item.id)}
              className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold shrink-0"
            >
              {actionLabel}
            </button>
          }
        />
      ))}
    </div>
  );
}

/**
 * "Remove from warband", the same on both detail screens.
 *
 * Unrecoverable — the model's gear, XP and advances go with it — so it takes
 * the type-the-name tier (§10.1), not the one-tap ConfirmAction.
 */
export function RemoveModelControl({ name, onRemove }: { name: string; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  // A blank group name would make the phrase empty and the gate meaningless.
  const phrase = name.trim() || strings.modelDetail.deleteModelFallbackPhrase;
  // It opens at the very bottom of a long screen; bring it into view.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirming) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [confirming]);
  return confirming ? (
    <div ref={ref} className="space-y-2">
      <ConfirmByTyping
        phrase={phrase}
        label={strings.modelDetail.deleteModelTypeLabel(phrase)}
        action={strings.modelDetail.deleteModel}
        impact={
          <>
            <p className="text-bone-100 font-semibold">{strings.modelDetail.deleteModelConfirm(phrase)}</p>
            <p>{strings.modelDetail.deleteModelImpact}</p>
          </>
        }
        onConfirm={onRemove}
      />
      <Button variant="secondary" onClick={() => setConfirming(false)}>
        {strings.common.cancel}
      </Button>
    </div>
  ) : (
    <Button variant="danger" onClick={() => setConfirming(true)}>
      {strings.modelDetail.deleteModel}
    </Button>
  );
}
