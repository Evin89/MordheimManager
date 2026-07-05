import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import EquipmentShop from '../components/EquipmentShop';
import RuleEntryList from '../components/RuleEntryList';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { generateId } from '../lib/id';
import { ResolvedEquipmentItem } from '../lib/equipmentLookup';
import { hasFoughtFirstBattle } from '../lib/battleHistory';
import { getTradingTabRuleEntries } from '../lib/rulesIndex';
import { EquipmentItem, Warband } from '../types';

type Tab = 'shop' | 'rules';

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
  const campaign = useAppStore((state) => state.campaign);
  const [tab, setTab] = useState<Tab>('shop');
  const ruleEntries = getTradingTabRuleEntries();

  if (!warband) return <Navigate to="/warbands" replace />;

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

      <div className="px-4 pt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('shop')}
          className={`flex-1 min-h-[40px] rounded-md border text-sm font-semibold ${
            tab === 'shop' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
          }`}
        >
          {strings.trading.shopTab}
        </button>
        <button
          type="button"
          onClick={() => setTab('rules')}
          className={`flex-1 min-h-[40px] rounded-md border text-sm font-semibold ${
            tab === 'rules' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
          }`}
        >
          {strings.trading.rulesTab}
        </button>
      </div>

      <main className="flex-1 px-4 py-4 space-y-6">
        {tab === 'shop' ? (
          <>
            <div className="rounded-lg bg-ink-900 border border-ink-800 p-4">
              <p className="text-ember-400 font-semibold text-lg">
                {strings.trading.goldLabel}: {warband.gold} {strings.common.gold}
              </p>
            </div>

            <EquipmentShop
              warband={warband}
              onPurchase={buyItem}
              skipRarityRoll={!hasFoughtFirstBattle(warband.id, campaign)}
            />

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
          </>
        ) : (
          <RuleEntryList entries={ruleEntries} emptyMessage={strings.rules.noEntriesInCategory} />
        )}
      </main>
    </div>
  );
}
