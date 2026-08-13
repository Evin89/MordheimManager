/** A single die of any number of sides. The one primitive the standalone roller
 * (§20.1) needs beyond the fixed D6/D66/2D6 the rest of the app already rolls. */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollD6(): number {
  return rollDie(6);
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

export type DiceExpressionRoll = { rolls: number[]; total: number };

const DICE_EXPRESSION = /^(\d*)D(\d+)(?:x(\d+))?(?:\+(\d+))?$/i;

/**
 * Rolls a rulebook dice expression: `D6`, `2D6`, `D3`, `D6+1`, `D6x10`, `2D6x5`, `5D6x5`.
 *
 * The multiplier applies to the summed dice, not to each die — "2D6x5 gc" in the
 * Exploration chart means roll two dice, add them, multiply by five, which is a very
 * different distribution from rolling two D30s. Returns the individual dice alongside
 * the total so the UI can show its working rather than an unexplained number.
 *
 * Throws on an unparseable expression: these come from our own data files, so a typo
 * is a bug to surface at the point of use, not a silent zero in someone's treasury.
 */
export function rollDiceExpression(expression: string): DiceExpressionRoll {
  const match = DICE_EXPRESSION.exec(expression.trim());
  if (!match) throw new Error(`Unrecognised dice expression: "${expression}"`);

  const [, countRaw, sidesRaw, multiplierRaw, bonusRaw] = match;
  const count = countRaw ? Number(countRaw) : 1;
  const sides = Number(sidesRaw);

  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  const sum = rolls.reduce((acc, n) => acc + n, 0);
  const total = sum * (multiplierRaw ? Number(multiplierRaw) : 1) + (bonusRaw ? Number(bonusRaw) : 0);

  return { rolls, total };
}
