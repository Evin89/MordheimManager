import { Link, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import ProfileBlock from '../components/ProfileBlock';
import WeaponRulesDisclosure from '../components/WeaponRulesDisclosure';
import RuleDisclosure from '../components/RuleDisclosure';
import { getSkillByName } from '../lib/skillLookup';
import { ResolvedSpecialRule } from '../data/types';
import { WarbandPhotoFrame, WarbandThumb } from '../components/WarbandPhoto';
import WarbandAwards from '../components/WarbandAwards';
import WarbandComments from '../components/WarbandComments';
import { Card, Eyebrow, SectionHeading } from '../components/ui';
import { strings } from '../strings';
import { useSharedWarbandQuery, useWarband, useWarbandOwnerNameQuery } from '../hooks/useWarbands';
import { useEnsureWarbandType } from '../hooks/useCustomWarbands';
import { useRosterPhotos } from '../hooks/usePhotos';
import { computeWarbandRating } from '../lib/rating';
import { getWarbandTypeName, getUnitSpecialRules } from '../data/warbandRegistry';
import { modelDisplayName } from '../lib/modelNames';
import { EquipmentItem, Injury, StatLine } from '../types';

// One header style shared by the Equipment / Skills / Special rules columns,
// so the three read as siblings — the same treatment the battle roster uses.
const sectionHeaderClass = 'text-bone-400 text-xs font-semibold uppercase tracking-wide';

/** Everything a card and its muster row need, flattened across the three
 * model kinds so the page can list them in one pass. */
type SharedModel = {
  id: string;
  kind: 'hero' | 'henchmen' | 'hiredSword';
  name: string;
  subtitle: string;
  stats: StatLine;
  equipment: EquipmentItem[];
  skills?: string[];
  specialRules: ResolvedSpecialRule[];
  injuries?: Injury[];
  xp: number;
  /** Henchmen only: how many models stand behind this one card. */
  count?: number;
  unitType: string;
};

const anchorId = (id: string) => `model-${id}`;

function isLeader(model: SharedModel) {
  return model.kind === 'hero' && model.specialRules.some((r) => r.name === 'Leader');
}

/** One headline number under the warband name. */
function StatTile({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-md bg-ink-800/50 border border-ink-800 px-3 py-2 text-center">
      <p className={`font-heading text-2xl leading-tight tabular-nums ${accent ? 'text-ember-400' : 'text-bone-100'}`}>
        {value}
      </p>
      <p className="text-bone-400 text-xs font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}

/** A small standing figure, one per henchman in a group. */
function FigurePip() {
  return (
    <svg viewBox="0 0 12 20" className="w-2.5 h-4 text-bone-300" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="3.5" r="3" />
      <path d="M1.5 20v-8.5A3.5 3.5 0 0 1 5 8h2a3.5 3.5 0 0 1 3.5 3.5V20z" />
    </svg>
  );
}

/**
 * The whole warband at a glance — the landing page's showcase rows, here as
 * jump links to each model's full card further down.
 */
function Muster({ models, photos }: { models: SharedModel[]; photos: Record<string, string> }) {
  const jump = (id: string) =>
    document.getElementById(anchorId(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <Card as="section" gap="sm" aria-labelledby="shared-muster">
      <SectionHeading id="shared-muster">{strings.campaign.sharedMuster}</SectionHeading>
      <ul className="divide-y divide-ink-800/60">
        {models.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => jump(m.id)}
              className="w-full min-h-[44px] flex items-center gap-3 py-1.5 text-left hover:bg-ink-800/40 rounded-sm transition-colors"
            >
              {photos[m.id] && (
                <img
                  src={photos[m.id]}
                  alt=""
                  loading="lazy"
                  className="w-9 h-9 object-cover border-[1.5px] border-ink shrink-0"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-bone-100">
                {m.name}
                <span className="text-bone-400 text-sm">
                  {m.count === undefined
                    ? ` · ${m.subtitle}`
                    : m.name === m.unitType
                      ? ` ×${m.count}`
                      : ` · ${m.unitType} ×${m.count}`}
                </span>
              </span>
              {isLeader(m) && (
                <span className="text-ember-400 text-xs font-semibold uppercase tracking-wide shrink-0">
                  {strings.campaign.sharedLeaderBadge}
                </span>
              )}
              <span className="text-bone-400 text-sm tabular-nums shrink-0 w-14 text-right">{m.xp} XP</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * One model, read-only.
 *
 * Deliberately not the `RosterCard` from DuringBattleScreen: that one links
 * through to the editable detail screens, which resolve warbands out of the
 * signed-in user's own list. For someone else's warband those links would
 * dead-end, and offering them at all implies an edit affordance that doesn't
 * (and shouldn't) exist.
 */
function SharedModelCard({ model, photoUrl }: { model: SharedModel; photoUrl?: string }) {
  const leader = isLeader(model);
  const { skills, specialRules, injuries, equipment } = model;

  return (
    <Card
      id={anchorId(model.id)}
      gap="md"
      className={`scroll-mt-4 ${leader ? 'border-ember-500/50' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <WarbandThumb url={photoUrl} alt={strings.photo.alt(model.name)} shape="square" />
          <div className="min-w-0">
            <h3 className="font-heading text-xl text-bone-100 leading-tight truncate">
              {model.name}
              {leader && (
                <span className="ml-2 align-middle inline-block rounded-full border border-ember-500/50 px-2 py-px font-ui text-xs font-semibold uppercase tracking-wide text-ember-400">
                  {strings.campaign.sharedLeaderBadge}
                </span>
              )}
            </h3>
            <p className="text-bone-300 text-sm truncate">{model.subtitle}</p>
          </div>
        </div>
        <p className="shrink-0 rounded-full bg-ink-800 px-2.5 py-0.5 text-bone-200 text-sm font-semibold tabular-nums">
          {model.xp} XP
        </p>
      </div>

      {injuries !== undefined && injuries.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={strings.campaign.sharedInjuriesLabel}>
          {injuries.map((injury, i) => (
            <li
              key={`${injury.name}-${i}`}
              className="rounded-full border border-blood-500/60 bg-blood-500/10 px-2.5 py-0.5 text-xs font-semibold text-danger"
            >
              {injury.name}
            </li>
          ))}
        </ul>
      )}

      <ProfileBlock stats={model.stats} variant="collapsed" />

      {/* Side by side from sm up, stacked on a phone — three short lists read
          better as columns than as one long scroll. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-0.5 min-w-0">
          <p className={sectionHeaderClass}>{strings.modelSections.equipment}</p>
          {equipment.length > 0 ? (
            equipment.map((e) => <WeaponRulesDisclosure key={e.id} name={e.name} compact />)
          ) : (
            <p className="text-bone-300 text-xs">{strings.modelSections.noEquipment}</p>
          )}
        </div>

        {skills !== undefined && (
          <div className="space-y-0.5 min-w-0">
            <p className={sectionHeaderClass}>{strings.modelSections.skills}</p>
            {skills.length > 0 ? (
              skills.map((skill) => (
                <RuleDisclosure key={skill} name={skill} text={getSkillByName(skill)?.effect} />
              ))
            ) : (
              <p className="text-bone-300 text-xs">{strings.modelSections.noSkills}</p>
            )}
          </div>
        )}

        {specialRules.length > 0 && (
          <div className="space-y-0.5 min-w-0">
            <p className={sectionHeaderClass}>{strings.modelSections.specialRules}</p>
            {specialRules.map((rule) => (
              <RuleDisclosure
                key={rule.name}
                name={rule.name}
                text={[rule.description, rule.note].filter(Boolean).join('\n\n')}
              />
            ))}
          </div>
        )}
      </div>

      {/* The models behind the group, so a shared roster reads as bodies on the
          table rather than a multiplier. Decorative: the subtitle says the count. */}
      {model.count !== undefined && model.count > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-ink-800/60" aria-hidden="true">
          {Array.from({ length: model.count }, (_, i) => (
            <FigurePip key={i} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ModelSection({
  title,
  models,
  photos,
}: {
  title: string;
  models: SharedModel[];
  photos: Record<string, string>;
}) {
  if (models.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionHeading className="flex items-baseline gap-2">
        {title}
        <span className="text-bone-400 text-sm font-ui font-normal tabular-nums">{models.length}</span>
      </SectionHeading>
      <div className="space-y-3">
        {models.map((m) => (
          <SharedModelCard key={m.id} model={m} photoUrl={photos[m.id]} />
        ))}
      </div>
    </section>
  );
}

export default function SharedWarbandScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const { data: warband, isLoading } = useSharedWarbandQuery(warbandId);
  const { data: ownerName } = useWarbandOwnerNameQuery(warbandId);
  // The standings table links every warband here, including your own — so this
  // screen has to know when it's showing you back to yourself.
  const isMine = useWarband(warbandId) !== undefined;
  // A warband built on the owner's *custom* type: fetch and register that type
  // (readable since 0022) so its name and unit rules resolve here the same as a
  // bundled one, rather than showing a raw `custom-<id>` and blank rules.
  const { loading: typeLoading } = useEnsureWarbandType(warband?.warbandType);
  // Keyed by model id (the group shot lives under ''). Resolves to nothing for
  // an anonymous visitor, since photos are readable only when signed in (§11.5),
  // so the cards simply show no portrait rather than erroring.
  const photos = useRosterPhotos(warbandId);

  if (isLoading || typeLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }

  // A null result is RLS declining to return the row, not an app error — the
  // warband may be private, or the viewer may have left the campaign since the
  // link was made. Either way the honest message is the same.
  if (!warband) {
    return (
      <div className="min-h-full flex flex-col">
        <BackHeader title={strings.campaign.sharedRosterTitle} />
        <main className="flex-1 px-4 py-6">
          <Card gap="none">
            <p className="text-bone-200 text-sm">{strings.campaign.sharedRosterUnavailable}</p>
          </Card>
        </main>
      </div>
    );
  }

  const type = warband.warbandType;
  const heroes: SharedModel[] = warband.heroes.map((hero) => ({
    id: hero.id,
    kind: 'hero',
    name: modelDisplayName(hero),
    subtitle: hero.unitType,
    unitType: hero.unitType,
    stats: hero.stats,
    equipment: hero.equipment,
    skills: hero.skills,
    specialRules: getUnitSpecialRules(type, hero.unitType),
    injuries: hero.injuries,
    xp: hero.xp,
  }));
  const henchmen: SharedModel[] = warband.henchmenGroups.map((group) => ({
    id: group.id,
    kind: 'henchmen',
    name: group.groupName,
    subtitle: strings.campaign.sharedGroupCount(group.count, group.unitType),
    unitType: group.unitType,
    stats: group.stats,
    equipment: group.equipment,
    specialRules: getUnitSpecialRules(type, group.unitType),
    xp: group.xp,
    count: group.count,
  }));
  const hiredSwords: SharedModel[] = warband.hiredSwords.map((sword) => ({
    id: sword.id,
    kind: 'hiredSword',
    name: modelDisplayName(sword),
    subtitle: sword.type,
    unitType: sword.type,
    stats: sword.stats,
    equipment: sword.equipment,
    skills: sword.skills,
    specialRules: getUnitSpecialRules(type, sword.type),
    injuries: sword.injuries,
    xp: sword.xp,
  }));
  const all = [...heroes, ...henchmen, ...hiredSwords];
  const leader = heroes.find(isLeader);
  const modelCount =
    heroes.length + hiredSwords.length + warband.henchmenGroups.reduce((n, g) => n + g.count, 0);
  const byline = [
    leader ? strings.campaign.sharedLedBy(leader.name) : null,
    ownerName ? strings.campaign.sharedByOwner(ownerName) : null,
  ].filter(Boolean);

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.campaign.sharedRosterTitle} />

      <main className="flex-1 px-4 py-6 space-y-6">
        {/* The masthead: group shot as a book plate, then the name in the
            display face — this is the one place a warband gets to show off. */}
        <section className="space-y-4">
          <WarbandPhotoFrame
            warbandId={warband.id}
            alt={strings.photo.alt(warband.name)}
            variant="full"
            className="max-h-[420px]"
          />
          <div className="space-y-1">
            <Eyebrow>{getWarbandTypeName(type)}</Eyebrow>
            <h2 className="font-display text-4xl sm:text-5xl leading-none tracking-[0.03em] text-bone-100 break-words">
              {warband.name}
            </h2>
            {byline.length > 0 && <p className="text-bone-300 pt-1">{byline.join(' · ')}</p>}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <StatTile label={strings.campaign.sharedStatRating} value={computeWarbandRating(warband)} accent />
            <StatTile label={strings.campaign.sharedStatModels} value={modelCount} />
            <StatTile label={strings.campaign.sharedStatGold} value={warband.gold} />
            <StatTile label={strings.campaign.sharedStatShards} value={warband.wyrdstoneShards} />
          </div>

          <p className="text-bone-400 text-xs">
            {isMine ? strings.campaign.sharedRosterOwnHint : strings.campaign.sharedRosterReadOnly}
            {isMine && (
              <>
                {' '}
                <Link to={`/warbands/${warband.id}`} className="text-ember-400 font-semibold">
                  {strings.campaign.sharedRosterEditMine}
                </Link>
              </>
            )}
          </p>
        </section>

        {all.length > 1 && <Muster models={all} photos={photos} />}

        <ModelSection title={strings.campaign.sharedHeroes} models={heroes} photos={photos} />
        <ModelSection title={strings.campaign.sharedHenchmen} models={henchmen} photos={photos} />
        <ModelSection title={strings.campaign.sharedHiredSwords} models={hiredSwords} photos={photos} />

        <WarbandAwards warbandId={warband.id} />
        <WarbandComments warbandId={warband.id} />
      </main>
    </div>
  );
}
