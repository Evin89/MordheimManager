import { StatLine } from '../types';

const STAT_WORD_MAP: Record<string, keyof StatLine> = {
  m: 'M',
  movement: 'M',
  ws: 'WS',
  weaponskill: 'WS',
  bs: 'BS',
  ballisticskill: 'BS',
  s: 'S',
  strength: 'S',
  t: 'T',
  toughness: 'T',
  w: 'W',
  wound: 'W',
  wounds: 'W',
  i: 'I',
  initiative: 'I',
  a: 'A',
  attack: 'A',
  attacks: 'A',
  ld: 'Ld',
  leadership: 'Ld',
};

function parseStatToken(token: string): keyof StatLine | undefined {
  return STAT_WORD_MAP[token.toLowerCase().replace(/[^a-z]/g, '')];
}

export type ParsedAdvance =
  | { kind: 'skill' }
  | { kind: 'fixedStat'; stat: keyof StatLine }
  | { kind: 'choice'; options: (keyof StatLine)[] }
  | { kind: 'rollAgain'; ranges: { lo: number; hi: number; stat: keyof StatLine }[] }
  | { kind: 'special' };

/**
 * Interprets the free-text advance table result (sourced verbatim from the rulebook) into a
 * structured shape the UI can act on. Handles every phrasing that appears in advances.json:
 * fixed "+1 X", "Choose either +1 X or +1 Y", "Roll again: 1-3 = +1 X; 4-6 = +1 Y", and
 * "New Skill...". Anything else (namely the henchmen "lad's got talent" promotion, which this
 * app's data model can't represent) falls back to 'special' for the caller to surface as text.
 */
export function parseAdvanceResult(result: string): ParsedAdvance {
  if (/lad's got talent/i.test(result)) return { kind: 'special' };
  if (/new skill/i.test(result)) return { kind: 'skill' };

  const rollAgainMatch = result.match(/roll again:\s*(.+)/i);
  if (rollAgainMatch) {
    const ranges: { lo: number; hi: number; stat: keyof StatLine }[] = [];
    const rangeRegex = /(\d)-(\d)\s*=\s*\+1\s+([A-Za-z]+)/g;
    let m: RegExpExecArray | null;
    while ((m = rangeRegex.exec(rollAgainMatch[1]))) {
      const stat = parseStatToken(m[3]);
      if (stat) ranges.push({ lo: Number(m[1]), hi: Number(m[2]), stat });
    }
    if (ranges.length > 0) return { kind: 'rollAgain', ranges };
  }

  if (/choose either/i.test(result)) {
    const options: (keyof StatLine)[] = [];
    const optRegex = /\+1\s+([A-Za-z]+)/g;
    let m: RegExpExecArray | null;
    while ((m = optRegex.exec(result))) {
      const stat = parseStatToken(m[1]);
      if (stat && !options.includes(stat)) options.push(stat);
    }
    if (options.length > 0) return { kind: 'choice', options };
  }

  const fixedMatch = result.match(/\+1\s+([A-Za-z]+)/);
  if (fixedMatch) {
    const stat = parseStatToken(fixedMatch[1]);
    if (stat) return { kind: 'fixedStat', stat };
  }

  return { kind: 'special' };
}
