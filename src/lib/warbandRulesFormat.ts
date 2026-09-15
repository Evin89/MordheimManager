// Warband special rules are stored as one free-text blob per warband (the
// `specialRules` string on a WarbandDefinition), with ` | ` between distinct
// notes and named rules written run-in as "Name: description" — plus the odd
// internal data note the extraction left behind. The rules browser rendered the
// whole thing as a single paragraph. This parses it into the shape the rulebook
// uses: a short lead-in, then each named rule as a bold run-in heading.

export type WarbandRule = { name: string; text: string };
export type ParsedWarbandRules = { lead: string[]; rules: WarbandRule[] };

// Data-entry notes that must never reach a reader: the "TODO:" verification
// markers and the recurring "Human models use the standard … Maximum Profile"
// boilerplate the extraction appended for our own bookkeeping.
const DEV_NOTE = /^(TODO\b|Human models use the standard)/i;

// A run-in rule heading: a short capitalised label ending in a colon.
const LABEL = "[A-Z][A-Za-z'’ \\-]{1,34}";
const NAMED = new RegExp(`^(${LABEL}):\\s+([\\s\\S]+)$`);

// Split a segment before a sentence that starts a new named rule ("… foo.
// Marksmanship: …"), so rules packed into one sentence run come apart. Lookahead
// only (no lookbehind) for broad browser support; a sentinel marks the cut.
const SENTENCE_BREAK = new RegExp(`\\.\\s+(?=${LABEL}:\\s)`, 'g');
const SENTINEL = '';

/** Parse a warband's `specialRules` blob into a lead-in plus named rules. */
export function parseWarbandSpecialRules(body: string): ParsedWarbandRules {
  const segments = body
    .split(' | ')
    .flatMap((s) => s.replace(SENTENCE_BREAK, `.${SENTINEL}`).split(SENTINEL))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !DEV_NOTE.test(s));

  const lead: string[] = [];
  const rules: WarbandRule[] = [];
  for (const seg of segments) {
    const match = seg.match(NAMED);
    if (match) rules.push({ name: match[1].trim(), text: match[2].trim() });
    else lead.push(seg);
  }
  return { lead, rules };
}
