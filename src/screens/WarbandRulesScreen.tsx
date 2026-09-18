import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { buttonClasses } from '../components/ui';
import { getWarbandDefinition, getWarbandProvenance } from '../data/warbandRegistry';
import { parseWarbandSpecialRules, WarbandRule } from '../lib/warbandRulesFormat';
import { resolveSpecialRules } from '../lib/specialRulesLookup';
import { getSkillList } from '../lib/skillLookup';
import { getRacialProfile } from '../lib/racialMaximums';
import { resolveEquipmentItem } from '../lib/equipmentLookup';
import { groupByCategory, EQUIPMENT_CATEGORY_SHORT_LABELS } from '../lib/equipmentCategories';
import { STAT_KEYS } from '../lib/statLine';
import {
  HeroSlotDefinition,
  HenchmenTypeDefinition,
  NullableStatLine,
  WarbandDefinition,
} from '../data/types';

/**
 * The warband reference view (spec §5.4): every rule for one warband type, laid
 * out as a single anchored scroll so a reader can answer "how does it work, what
 * choices do I have, how does it play" without opening the builder.
 *
 * Read-only and keyed off the warband *definition*, so it works signed-out and
 * renders only what the data carries — the spec's idealised fields (playstyle
 * summary, a separate background blob, a skill matrix) that this dataset does not
 * hold are derived where they can be and omitted where they can't, never faked
 * (§3.3). Public route `/rules/warbands/:warbandSlug`; the `/warbands/:id` space
 * is the guarded roster, which is why this sits in the Rules reference family.
 */

// The five standard skill lists, in the rulebook's own column order. Names come
// from skills.json so the label can't drift from the data.
const STANDARD_SKILL_KEYS = ['combat', 'shooting', 'academic', 'strength', 'speed'] as const;
const STANDARD_SKILL_SET = new Set<string>(STANDARD_SKILL_KEYS);

// Special rules that change legality or army-wide behaviour get a boxed callout
// (§5.4.7). Matched on the rule's name or text — a small allowlist, so an
// ordinary rule stays plain rather than every rule shouting.
const STRUCTURAL_RULE =
  /\b(hatred|hate|animosity|stupid|frenzy|fear|terror|magic|wizard|spell|prayer|pray|ritual|mount|steed|may never|may not|cannot|immune|all\s+\w+\s+must)\b/i;

function humanizeList(key: string): string {
  const words = key
    .replace(/EquipmentList$|List$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} equipment list`;
}

type Unit = HeroSlotDefinition | HenchmenTypeDefinition;
const isHeroSlot = (u: Unit): u is HeroSlotDefinition => 'skillLists' in u;

/** The raw racial/own maximums for a unit, or null when it has no ceiling (an
 * animal, or a race with no published profile) — so the max row reads "—" per
 * §5.4.12 rather than a fabricated line of zeros. */
function rawMaximums(unit: Unit): NullableStatLine | null {
  if (unit.racialProfile) {
    const profile = getRacialProfile(unit.racialProfile);
    if (profile) return profile.statMaximums;
  }
  const own = unit.statMaximums;
  if (own && Object.values(own).some((v) => v !== null)) return own;
  return null;
}

/** The recruitment idiom the rulebook prints for a unit's limit. */
function recruitLimit(unit: Unit): string {
  const isLeader = isHeroSlot(unit) && unit.isLeader;
  if (isLeader && unit.maxCount === 1) return 'Must include 1';
  if (unit.maxCount == null) return 'Any number';
  return unit.maxCount === 1 ? '0–1' : `0–${unit.maxCount}`;
}

const anchorFor = (unit: Unit) => `unit-${unit.id}`;

// ── Small shared pieces ──────────────────────────────────────────────────────

type ChipTone = 'accent' | 'muted' | 'verdigris' | 'struck';
const CHIP_TONES: Record<ChipTone, string> = {
  accent: 'bg-ember-500/15 text-ember-400 border border-ember-500/40',
  muted: 'bg-ink-800 text-bone-300 border border-ink-700',
  verdigris: 'text-verdigris border border-verdigris/50',
  struck: 'text-bone-400 border border-ink-800 line-through',
};

function Chip({ children, tone = 'muted' }: { children: React.ReactNode; tone?: ChipTone }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-ui text-xs whitespace-nowrap ${CHIP_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** The §5.3 profile block, read-only and null-tolerant, with the max row always
 * beneath it (a number per cell, or "—" where the race has no ceiling). */
function StatTable({ stats, maximums }: { stats: NullableStatLine; maximums: NullableStatLine | null }) {
  return (
    <div className="overflow-x-auto border-2 border-ink bg-parchment-raised ring-1 ring-inset ring-ink/35">
      <table className="w-full border-collapse tabular-nums lining-nums">
        <thead>
          <tr>
            {STAT_KEYS.map((key) => (
              <th
                key={key}
                scope="col"
                className="font-heading-sc text-ink border-b-2 border-ink font-normal uppercase tracking-[0.05em] text-stat-min px-1.5 py-1 sm:px-3 sm:py-1.5"
              >
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {STAT_KEYS.map((key) => (
              <td key={key} className="font-body text-ink text-center text-stat-min px-1.5 py-1.5 sm:px-3 sm:py-2 sm:text-base">
                {stats[key] ?? '–'}
              </td>
            ))}
          </tr>
          <tr>
            {STAT_KEYS.map((key) => (
              <td
                key={key}
                className="font-ui text-ink-faded border-t border-ink/25 text-center text-xs px-1.5 py-1 sm:px-3"
              >
                <span className="sr-only">Maximum </span>
                {maximums ? maximums[key] ?? '—' : '—'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────

/** §5.4.6 — collapsed behind a toggle on phones, open on tablet+. */
function Background({ paragraphs }: { paragraphs: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="sm:hidden text-ember-400 text-sm font-semibold min-h-[44px]"
      >
        {open ? 'Hide background' : 'Read background'}
      </button>
      <div className={`${open ? 'block' : 'hidden'} sm:block space-y-3`}>
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className={`text-bone-200 leading-relaxed ${
              i === 0
                ? 'first-letter:font-display first-letter:text-4xl first-letter:leading-none first-letter:float-left first-letter:mr-2 first-letter:text-ember-400'
                : ''
            }`}
          >
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}

function SpecialRules({ rules }: { rules: WarbandRule[] }) {
  return (
    <div className="space-y-3">
      {rules.map((rule, i) => {
        const boxed = STRUCTURAL_RULE.test(`${rule.name} ${rule.text}`);
        return (
          <div
            key={i}
            className={
              boxed
                ? 'rounded-r bg-ink-900 border-l-[3px] border-ember-500 pl-3 py-2 pr-3 text-sm leading-relaxed'
                : 'text-sm leading-relaxed'
            }
          >
            <span className="font-semibold text-bone-100">{rule.name}.</span>{' '}
            <span className="text-bone-200">{rule.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChoiceOfWarriors({ def }: { def: WarbandDefinition }) {
  const rows: { label: string; limit: string; anchor: string }[] = [
    ...def.heroSlots.map((u) => ({ label: u.unitType, limit: recruitLimit(u), anchor: anchorFor(u) })),
  ];
  const henchRows = def.henchmenTypes.map((u) => ({
    label: u.unitType,
    limit: recruitLimit(u),
    anchor: anchorFor(u),
  }));

  const budget = [
    def.startingGold != null ? `${def.startingGold} gc` : null,
    def.minWarbandSize != null ? `min ${def.minWarbandSize}` : null,
    def.maxWarbandSize != null ? `max ${def.maxWarbandSize}` : null,
  ].filter(Boolean);

  const Group = ({ heading, items }: { heading: string; items: typeof rows }) =>
    items.length === 0 ? null : (
      <div className="space-y-1">
        <p className="font-heading-sc text-bone-400 text-xs uppercase tracking-wide">{heading}</p>
        <ul className="divide-y divide-ink-800">
          {items.map((r) => (
            <li key={r.anchor} className="flex items-baseline justify-between gap-3 py-1.5">
              <a href={`#${r.anchor}`} className="text-bone-100 hover:text-ember-400">
                {r.label}
              </a>
              <span className="font-ui text-xs text-bone-300 whitespace-nowrap">{r.limit}</span>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="space-y-4">
      {budget.length > 0 && (
        <p className="text-bone-300 text-sm">
          <span className="text-bone-100 font-semibold">Budget: </span>
          {budget.join(' · ')}
        </p>
      )}
      <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-4">
        <Group heading="Heroes" items={rows} />
        <Group heading="Henchmen" items={henchRows} />
      </div>
      <p className="text-bone-400 text-xs leading-relaxed">
        Heroes are recruited and advance individually, and may carry rare items. Henchmen fight in
        groups of identical warriors that share a single Experience total.
      </p>
    </div>
  );
}

function SkillAccess({ heroes }: { heroes: HeroSlotDefinition[] }) {
  return (
    <div className="grid grid-cols-1 min-[460px]:grid-cols-2 lg:grid-cols-3 gap-3">
      {heroes.map((hero) => {
        const has = new Set(hero.skillLists);
        const special = hero.skillLists.filter((k) => !STANDARD_SKILL_SET.has(k));
        return (
          <div key={hero.id} className="rounded-lg bg-ink-900 border border-ink-800 p-3 space-y-2">
            <p className="text-bone-100 font-semibold text-sm">{hero.unitType}</p>
            <div className="flex flex-wrap gap-1.5">
              {STANDARD_SKILL_KEYS.map((key) => {
                const name = getSkillList(key)?.name ?? key;
                return (
                  <Chip key={key} tone={has.has(key) ? 'accent' : 'struck'}>
                    {name}
                  </Chip>
                );
              })}
              {special.length > 0 && (
                <a href="#special-skills">
                  <Chip tone="verdigris">Special</Chip>
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SpecialSkills({ keys }: { keys: string[] }) {
  return (
    <div className="space-y-4">
      <p className="text-bone-400 text-xs leading-relaxed">
        These may be chosen in place of a standard skill-list skill where the rules allow.
      </p>
      {keys.map((key) => {
        const list = getSkillList(key);
        if (!list) return null;
        return (
          <div key={key} className="space-y-2">
            <h3 className="text-bone-100 font-semibold">{list.name}</h3>
            <dl className="space-y-2">
              {list.skills.map((skill) => (
                <div key={skill.id} className="text-sm leading-relaxed">
                  <dt className="inline font-semibold text-bone-100">{skill.name}.</dt>{' '}
                  <dd className="inline text-bone-200">{skill.effect}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

function EquipmentLists({ def }: { def: WarbandDefinition }) {
  return (
    <div className="space-y-6">
      {Object.entries(def.equipmentLists).map(([listKey, ids]) => {
        const items = ids
          .map((id) => resolveEquipmentItem(id, def))
          .filter((i): i is NonNullable<typeof i> => !!i);
        const groups = groupByCategory(items);
        if (groups.length === 0) return null;
        return (
          <div key={listKey} className="space-y-3">
            <h3 className="text-bone-100 font-semibold">{humanizeList(listKey)}</h3>
            {groups.map((group) => (
              <div key={group.category} className="space-y-1">
                <p className="font-heading-sc text-bone-400 text-xs uppercase tracking-wide">
                  {EQUIPMENT_CATEGORY_SHORT_LABELS[group.category]}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-baseline gap-2 text-sm">
                      <span className="text-bone-200">{item.name}</span>
                      {item.rarity != null && <Chip tone="verdigris">Rare ({item.rarity})</Chip>}
                      <span className="flex-1 border-b border-dotted border-ink-700 translate-y-[-0.2em]" />
                      <span className="font-ui text-xs text-bone-300 tabular-nums whitespace-nowrap">
                        {item.priceRange ?? '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })}
      <p className="text-bone-400 text-xs">Prices are for reference. Buying happens in the builder.</p>
    </div>
  );
}

function UnitCard({ unit }: { unit: Unit }) {
  const hero = isHeroSlot(unit) ? unit : null;
  const isAnimal = !isHeroSlot(unit) && unit.isAnimal;
  const rules = resolveSpecialRules(unit.specialRules);
  const lists = unit.equipmentOptions.map(humanizeList);

  return (
    <article id={anchorFor(unit)} className="scroll-mt-24 rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-bone-100 font-semibold text-lg">{unit.unitType}</h3>
        <span className="font-ui text-sm text-bone-300 whitespace-nowrap">
          {unit.cost != null ? `${unit.cost} gc` : '—'}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip tone="muted">{hero ? 'Hero' : 'Henchman'}</Chip>
        {hero?.isLeader && <Chip tone="accent">Leader</Chip>}
        {unit.isLargeCreature && <Chip tone="muted">Large</Chip>}
        {isAnimal && <Chip tone="muted">Animal — no XP</Chip>}
        <Chip tone="muted">{recruitLimit(unit)}</Chip>
        {!hero && !isAnimal && <Chip tone="muted">Groups of identical warriors</Chip>}
      </div>

      {unit.notes && <p className="text-bone-300 text-sm leading-relaxed">{unit.notes}</p>}

      <StatTable stats={unit.statLine} maximums={rawMaximums(unit)} />

      {lists.length > 0 && (
        <p className="text-bone-300 text-sm">
          <span className="text-bone-200 font-semibold">Weapons &amp; armour: </span>
          <a href="#equipment" className="hover:text-ember-400">
            {lists.join(', ')}
          </a>
        </p>
      )}

      {rules.length > 0 && (
        <dl className="space-y-1.5">
          {rules.map((rule, i) => (
            <div key={i} className="text-sm leading-relaxed">
              <dt className="inline font-semibold text-bone-100">{rule.name}.</dt>{' '}
              <dd className="inline text-bone-200">{rule.description}</dd>
              {rule.note && <span className="text-bone-300"> {rule.note}</span>}
            </div>
          ))}
        </dl>
      )}

      {hero && hero.startingXp != null && (
        <div>
          <Chip tone="accent">Starts with {hero.startingXp} XP</Chip>
        </div>
      )}
    </article>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

type NavItem = { id: string; label: string };

/** A sticky jump-nav with scroll-spy: chips that scroll horizontally on a phone,
 * an inline row on tablet+, the section nearest the top highlighted (§5.4.14). */
function JumpNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A band near the top of the viewport: the section crossing it is "current".
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-ink-950/95 backdrop-blur border-b border-ink-800">
      <ul className="flex gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`inline-flex items-center rounded px-2.5 py-1 font-ui text-xs whitespace-nowrap border ${
                active === item.id
                  ? 'bg-ember-500/15 text-ember-400 border-ember-500/40'
                  : 'text-bone-300 border-ink-700 hover:text-bone-100'
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function WarbandRulesScreen() {
  const { warbandSlug } = useParams<{ warbandSlug: string }>();
  const def = warbandSlug ? getWarbandDefinition(warbandSlug) : undefined;

  // Parse the special-rules blob once: its lead-in is the closest thing the data
  // has to a background, and its named rules are the Special Rules section.
  const parsed = useMemo(() => (def ? parseWarbandSpecialRules(def.specialRules) : null), [def]);

  // Warband-specific ("Special") skill lists are whatever a Hero draws on beyond
  // the five standard lists — collected across heroes, de-duplicated.
  const specialSkillKeys = useMemo(() => {
    if (!def) return [];
    const keys = new Set<string>();
    for (const hero of def.heroSlots)
      for (const key of hero.skillLists) if (!STANDARD_SKILL_SET.has(key)) keys.add(key);
    return [...keys].filter((k) => getSkillList(k));
  }, [def]);

  const topRef = useRef<HTMLDivElement>(null);

  if (!def || !parsed) return <Navigate to="/rules" replace />;

  const { source, grade } = getWarbandProvenance(def);
  const fanMade = source !== 'Core rulebook';
  const heroCap = def.heroSlots.every((s) => s.maxCount != null)
    ? def.heroSlots.reduce((sum, s) => sum + (s.maxCount ?? 0), 0)
    : null;

  const keyFacts = [
    def.startingGold != null ? `${def.startingGold} gc starting gold` : null,
    def.minWarbandSize != null && def.maxWarbandSize != null
      ? `${def.minWarbandSize}–${def.maxWarbandSize} models`
      : null,
    heroCap != null ? `Up to ${heroCap} Heroes` : null,
  ].filter(Boolean);

  const hasSkillAccess = def.heroSlots.some((s) => s.skillLists.length > 0);
  const sections: NavItem[] = [
    parsed.lead.length > 0 && { id: 'background', label: 'Background' },
    parsed.rules.length > 0 && { id: 'special-rules', label: 'Special rules' },
    { id: 'choice', label: 'Warriors' },
    hasSkillAccess && { id: 'skill-access', label: 'Skills' },
    specialSkillKeys.length > 0 && { id: 'special-skills', label: 'Warband skills' },
    Object.keys(def.equipmentLists).length > 0 && { id: 'equipment', label: 'Equipment' },
    def.heroSlots.length > 0 && { id: 'heroes', label: 'Heroes' },
    def.henchmenTypes.length > 0 && { id: 'henchmen', label: 'Henchmen' },
  ].filter(Boolean) as NavItem[];

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-bone-100 font-semibold text-xl">{children}</h2>
  );

  return (
    <div className="min-h-full flex flex-col" ref={topRef}>
      <header className="px-4 pt-5 pb-4 border-b border-ink-800 space-y-3">
        <Link to="/rules" className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
          ← Rules
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl text-bone-100">{def.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone="verdigris">{source}</Chip>
            {grade && <Chip tone="muted">{grade}</Chip>}
          </div>
          {fanMade && (
            <p className="text-bone-400 text-xs">Fan-made supplement — verify against your own books.</p>
          )}
        </div>

        {keyFacts.length > 0 && (
          <p className="text-bone-300 text-sm border-y border-ink-800 py-2">{keyFacts.join('  ·  ')}</p>
        )}

        <Link to={`/warbands/new?type=${def.id}`} className={buttonClasses('primary')}>
          Build this warband →
        </Link>
      </header>

      <JumpNav items={sections} />

      <main className="flex-1 px-4 py-6 space-y-8">
        {parsed.lead.length > 0 && (
          <section id="background" className="scroll-mt-24 space-y-3">
            <SectionTitle>Background</SectionTitle>
            <Background paragraphs={parsed.lead} />
          </section>
        )}

        {parsed.rules.length > 0 && (
          <section id="special-rules" className="scroll-mt-24 space-y-3">
            <SectionTitle>Special rules</SectionTitle>
            <SpecialRules rules={parsed.rules} />
          </section>
        )}

        <section id="choice" className="scroll-mt-24 space-y-3">
          <SectionTitle>Choice of warriors</SectionTitle>
          <ChoiceOfWarriors def={def} />
        </section>

        {hasSkillAccess && (
          <section id="skill-access" className="scroll-mt-24 space-y-3">
            <SectionTitle>Skill access</SectionTitle>
            <SkillAccess heroes={def.heroSlots} />
          </section>
        )}

        {specialSkillKeys.length > 0 && (
          <section id="special-skills" className="scroll-mt-24 space-y-3">
            <SectionTitle>Warband skills</SectionTitle>
            <SpecialSkills keys={specialSkillKeys} />
          </section>
        )}

        {Object.keys(def.equipmentLists).length > 0 && (
          <section id="equipment" className="scroll-mt-24 space-y-3">
            <SectionTitle>Equipment</SectionTitle>
            <EquipmentLists def={def} />
          </section>
        )}

        {def.heroSlots.length > 0 && (
          <section id="heroes" className="scroll-mt-24 space-y-4">
            <SectionTitle>Heroes</SectionTitle>
            {def.heroSlots.map((slot) => (
              <UnitCard key={slot.id} unit={slot} />
            ))}
          </section>
        )}

        {def.henchmenTypes.length > 0 && (
          <section id="henchmen" className="scroll-mt-24 space-y-4">
            <SectionTitle>Henchmen</SectionTitle>
            {def.henchmenTypes.map((type) => (
              <UnitCard key={type.id} unit={type} />
            ))}
          </section>
        )}

        <div className="pt-2">
          <Link to={`/warbands/new?type=${def.id}`} className={buttonClasses('primary')}>
            Build this warband →
          </Link>
        </div>
      </main>
    </div>
  );
}
