import { Link, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import ProfileBlock from '../components/ProfileBlock';
import WeaponRulesDisclosure from '../components/WeaponRulesDisclosure';
import RuleDisclosure from '../components/RuleDisclosure';
import { getSkillByName } from '../lib/skillLookup';
import { ResolvedSpecialRule } from '../data/types';
import { WarbandThumb } from '../components/WarbandPhoto';
import WarbandAwards from '../components/WarbandAwards';
import WarbandComments from '../components/WarbandComments';
import { Card, SectionHeading } from '../components/ui';
import { strings } from '../strings';
import { useSharedWarbandQuery, useWarband } from '../hooks/useWarbands';
import { useEnsureWarbandType } from '../hooks/useCustomWarbands';
import { useRosterPhotos } from '../hooks/usePhotos';
import { computeWarbandRating } from '../lib/rating';
import { getWarbandTypeName, getUnitSpecialRules } from '../data/warbandRegistry';
import { modelDisplayName } from '../lib/modelNames';
import { EquipmentItem, Injury, StatLine } from '../types';

/**
 * One model, read-only.
 *
 * Deliberately not the `RosterCard` from DuringBattleScreen: that one links
 * through to the editable detail screens, which resolve warbands out of the
 * signed-in user's own list. For someone else's warband those links would
 * dead-end, and offering them at all implies an edit affordance that doesn't
 * (and shouldn't) exist.
 */
// One header style shared by the Equipment / Skills / Special rules sections,
// so the three read as siblings — the same treatment the battle roster uses.
const sectionHeaderClass = 'text-bone-400 text-[11px] font-semibold uppercase tracking-wide';

function SharedModelCard({
  name,
  subtitle,
  stats,
  equipment,
  skills,
  specialRules,
  injuries,
  xp,
  members,
  memberLabel,
  photoUrl,
}: {
  name: string;
  subtitle: string;
  stats: StatLine;
  equipment: EquipmentItem[];
  skills?: string[];
  specialRules?: ResolvedSpecialRule[];
  injuries?: Injury[];
  xp: number;
  /** Henchmen only: how many models stand behind this one card. */
  members?: number;
  memberLabel?: string;
  /** Signed and resolved by the parent; absent for a viewer without read access
   * to the photo (an anonymous gallery visitor — photos are signed-in only). */
  photoUrl?: string;
}) {
  return (
    <Card gap="sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <WarbandThumb url={photoUrl} alt={strings.photo.alt(name)} shape="square" />
          <div className="min-w-0">
            <p className="text-bone-100 font-semibold truncate">{name}</p>
            <p className="text-bone-300 text-sm truncate">{subtitle}</p>
          </div>
        </div>
        <p className="text-bone-300 text-sm shrink-0">{xp} XP</p>
      </div>

      <ProfileBlock stats={stats} variant="collapsed" />

      <div className="space-y-0.5">
        <p className={sectionHeaderClass}>{strings.modelSections.equipment}</p>
        {equipment.length > 0 ? (
          equipment.map((e) => <WeaponRulesDisclosure key={e.id} name={e.name} compact />)
        ) : (
          <p className="text-bone-300 text-xs">{strings.modelSections.noEquipment}</p>
        )}
      </div>

      {skills !== undefined && (
        <div className="space-y-0.5">
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

      {specialRules && specialRules.length > 0 && (
        <div className="space-y-0.5">
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

      {injuries !== undefined && injuries.length > 0 && (
        <p className="text-bone-300 text-xs">
          <span className="text-bone-200 font-semibold">{strings.campaign.sharedInjuriesLabel}: </span>
          {injuries.map((i) => i.name).join(', ')}
        </p>
      )}

      {/* The models behind the group, so a shared roster reads as bodies on the
          table rather than a multiplier. */}
      {members !== undefined && members > 0 && (
        <ul className="pt-1 border-t border-ink-800/60 space-y-1">
          {Array.from({ length: members }, (_, i) => (
            <li key={i} className="flex items-center gap-2 text-bone-300 text-xs pt-1">
              <span className="text-bone-400 tabular-nums w-5 shrink-0">{i + 1}.</span>
              <span className="truncate">{memberLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function SharedWarbandScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const { data: warband, isLoading } = useSharedWarbandQuery(warbandId);
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

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={warband.name} subtitle={getWarbandTypeName(warband.warbandType)} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <Card as="section" gap="sm">
          <p className="text-ember-400 font-semibold">
            {strings.roster.ratingLabel}: {computeWarbandRating(warband)}
          </p>
          <p className="text-bone-300 text-sm">
            {warband.gold} {strings.common.gold} · {warband.wyrdstoneShards} shards
          </p>
          <p className="text-bone-400 text-xs pt-1">
            {isMine ? strings.campaign.sharedRosterOwnHint : strings.campaign.sharedRosterReadOnly}
          </p>
          {isMine && (
            <Link to={`/warbands/${warband.id}`} className="inline-block text-ember-400 text-sm font-semibold pt-1">
              {strings.campaign.sharedRosterEditMine}
            </Link>
          )}
        </Card>

        {warband.heroes.length > 0 && (
          <section className="space-y-3">
            <SectionHeading>{strings.campaign.sharedHeroes}</SectionHeading>
            <div className="space-y-2">
              {warband.heroes.map((hero) => (
                <SharedModelCard
                  key={hero.id}
                  name={modelDisplayName(hero)}
                  subtitle={hero.unitType}
                  stats={hero.stats}
                  equipment={hero.equipment}
                  skills={hero.skills}
                  specialRules={getUnitSpecialRules(warband.warbandType, hero.unitType)}
                  injuries={hero.injuries}
                  xp={hero.xp}
                  photoUrl={photos[hero.id]}
                />
              ))}
            </div>
          </section>
        )}

        {warband.henchmenGroups.length > 0 && (
          <section className="space-y-3">
            <SectionHeading>{strings.campaign.sharedHenchmen}</SectionHeading>
            <div className="space-y-2">
              {warband.henchmenGroups.map((group) => (
                <SharedModelCard
                  key={group.id}
                  name={group.groupName}
                  subtitle={`${group.count}x ${group.unitType}`}
                  stats={group.stats}
                  equipment={group.equipment}
                  specialRules={getUnitSpecialRules(warband.warbandType, group.unitType)}
                  xp={group.xp}
                  members={group.count}
                  memberLabel={group.unitType}
                  photoUrl={photos[group.id]}
                />
              ))}
            </div>
          </section>
        )}

        {warband.hiredSwords.length > 0 && (
          <section className="space-y-3">
            <SectionHeading>{strings.campaign.sharedHiredSwords}</SectionHeading>
            <div className="space-y-2">
              {warband.hiredSwords.map((sword) => (
                <SharedModelCard
                  key={sword.id}
                  name={modelDisplayName(sword)}
                  subtitle={sword.type}
                  stats={sword.stats}
                  equipment={sword.equipment}
                  skills={sword.skills}
                  specialRules={getUnitSpecialRules(warband.warbandType, sword.type)}
                  injuries={sword.injuries}
                  xp={sword.xp}
                  photoUrl={photos[sword.id]}
                />
              ))}
            </div>
          </section>
        )}

        <WarbandAwards warbandId={warband.id} />
        <WarbandComments warbandId={warband.id} />
      </main>
    </div>
  );
}
