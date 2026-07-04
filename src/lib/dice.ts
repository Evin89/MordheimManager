export function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export type D66Roll = { tens: number; units: number; key: string };

/** Rolls a D66 (two D6, read as tens/units digits) as used by the Serious Injury table. */
export function rollD66(): D66Roll {
  const tens = rollD6();
  const units = rollD6();
  return { tens, units, key: `${tens}${units}` };
}

export type D2D6Roll = { d1: number; d2: number; total: number };

/** Rolls 2D6 (summed) as used by the Rare item and Advance tables. */
export function roll2D6(): D2D6Roll {
  const d1 = rollD6();
  const d2 = rollD6();
  return { d1, d2, total: d1 + d2 };
}
