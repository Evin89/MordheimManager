import wyrdstonePrices from '../data/wyrdstonePrices.json';

type SizeBand = '1-3' | '4-6' | '7-9' | '10-12' | '13-15' | '16+';

function bandForModelCount(modelCount: number): SizeBand {
  if (modelCount <= 3) return '1-3';
  if (modelCount <= 6) return '4-6';
  if (modelCount <= 9) return '7-9';
  if (modelCount <= 12) return '10-12';
  if (modelCount <= 15) return '13-15';
  return '16+';
}

/** Total gc profit (after upkeep) for selling `shardsSold` shards at once, per the core rulebook's selling table. */
export function getWyrdstoneSellPrice(shardsSold: number, modelCount: number): number {
  if (shardsSold <= 0) return 0;
  const rollKey = shardsSold >= 8 ? '8+' : String(shardsSold);
  const row = wyrdstonePrices.table.find((r) => r.shardsSold === rollKey);
  if (!row) return 0;
  const band = bandForModelCount(modelCount);
  return row.pricesByWarbandSize[band];
}
