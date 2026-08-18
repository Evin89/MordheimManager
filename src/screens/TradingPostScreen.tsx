import { Suspense, lazy, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import EquipmentShop from '../components/EquipmentShop';
import NumberInput from '../components/NumberInput';
import { Button, Card, SectionHeading } from '../components/ui';
import { strings } from '../strings';

// Lazy: see TabRules — keeps the rules catalogues out of this chunk too.
const TabRules = lazy(() => import('../components/TabRules'));
import { useSaveWarbandMutation, useWarbandLookup } from '../hooks/useWarbands';
import { useBattlesQuery, useMyCampaignQuery } from '../hooks/useCampaign';
import { generateId } from '../lib/id';
import { ResolvedEquipmentItem } from '../lib/equipmentLookup';
import { EQUIPMENT_CATEGORY_LABELS, groupByCategory } from '../lib/equipmentCategories';
import { hasFoughtFirstBattle } from '../lib/battleHistory';
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
    <Card padding="sm" gap="sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-bone-100">{item.name}</p>
        {!selling && (
          <button
            type="button"
            onClick={() => {
              setPrice(defaultPrice);
              setSelling(true);
            }}
            className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold shrink-0"
          >
            {strings.trading.sellButton}
          </button>
        )}
      </div>
      {selling && (
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-bone-300 text-xs">{strings.trading.sellPriceLabel}</span>
            <NumberInput
              value={price}
              onChange={setPrice}
              className="min-h-[40px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
            />
          </label>
          <Button
            size="dense"
            fullWidth={false}
            onClick={() => {
              if (window.confirm(strings.trading.sellConfirm(item.name, price))) {
                onSell(item.id, price);
              }
              setSelling(false);
            }}
          >
            {strings.trading.sellButton}
          </Button>
          <Button size="dense" variant="secondary" fullWidth={false} onClick={() => setSelling(false)}>
            {strings.common.cancel}
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function TradingPostScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const { warband, loading } = useWarbandLookup(warbandId);
  const saveWarband = useSaveWarbandMutation();
  const { data: campaign } = useMyCampaignQuery();
  const { data: battles } = useBattlesQuery(campaign?.id);
  const [tab, setTab] = useState<Tab>('shop');

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
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
            <Card gap="none">
              <p className="text-ember-400 font-semibold text-lg">
                {strings.trading.goldLabel}: {warband.gold} {strings.common.gold}
              </p>
            </Card>

            <EquipmentShop
              warband={warband}
              onPurchase={buyItem}
              skipRarityRoll={!hasFoughtFirstBattle(warband.id, battles)}
            />

            <section className="space-y-2">
              <SectionHeading>{strings.trading.treasurySection}</SectionHeading>
              {warband.treasury.length === 0 ? (
                <p className="text-bone-300 text-sm">{strings.trading.treasuryEmpty}</p>
              ) : (
                <>
                  <p className="text-bone-300 text-xs">{strings.trading.treasuryHint}</p>
                  {groupByCategory(warband.treasury).map(({ category, items }) => (
                    <div key={category} className="space-y-2">
                      <h3 className="inline-flex items-center min-h-[44px] text-ember-400 text-xs font-semibold uppercase tracking-wide pt-2">
                        {EQUIPMENT_CATEGORY_LABELS[category]}
                      </h3>
                      {items.map((item) => (
                        <TreasuryRow key={item.id} item={item} onSell={sellItem} />
                      ))}
                    </div>
                  ))}
                </>
              )}
            </section>
          </>
        ) : (
          <Suspense fallback={<p className="text-bone-300 text-sm">{strings.common.loading}</p>}>
            <TabRules tab="trading" />
          </Suspense>
        )}
      </main>
    </div>
  );
}
