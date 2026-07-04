import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { generateId } from '../lib/id';
import {
  ResolvedEquipmentItem,
  getUniversalCommonItems,
  getUniversalRareItems,
  getWarbandExclusiveItems,
  parseBasePrice,
} from '../lib/equipmentLookup';
import { EquipmentItem, Warband } from '../types';

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
            }}
            className="min-h-[40px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm font-semibold shrink-0"
          >
            {strings.trading.rollButton}
          </button>
        )}
      </div>

      {item.notes && <p className="text-bone-300 text-xs">{item.notes}</p>}

      {rolling && !found && (
        <div className="space-y-2 rounded-md bg-ink-800 border border-ink-700 p-3">
          <p className="text-bone-300 text-sm">{strings.trading.rollHint}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFound(true)}
              className="flex-1 min-h-[40px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm"
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

function TreasuryRow({
  item,
  onSell,
}: {
  item: EquipmentItem;
  onSell: (itemId: string, price: number) => void;
}) {
  const defaultPrice = Math.floor((item.cost ?? 0) / 2);
  const [selling, setSelling] = useState(false);
  const [price, setPrice] = useState(defaultPrice);

  return (
    <div className="rounded-md bg-ink-900 border border-ink-800 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-bone-100">{item.name}</p>
        {!selling && (
          <button
            type="button"
            onClick={() => {
              setPrice(defaultPrice);
              setSelling(true);
            }}
            className="text-ember-400 text-sm font-semibold shrink-0"
          >
            {strings.trading.sellButton}
          </button>
        )}
      </div>
      {selling && (
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-bone-300 text-xs">{strings.trading.sellPriceLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={price}
              onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
              className="min-h-[40px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(strings.trading.sellConfirm(item.name, price))) {
                onSell(item.id, price);
              }
              setSelling(false);
            }}
            className="min-h-[40px] px-3 rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm"
          >
            {strings.trading.sellButton}
          </button>
          <button
            type="button"
            onClick={() => setSelling(false)}
            className="min-h-[40px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm"
          >
            {strings.common.cancel}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TradingPostScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const warband = useAppStore((state) => state.warbands.find((w) => w.id === warbandId));
  const saveWarband = useAppStore((state) => state.saveWarband);
  const [tab, setTab] = useState<Tab>('common');

  if (!warband) return <Navigate to="/warbands" replace />;

  const definition = getWarbandDefinition(warband.warbandType);
  const exclusiveItems = definition ? getWarbandExclusiveItems(definition) : [];
  const commonItems = [...getUniversalCommonItems(), ...exclusiveItems.filter((i) => !i.isRare)];
  const rareItems = [...getUniversalRareItems(), ...exclusiveItems.filter((i) => i.isRare)];

  function buyItem(item: ResolvedEquipmentItem, price: number) {
    if (!warband) return;
    if (price > warband.gold) {
      if (!window.confirm(strings.trading.insufficientGoldConfirm(price, warband.gold))) return;
    }
    const newItem: EquipmentItem = {
      id: generateId(),
      name: item.name,
      category: item.category,
      cost: price,
      notes: item.restriction || undefined,
    };
    const updated: Warband = { ...warband, gold: warband.gold - price, treasury: [...warband.treasury, newItem] };
    saveWarband(updated);
  }

  function sellItem(itemId: string, price: number) {
    if (!warband) return;
    const item = warband.treasury.find((e) => e.id === itemId);
    if (!item) return;
    const updated: Warband = {
      ...warband,
      gold: warband.gold + price,
      treasury: warband.treasury.filter((e) => e.id !== itemId),
    };
    saveWarband(updated);
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.nav.trading} subtitle={warband.name} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="rounded-lg bg-ink-900 border border-ink-800 p-4">
          <p className="text-ember-400 font-semibold text-lg">
            {strings.trading.goldLabel}: {warband.gold} {strings.common.gold}
          </p>
        </div>

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
              <div key={item.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-bone-100 font-semibold truncate">{item.name}</p>
                  <p className="text-bone-300 text-sm">{item.cost ?? '?'} {strings.common.gold}</p>
                  {item.restriction && (
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-bone-300">
                      {item.restriction}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => buyItem(item, item.cost ?? 0)}
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
              <RareItemRow key={item.id} item={item} onBuy={buyItem} />
            ))}
          </div>
        )}

        <section className="space-y-2">
          <h2 className="text-bone-100 font-semibold">{strings.trading.treasurySection}</h2>
          {warband.treasury.length === 0 ? (
            <p className="text-bone-300 text-sm">{strings.trading.treasuryEmpty}</p>
          ) : (
            <>
              <p className="text-bone-300 text-xs">{strings.trading.treasuryHint}</p>
              <div className="space-y-2">
                {warband.treasury.map((item) => (
                  <TreasuryRow key={item.id} item={item} onSell={sellItem} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
