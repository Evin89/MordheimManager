import { useState } from 'react';
import { strings } from '../strings';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { roll2D6 } from '../lib/dice';
import {
  ResolvedEquipmentItem,
  getUniversalCommonItems,
  getUniversalRareItems,
  getWarbandExclusiveItems,
  parseBasePrice,
} from '../lib/equipmentLookup';
import { Warband } from '../types';

type Tab = 'common' | 'rare';

function RareItemRow({
  item,
  onBuy,
}: {
  item: ResolvedEquipmentItem;
  onBuy: (item: ResolvedEquipmentItem, price: number) => void;
}) {
  const [rolling, setRolling] = useState(false);
  const [found, setFound] = useState(false);
  const [price, setPrice] = useState(0);
  const [lastAutoRoll, setLastAutoRoll] = useState<{ total: number; found: boolean } | null>(null);

  function autoRoll() {
    if (item.rarity === null) return;
    const { total } = roll2D6();
    const success = total >= item.rarity;
    setLastAutoRoll({ total, found: success });
    setFound(success);
  }

  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-bone-100 font-semibold truncate">{item.name}</p>
          <p className="text-bone-300 text-sm">
            {item.rarity !== null ? strings.trading.rarityLabel(item.rarity) : ''} · {item.priceRange ?? '?'}
          </p>
          {item.restriction && (
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-bone-300">
              {item.restriction}
            </span>
          )}
        </div>
        {!rolling && (
          <button
            type="button"
            onClick={() => {
              setRolling(true);
              setFound(false);
              setPrice(parseBasePrice(item.priceRange));
              setLastAutoRoll(null);
            }}
            className="min-h-[40px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm font-semibold shrink-0"
          >
            {strings.trading.rollButton}
          </button>
        )}
      </div>

      {item.notes && <p className="text-bone-300 text-xs">{item.notes}</p>}

      {rolling && lastAutoRoll && (
        <p className="text-bone-300 text-xs">
          {strings.trading.autoRollResultLabel(lastAutoRoll.total, lastAutoRoll.found)}
        </p>
      )}

      {rolling && !found && (
        <div className="space-y-2 rounded-md bg-ink-800 border border-ink-700 p-3">
          <p className="text-bone-300 text-sm">{strings.trading.rollHint}</p>
          {item.rarity !== null && (
            <button
              type="button"
              onClick={autoRoll}
              className="w-full min-h-[40px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm"
            >
              {strings.trading.autoRollButton}
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFound(true)}
              className="flex-1 min-h-[40px] rounded-md border border-ink-700 text-bone-200 text-sm font-semibold"
            >
              {strings.trading.foundButton}
            </button>
            <button
              type="button"
              onClick={() => setRolling(false)}
              className="flex-1 min-h-[40px] rounded-md border border-ink-700 text-bone-200 text-sm"
            >
              {strings.trading.notFoundButton}
            </button>
          </div>
        </div>
      )}

      {rolling && found && (
        <div className="space-y-2 rounded-md bg-ink-800 border border-ink-700 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-bone-300 text-xs">{strings.trading.priceLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={price}
              onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
              className="min-h-[44px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onBuy(item, price);
                setRolling(false);
              }}
              className="flex-1 min-h-[40px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm"
            >
              {strings.trading.confirmPurchase}
            </button>
            <button
              type="button"
              onClick={() => setRolling(false)}
              className="flex-1 min-h-[40px] rounded-md border border-ink-700 text-bone-200 text-sm"
            >
              {strings.common.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type EquipmentShopProps = {
  warband: Warband;
  onPurchase: (item: ResolvedEquipmentItem, price: number) => void;
};

/** The buy-side of the Trading Post (Common + Rare tabs), reusable anywhere a warband can spend gold on gear. */
export default function EquipmentShop({ warband, onPurchase }: EquipmentShopProps) {
  const [tab, setTab] = useState<Tab>('common');

  const definition = getWarbandDefinition(warband.warbandType);
  const exclusiveItems = definition ? getWarbandExclusiveItems(definition) : [];
  const commonItems = [...getUniversalCommonItems(), ...exclusiveItems.filter((i) => !i.isRare)];
  const rareItems = [...getUniversalRareItems(), ...exclusiveItems.filter((i) => i.isRare)];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('common')}
          className={`flex-1 min-h-[44px] rounded-md border font-semibold ${
            tab === 'common' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
          }`}
        >
          {strings.trading.commonTab}
        </button>
        <button
          type="button"
          onClick={() => setTab('rare')}
          className={`flex-1 min-h-[44px] rounded-md border font-semibold ${
            tab === 'rare' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
          }`}
        >
          {strings.trading.rareTab}
        </button>
      </div>

      {tab === 'common' && (
        <div className="space-y-2">
          {commonItems.map((item) => (
            <div
              key={item.id}
              className="rounded-lg bg-ink-900 border border-ink-800 p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-bone-100 font-semibold truncate">{item.name}</p>
                <p className="text-bone-300 text-sm">
                  {item.cost ?? '?'} {strings.common.gold}
                </p>
                {item.restriction && (
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-bone-300">
                    {item.restriction}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onPurchase(item, item.cost ?? 0)}
                className="min-h-[40px] px-3 rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm shrink-0"
              >
                {strings.trading.buyButton(item.cost ?? 0)}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'rare' && (
        <div className="space-y-2">
          {rareItems.map((item) => (
            <RareItemRow key={item.id} item={item} onBuy={onPurchase} />
          ))}
        </div>
      )}
    </div>
  );
}
