import { Link, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import WeaponRulesDisclosure from '../components/WeaponRulesDisclosure';
import { strings } from '../strings';
import { useSharedWarbandQuery, useWarband } from '../hooks/useWarbands';
import { computeWarbandRating } from '../lib/rating';
import { getWarbandTypeName } from '../data/warbandRegistry';
import { STAT_KEYS } from '../lib/statLine';
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
function SharedModelCard({
  name,
  subtitle,
  stats,
  equipment,
  skills,
  injuries,
  xp,
  members,
  memberLabel,
}: {
  name: string;
  subtitle: string;
  stats: StatLine;
  equipment: EquipmentItem[];
  skills?: string[];
  injuries?: Injury[];
  xp: number;
  /** Henchmen only: how many models stand behind this one card. */
  members?: number;
  memberLabel?: string;
}) {
  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-bone-100 font-semibold truncate">{name}</p>
          <p className="text-bone-300 text-sm truncate">{subtitle}</p>
        </div>
        <p className="text-bone-300 text-sm shrink-0">{xp} XP</p>
      </div>

      <div className="grid grid-cols-9 gap-1 text-center">
        {STAT_KEYS.map((key) => (
          <div key={key}>
            <p className="text-bone-300 text-[10px] uppercase">{key}</p>
            <p className="text-bone-100 text-sm font-semibold">{stats[key]}</p>
          </div>
        ))}
      </div>

      {equipment.length > 0 ? (
        <div className="space-y-0.5">
          {equipment.map((e) => (
            <WeaponRulesDisclosure key={e.id} name={e.name} compact />
          ))}
        </div>
      ) : (
        <p className="text-bone-300 text-xs">{strings.campaign.sharedNoEquipment}</p>
      )}

      {skills !== undefined && skills.length > 0 && (
        <p className="text-bone-300 text-xs">
          <span className="text-bone-200 font-semibold">{strings.campaign.sharedSkillsLabel}: </span>
          {skills.join(', ')}
        </p>
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
    </div>
  );
}

export default function SharedWarbandScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const { data: warband, isLoading } = useSharedWarbandQuery(warbandId);
  // The standings table links every warband here, including your own — so this
  // screen has to know when it's showing you back to yourself.
  const isMine = useWarband(warbandId) !== undefined;

  if (isLoading) {
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
          <p className="text-bone-200 text-sm rounded-md bg-ink-900 border border-ink-800 p-4">
            {strings.campaign.sharedRosterUnavailable}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={warband.name} subtitle={getWarbandTypeName(warband.warbandType)} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-1">
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
        </section>

        {warband.heroes.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-bone-100 font-semibold">{strings.campaign.sharedHeroes}</h2>
            <div className="space-y-2">
              {warband.heroes.map((hero) => (
                <SharedModelCard
                  key={hero.id}
                  name={hero.name}
                  subtitle={hero.unitType}
                  stats={hero.stats}
                  equipment={hero.equipment}
                  skills={hero.skills}
                  injuries={hero.injuries}
                  xp={hero.xp}
                />
              ))}
            </div>
          </section>
        )}

        {warband.henchmenGroups.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-bone-100 font-semibold">{strings.campaign.sharedHenchmen}</h2>
            <div className="space-y-2">
              {warband.henchmenGroups.map((group) => (
                <SharedModelCard
                  key={group.id}
                  name={group.groupName}
                  subtitle={`${group.count}x ${group.unitType}`}
                  stats={group.stats}
                  equipment={group.equipment}
                  xp={group.xp}
                  members={group.count}
                  memberLabel={group.unitType}
                />
              ))}
            </div>
          </section>
        )}

        {warband.hiredSwords.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-bone-100 font-semibold">{strings.campaign.sharedHiredSwords}</h2>
            <div className="space-y-2">
              {warband.hiredSwords.map((sword) => (
                <SharedModelCard
                  key={sword.id}
                  name={sword.name}
                  subtitle={sword.type}
                  stats={sword.stats}
                  equipment={sword.equipment}
                  skills={sword.skills}
                  injuries={sword.injuries}
                  xp={sword.xp}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
