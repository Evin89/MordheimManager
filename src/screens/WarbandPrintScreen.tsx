import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import ProfileBlock from '../components/ProfileBlock';
import { strings } from '../strings';
import { useWarbandLookup } from '../hooks/useWarbands';
import { useMyProfileQuery } from '../hooks/useProfile';
import { useRosterPhotos } from '../hooks/usePhotos';
import { computeWarbandRating, isInWarband } from '../lib/rating';
import { TRACK_LENGTH, getAdvanceThresholds } from '../lib/xpThresholds';
import { getWarbandTypeName } from '../data/warbandRegistry';
import { getSpell } from '../lib/spellLookup';
import { modelDisplayName } from '../lib/modelNames';
import { EquipmentItem, HenchmenGroup, Hero, HiredSword, Warband } from '../types';

/**
 * The Experience track from the printed sheet.
 *
 * The signature element of the original: a run of small boxes, thick-bordered
 * at every advance threshold, that you tick off game by game. The thresholds
 * and the track lengths were read off the official PDF (see the `source` note
 * in xpThresholds.json), so this is the real track rather than an approximation
 * of one.
 *
 * The one thing the app adds over a photocopy is that it already knows the
 * total, so the boxes arrive ticked.
 */
function XpTrack({ xp, kind }: { xp: number; kind: 'hero' | 'henchmen' }) {
  const length = TRACK_LENGTH[kind];
  const thresholds = new Set(getAdvanceThresholds(kind));
  // 30 to a row on the Hero track, which is how the official sheet breaks its
  // 90 boxes; the 14-box Henchman track is one row.
  const perRow = kind === 'hero' ? 30 : length;
  const rows: number[][] = [];
  for (let i = 0; i < length; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, length - i) }, (_, n) => i + n + 1));
  }

  return (
    <div className="space-y-[2px]">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-[2px]">
          {row.map((box) => {
            const isAdvance = thresholds.has(box);
            const earned = box <= xp;
            return (
              <span
                key={box}
                title={isAdvance ? `${box} XP — advance` : `${box} XP`}
                className={`flex-1 h-[14px] min-w-[7px] border ${
                  // A thick border means "roll an Advance when you reach this
                  // box" (rulebook p.81). It has to survive being filled in,
                  // so the mark is a background and the threshold is a border.
                  isAdvance ? 'border-2 border-ink' : 'border-ink/45'
                } ${earned ? 'bg-ink' : ''}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * A warrior's portrait on the sheet.
 *
 * Small on purpose — 15mm or so on paper. It is there to be matched against the
 * model in your hand, which needs a silhouette and a colour scheme, not detail;
 * and every square millimetre of it is ink. Renders nothing at all when there is
 * no photo, so a roster without them prints exactly as it did before.
 */
function PrintPhoto({ url, alt }: { url?: string; alt: string }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt}
      className="border border-ink w-14 h-14 object-cover shrink-0 self-start"
    />
  );
}

/** A labelled line inside a warrior's box: "EQUIPMENT  dagger, sword". */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-ink text-sm leading-snug">
      <span className="font-heading-sc uppercase tracking-[0.08em] text-ink-faded">{label} </span>
      {children}
    </p>
  );
}

/*
 * Reading a stored warband defensively.
 *
 * `types.ts` declares these fields required, and they are — for a warband saved
 * *today*. A roster written before a field existed simply has no key for it, and
 * TypeScript cannot see that, because the type describes the shape the app now
 * writes rather than every shape already sitting in the database.
 *
 * This screen learned it the hard way: `model.spells.map(...)` threw on a real
 * mid-campaign warband whose heroes predate spells, and since the throw happens
 * during render with no error boundary above it, the whole page went blank. The
 * detail screens already read `model.spells ?? []` for the same reason.
 *
 * A printed sheet is exactly where this matters most: it is the oldest warbands,
 * the ones with the most history, that are least likely to have every modern
 * field — and most likely to be worth printing.
 */
const list = <T,>(value: T[] | undefined | null): T[] => value ?? [];
const text = (value: string | undefined | null): string => (value ?? '').trim();

function equipmentText(equipment: EquipmentItem[] | undefined): string {
  const items = list(equipment);
  if (items.length === 0) return strings.print.none;
  return items.map((e) => e.name).join(', ');
}

/**
 * A hero or hired sword, in the shape the official sheet gives them: name and
 * type, the statline, the Experience track, then equipment and the catch-all
 * "Skills, injuries, etc".
 */
function WarriorBlock({ model, photoUrl }: { model: Hero | HiredSword; photoUrl?: string }) {
  const isLeader = 'isLeader' in model && model.isLeader;
  const unitType = 'unitType' in model ? model.unitType : model.type;

  // The original's one free-text box, so everything that isn't a number or a
  // weapon goes here in the order you would have written it: what he can do,
  // then what is wrong with him.
  const notes = [
    ...list(model.skills),
    ...list(model.spells)
      .map((id) => getSpell(id)?.name)
      .filter((n): n is string => !!n),
    ...list(model.injuries).map((i) => i.name),
    ...(model.status === 'missNextGame' ? [strings.print.missNextGame] : []),
    ...(text(model.notes) ? [text(model.notes)] : []),
  ];

  return (
    <div className="border-2 border-ink p-2 break-inside-avoid flex gap-2">
      {/* Left of the block, not above it: the photo is how you find this warrior
          among the models on the table, so it wants to sit beside his name at a
          glance rather than push the statline down the page. */}
      <PrintPhoto url={photoUrl} alt={strings.photo.alt(model.name)} />

      <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-heading text-ink text-base leading-tight">
          {modelDisplayName(model)}
          {isLeader && (
            <span className="font-ui text-ink-faded text-xs uppercase tracking-wide">
              {' '}
              · {strings.print.leader}
            </span>
          )}
        </p>
        <p className="font-ui text-ink-faded text-xs uppercase tracking-wide text-right shrink-0">
          {unitType}
        </p>
      </div>

      <ProfileBlock stats={model.stats} variant="collapsed" />

      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-heading-sc uppercase tracking-[0.08em] text-ink-faded text-xs mb-0.5">
            {strings.print.experience}
          </p>
          <XpTrack xp={model.xp} kind="hero" />
        </div>
        {/* The total in figures as well as in boxes: past forty ticks nobody is
            counting them at the table. */}
        <p className="font-body text-ink tabular-nums lining-nums text-base shrink-0 leading-none">
          {model.xp}
        </p>
      </div>

      <Field label={strings.print.equipment}>{equipmentText(model.equipment)}</Field>
      <Field label={strings.print.skillsInjuries}>
        {notes.length > 0 ? notes.join(' · ') : strings.print.none}
      </Field>
      </div>
    </div>
  );
}

/** A henchmen group. The sheet gives these a Number column and calls their free
 * text "Special rules" rather than "Skills, injuries" — a group advances as one
 * and cannot carry individual wounds. */
function HenchmenBlock({ group, photoUrl }: { group: HenchmenGroup; photoUrl?: string }) {
  const notes = [
    ...list(group.advances).map((a) => a.detail),
    ...(text(group.notes) ? [text(group.notes)] : []),
  ];

  return (
    <div className="border-2 border-ink p-2 break-inside-avoid flex gap-2">
      <PrintPhoto url={photoUrl} alt={strings.photo.alt(group.groupName)} />

      <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-heading text-ink text-base leading-tight">
          <span className="tabular-nums lining-nums">{group.count}</span> · {group.groupName}
        </p>
        <p className="font-ui text-ink-faded text-xs uppercase tracking-wide text-right shrink-0">
          {group.unitType}
        </p>
      </div>

      <ProfileBlock stats={group.stats} variant="collapsed" />

      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-heading-sc uppercase tracking-[0.08em] text-ink-faded text-xs mb-0.5">
            {strings.print.groupExperience}
          </p>
          <XpTrack xp={group.xp} kind="henchmen" />
        </div>
        <p className="font-body text-ink tabular-nums lining-nums text-base shrink-0 leading-none">
          {group.xp}
        </p>
      </div>

      <Field label={strings.print.equipment}>{equipmentText(group.equipment)}</Field>
      <Field label={strings.print.specialRules}>
        {notes.length > 0 ? notes.join(' · ') : strings.print.none}
      </Field>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 mt-4">
      <h2 className="font-heading-sc uppercase tracking-[0.12em] text-ink text-sm border-b-2 border-ink pb-0.5">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One of the boxes along the foot of the original: a heading and a short list
 * of label/value pairs. */
function Summary({ title, rows }: { title: string; rows: [string, string | number][] }) {
  return (
    <div className="border-2 border-ink p-2 break-inside-avoid">
      <p className="font-heading-sc uppercase tracking-[0.08em] text-ink text-xs border-b border-ink/40 pb-0.5 mb-1">
        {title}
      </p>
      <dl className="space-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <dt className="text-ink-faded text-sm">{label}</dt>
            <dd className="text-ink text-sm tabular-nums lining-nums font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The arithmetic printed at the foot of the sheet.
 *
 * Deliberately shows its working rather than just the rating: the number gets
 * read out to an opponent before a game, and "how did you get that" is a fair
 * question. Large creatures are the reason the members line can't simply be
 * n x 5 — see `strings.print.membersLine`.
 */
function ratingBreakdown(warband: Warband) {
  const heroes = list(warband.heroes).filter((h) => isInWarband(h.status));
  const swords = list(warband.hiredSwords).filter((s) => isInWarband(s.status));

  let experience = 0;
  let models = 0;
  let largeCreatures = 0;

  for (const m of [...heroes, ...swords]) {
    experience += m.xp;
    models += 1;
    if (m.isLargeCreature) largeCreatures += 1;
  }
  for (const g of list(warband.henchmenGroups)) {
    // Group Experience is what *each* member carries, so it counts per model.
    experience += g.xp * g.count;
    models += g.count;
    if (g.isLargeCreature) largeCreatures += g.count;
  }

  return { experience, models, largeCreatures, rating: computeWarbandRating(warband) };
}

/**
 * A warband as a printable roster sheet.
 *
 * Laid out after the official Games Workshop sheet (1999) — the same sections
 * in the same order, and its field names, so anyone who has filled one in by
 * hand knows where to look. It is drawn from scratch in the app's own type and
 * rules rather than being a copy of that file, and carries no Games Workshop
 * artwork or branding.
 *
 * Output goes through the browser's own print path rather than a PDF library.
 * A generated PDF would mean either shipping a layout engine and embedding
 * Alegreya and IM Fell (a few hundred kB, for one screen) or rasterising the
 * page with html2canvas, which turns a sheet made almost entirely of small
 * numbers into a blurry image. Printing keeps the text vector, uses the fonts
 * already loaded, gives "Save as PDF" on every desktop browser and both mobile
 * OSes — and also, unlike a download, prints.
 *
 * The sheet is a screen in its own right rather than a hidden frame, so what
 * you see before pressing the button is what comes out.
 */
export default function WarbandPrintScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const { warband, loading } = useWarbandLookup(warbandId);
  const { data: profile } = useMyProfileQuery();
  const photos = useRosterPhotos(warbandId);
  /*
   * On by default, because recognising the model in front of you is the whole
   * reason to carry a printed sheet to a table — but a toggle, because photos
   * are the one thing on this page that costs real ink, and a sheet reprinted
   * after every game is a sheet printed a lot.
   *
   * Not remembered between visits: the choice belongs to *this* printout. You
   * might want portraits for a game night and a plain copy for the folder.
   */
  const [withPhotos, setWithPhotos] = useState(true);
  const hasAnyPhoto = Object.keys(photos).length > 0;
  const photoFor = (id: string) => (withPhotos ? photos[id] : undefined);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }
  if (!warband) return <Navigate to="/warbands" replace />;

  const heroes = list(warband.heroes).filter((h) => isInWarband(h.status));
  const swords = list(warband.hiredSwords).filter((s) => isInWarband(s.status));
  const groups = list(warband.henchmenGroups).filter((g) => g.count > 0);
  const totals = ratingBreakdown(warband);
  const empty = heroes.length === 0 && swords.length === 0 && groups.length === 0;

  return (
    <div className="min-h-full">
      {/* Screen-only chrome. Everything below it is the sheet itself, which is
          all that reaches the paper. */}
      <div className="print:hidden px-4 py-4 space-y-3 border-b border-ink-800">
        <div className="flex items-center justify-between gap-3">
          <Link
            to={`/warbands/${warband.id}`}
            className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
          >
            {warband.name}
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[48px] px-4 rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
          >
            {strings.print.printAction}
          </button>
        </div>
        <p className="text-bone-300 text-sm">{strings.print.hint}</p>

        {/* Only offered when there is something to include — a switch that can
            change nothing is a question the user has to answer for no reason. */}
        {hasAnyPhoto && (
          <label className="flex items-center gap-3 min-h-[44px] text-bone-200 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={withPhotos}
              onChange={(e) => setWithPhotos(e.target.checked)}
              className="h-5 w-5 shrink-0"
            />
            <span>{strings.print.includePhotos}</span>
          </label>
        )}
      </div>

      {/*
        The sheet. `print-sheet` puts it on white with black ink whatever theme
        the app is wearing (see index.css), so on screen it reads as paper.

        750px is A4 with the page margins taken off: 210mm - 2x10mm = 190mm,
        which is 718px at 96dpi, plus the 2x16px of screen padding that `@page`
        replaces on paper. The preview therefore breaks its lines exactly where
        the printout will.
      */}
      <div className="print-sheet bg-parchment mx-auto max-w-[750px] px-4 py-4 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <header className="border-2 border-ink p-3 break-inside-avoid">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-heading-sc uppercase tracking-[0.08em] text-ink-faded text-xs">
                {strings.print.warbandName}
              </p>
              <p className="font-display text-ink text-2xl leading-tight">{warband.name}</p>
            </div>
            <div className="text-right">
              <p className="font-heading-sc uppercase tracking-[0.08em] text-ink-faded text-xs">
                {strings.print.warbandType}
              </p>
              <p className="font-heading text-ink text-lg leading-tight">
                {getWarbandTypeName(warband.warbandType)}
              </p>
            </div>
          </div>
          {profile?.displayName && (
            <p className="mt-2 pt-2 border-t border-ink/40 text-ink text-sm">
              <span className="font-heading-sc uppercase tracking-[0.08em] text-ink-faded">
                {strings.print.player}{' '}
              </span>
              {profile.displayName}
            </p>
          )}
        </header>

        {empty && <p className="mt-4 text-ink text-sm">{strings.print.nothingRecruited}</p>}

        {heroes.length > 0 && (
          <Section title={strings.print.heroes}>
            <div className="space-y-2">
              {heroes.map((h) => (
                <WarriorBlock key={h.id} model={h} photoUrl={photoFor(h.id)} />
              ))}
            </div>
          </Section>
        )}

        {/* The official sheet has no Hired Swords section — you wrote them in
            among the heroes. They are a separate list here because the app
            models them separately, and they take the hero layout because that
            is what they are on the table: one named model with a statline. */}
        {swords.length > 0 && (
          <Section title={strings.print.hiredSwords}>
            <div className="space-y-2">
              {swords.map((s) => (
                <WarriorBlock key={s.id} model={s} photoUrl={photoFor(s.id)} />
              ))}
            </div>
          </Section>
        )}

        {groups.length > 0 && (
          <Section title={strings.print.henchmen}>
            <div className="space-y-2">
              {groups.map((g) => (
                <HenchmenBlock key={g.id} group={g} photoUrl={photoFor(g.id)} />
              ))}
            </div>
          </Section>
        )}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 break-inside-avoid">
          <div className="border-2 border-ink p-2 break-inside-avoid">
            <p className="font-heading-sc uppercase tracking-[0.08em] text-ink text-xs border-b border-ink/40 pb-0.5 mb-1">
              {strings.print.storedEquipment}
            </p>
            <p className="text-ink text-sm leading-snug">{equipmentText(warband.treasury)}</p>
          </div>

          <Summary
            title={strings.print.treasury}
            rows={[
              [strings.print.goldCrowns, warband.gold],
              [strings.print.wyrdstoneShards, warband.wyrdstoneShards],
            ]}
          />

          <Summary
            title={strings.print.warbandRating}
            rows={[
              [strings.print.totalExperience, totals.experience],
              [
                strings.print.membersLine(totals.models, totals.largeCreatures),
                totals.rating - totals.experience,
              ],
              [strings.print.rating, totals.rating],
            ]}
          />
        </div>

        {/* Ruled space, because the sheet goes to the table and things change
            there before they ever get typed back into the app. */}
        <div className="mt-2 border-2 border-ink p-2 break-inside-avoid">
          <p className="font-heading-sc uppercase tracking-[0.08em] text-ink text-xs mb-1">
            {strings.print.notes}
          </p>
          {text(warband.notes) && (
            <p className="text-ink text-sm whitespace-pre-wrap mb-1">{text(warband.notes)}</p>
          )}
          <div className="space-y-3 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-b border-ink/40" />
            ))}
          </div>
        </div>

        <p className="mt-2 font-ui text-ink-faded text-xs text-right">
          {strings.print.printedOn(new Date().toLocaleDateString())}
        </p>
      </div>
    </div>
  );
}
