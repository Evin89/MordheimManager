/**
 * Countries for player profiles (§38) — country only, never a region or city.
 *
 * Stored as an ISO 3166-1 alpha-2 code so the value is language-neutral; the
 * name is produced by `Intl.DisplayNames` at render time, which costs no
 * dependency. `Intl` can name a region but can't list them, so the codes are a
 * plain array here. No flag emoji: Windows renders them as two bare letters.
 */
const CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS ' +
  'BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE ' +
  'EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM ' +
  'HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC ' +
  'LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA ' +
  'NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO ' +
  'TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' ');

let displayNames: Intl.DisplayNames | null | undefined;

function names(): Intl.DisplayNames | null {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames([navigator.language || 'en', 'en'], { type: 'region' });
    } catch {
      displayNames = null;
    }
  }
  return displayNames;
}

/** "NL" → "Netherlands" (in the browser's language). Falls back to the code. */
export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  try {
    return names()?.of(code) ?? code;
  } catch {
    return code;
  }
}

export type CountryOption = { id: string; label: string };

/** Every country, A–Z by its displayed name. Built once, on first use. */
let options: CountryOption[] | null = null;
export function countryOptions(): CountryOption[] {
  if (!options) {
    options = CODES.map((id) => ({ id, label: countryName(id) })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }
  return options;
}

export function isCountryCode(code: string | null | undefined): boolean {
  return !!code && CODES.includes(code);
}
