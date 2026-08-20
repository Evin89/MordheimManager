import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import InlineNumberField from '../components/InlineNumberField';
import ProfileBlock from '../components/ProfileBlock';
import WarbandPhotoEditor, { WarbandThumb } from '../components/WarbandPhoto';
import { useRosterPhotos } from '../hooks/usePhotos';
import { useRatingHistoryQuery } from '../hooks/useRatingHistory';
import RatingHistoryChart from '../components/RatingHistoryChart';
import { modelDisplayName } from '../lib/modelNames';
import WarbandSharingCard from '../components/WarbandSharingCard';
import ShareableWarbandCard from '../components/ShareableWarbandCard';
import WarbandHealthPanel from '../components/WarbandHealthPanel';
import ConfirmByTyping from '../components/ConfirmByTyping';
import SaveBar from '../components/SaveBar';
import { Button, Card, SectionHeading, buttonClasses } from '../components/ui';
import { strings } from '../strings';
import {
  useCanUndoLastBattle,
  useDeleteWarbandMutation,
  useUndoLastBattleMutation,
  useWarbandLookup,
  useWarbandSharing,
} from '../hooks/useWarbands';
import { useUnsavedChangesWarning, useWarbandDraft } from '../hooks/useWarbandDraft';
import { useEnsureWarbandType } from '../hooks/useCustomWarbands';
import { useMyCampaignsQuery } from '../hooks/useCampaign';
import { computeWarbandRating, countModels } from '../lib/rating';
import { getWarbandTypeName, getUnitSpecialRules } from '../data/warbandRegistry';
import { HenchmenGroup, Hero, HiredSword, ModelStatus } from '../types';

/**
 * The compact "what does this model carry" summary shown on each roster card:
 * weapons, skills and unit rules as plain name lists. Deliberately names only —
 * no weapon cost or rarity, which is shop information, not what you check when
 * scanning the roster. The card links through to the detail screen for the full,
 * expandable version (stat lines, rule text, prices).
 */
function LoadoutLines({
  weapons,
  skills,
  rules,
}: {
  weapons: string[];
  skills?: string[];
  rules: string[];
}) {
  const rows: [string, string[]][] = [
    [strings.roster.weaponsLabel, weapons],
    [strings.roster.skillsLabel, skills ?? []],
    [strings.roster.rulesLabel, rules],
  ];
  const shown = rows.filter(([, items]) => items.length > 0);
  if (shown.length === 0) return null;
  return (
    <dl className="mt-3 space-y-1">
      {shown.map(([label, items]) => (
        <div key={label} className="flex gap-2 text-xs leading-snug">
          <dt className="text-bone-400 shrink-0 w-16">{label}</dt>
          <dd className="text-bone-300 min-w-0">{items.join(', ')}</dd>
        </div>
      ))}
    </dl>
  );
}

const STATUS_BADGE: Partial<Record<ModelStatus, string>> = {
  missNextGame: strings.roster.missNextGameBadge,
  dead: strings.roster.deadBadge,
  captured: strings.roster.capturedBadge,
  left: strings.roster.leftBadge,
};

function ModelRow({
  to,
  model,
  warbandType,
  photoUrl,
}: {
  to: string;
  model: Hero | HiredSword;
  warbandType: string;
  photoUrl?: string;
}) {
  const badge = STATUS_BADGE[model.status];
  const unitTypeLabel = 'unitType' in model ? model.unitType : model.type;
  return (
    <Link
      to={to}
      className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <WarbandThumb url={photoUrl} alt={strings.photo.alt(model.name)} shape="square" />
        <div className="min-w-0 flex-1">
          <p className="text-bone-100 font-semibold truncate">{modelDisplayName(model)}</p>
          <p className="text-bone-300 text-sm truncate">{unitTypeLabel}</p>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <p className="text-bone-300 text-sm">{model.xp} XP</p>
          {badge && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blood-600 text-bone-100">{badge}</span>
          )}
          {model.injuries.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-ink-800 text-bone-300 border border-ink-700">
              {model.injuries.length} injur{model.injuries.length === 1 ? 'y' : 'ies'}
            </span>
          )}
        </div>
      </div>

      {/* §5.3: the profile block is reused everywhere a statline appears, and a
          roster row collapses it. Rows previously showed no characteristics at
          all, so checking a warrior's Toughness while deploying meant opening
          him. */}
      <div className="mt-3 overflow-x-auto">
        <ProfileBlock stats={model.stats} variant="collapsed" />
      </div>

      <LoadoutLines
        weapons={model.equipment.map((e) => e.name)}
        skills={model.skills}
        rules={getUnitSpecialRules(warbandType, unitTypeLabel).map((r) => r.name)}
      />
    </Link>
  );
}

/**
 * A henchmen group, with its members listed out beneath it.
 *
 * The rules treat a group as one entity — shared characteristics, one
 * Experience total, everyone advances together — so the data holds a count
 * rather than N records. But "4x Swordsman" on a card doesn't read like four
 * bodies on the table, which is what you're actually counting when you deploy
 * or work out who's left. The members are therefore listed individually, while
 * anything you can *edit* stays on the group.
 */
function HenchmenGroupCard({
  warbandId,
  warbandType,
  group,
  photoUrl,
}: {
  warbandId: string;
  warbandType: string;
  group: HenchmenGroup;
  photoUrl?: string;
}) {
  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 hover:border-ink-700 transition-colors">
      <Link to={`/warbands/${warbandId}/henchmen/${group.id}`} className="block p-4">
        <div className="flex items-center justify-between gap-3">
          {/* One photo for the group, like the statline: the rules treat them as
              one entity and they are usually painted as a matched set. */}
          <WarbandThumb url={photoUrl} alt={strings.photo.alt(group.groupName)} shape="square" />
          <div className="min-w-0 flex-1">
            <p className="text-bone-100 font-semibold truncate">{group.groupName}</p>
            <p className="text-bone-300 text-sm truncate">
              {group.count}x {group.unitType}
            </p>
          </div>
          <p className="text-bone-300 text-sm shrink-0">{strings.roster.xpEach(group.xp)}</p>
        </div>

        {/* One line for the group: the rules give every member the same
            characteristics, so repeating it per body would be nine identical
            numbers times four. */}
        <div className="mt-3 overflow-x-auto">
          <ProfileBlock stats={group.stats} variant="collapsed" />
        </div>

        <LoadoutLines
          weapons={group.equipment.map((e) => e.name)}
          rules={getUnitSpecialRules(warbandType, group.unitType).map((r) => r.name)}
        />
      </Link>

      {group.count > 0 && (
        <ul className="px-4 pb-3 pt-0 space-y-1 border-t border-ink-800/60 mt-1">
          {Array.from({ length: group.count }, (_, i) => (
            <li key={i} className="flex items-center gap-2 text-bone-300 text-sm pt-1">
              <span className="text-bone-400 text-xs tabular-nums w-5 shrink-0">{i + 1}.</span>
              <span className="truncate">{group.unitType}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The rating-over-time chart (§18.3), collapsed under the rating figure.
 *
 * Its own component so the query only runs on the roster screen, and renders
 * nothing at all until there are two points to draw a line between — a warband
 * created moments ago has one, which is a dot, not a trend.
 */
function RatingHistory({ warbandId }: { warbandId: string }) {
  const { data: points } = useRatingHistoryQuery(warbandId);
  if (!points || points.length < 2) return null;
  return (
    <details className="border-t border-ink-800 pt-3">
      <summary className="min-h-[44px] flex items-center text-bone-300 text-sm font-semibold cursor-pointer select-none">
        {strings.roster.ratingHistoryTitle}
      </summary>
      <div className="pt-2">
        <RatingHistoryChart points={points} />
      </div>
    </details>
  );
}

export default function RosterScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const { warband, loading } = useWarbandLookup(warbandId);
  const deleteWarband = useDeleteWarbandMutation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Named, not just flagged: "drops out of Grudge Season" is a consequence
  // someone can weigh; "is in a campaign" is not.
  const { data: campaigns } = useMyCampaignsQuery();
  const sharing = useWarbandSharing(warbandId);
  const canUndo = useCanUndoLastBattle(warbandId);
  const undoLastBattle = useUndoLastBattleMutation();
  // Treasury figures are typed, so they're drafted and saved on request. The
  // roster's own actions (recruit, trade, delete) still write immediately.
  const { draft, update, dirty, save, discard } = useWarbandDraft(warband);
  // One records fetch and one signing call for the whole roster, keyed by model
  // id -- see useRosterPhotos. Asking per row would be two requests per warrior.
  const photos = useRosterPhotos(warbandId);
  useUnsavedChangesWarning(dirty);
  // A warband built on a custom type needs that type in the registry before its
  // name, unit rules and health check resolve. Bundled types are ready at once;
  // a custom one (own or a stale reference) gates the screen briefly rather than
  // flashing a raw id and an empty check while it loads.
  const { ready: typeReady } = useEnsureWarbandType(warband?.warbandType);

  if (loading || (warband && !typeReady)) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
  if (!warband || !draft) {
    return <Navigate to="/warbands" replace />;
  }

  const campaignName = campaigns?.find((c) => c.id === sharing.campaignId)?.name ?? null;

  function handleDelete() {
    if (!warband) return;
    deleteWarband(warband.id);
    navigate('/warbands', { replace: true });
  }

  function handleUndo() {
    if (!warband) return;
    if (window.confirm(strings.postBattle.undoConfirm)) {
      undoLastBattle(warband.id);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={warband.name} subtitle={getWarbandTypeName(warband.warbandType)} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <Card as="section" gap="lg">
          <p className="text-ember-400 font-semibold">
            {strings.roster.ratingLabel}: {computeWarbandRating(draft)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <InlineNumberField
              label={strings.roster.goldLabel}
              value={draft.gold}
              onCommit={(gold) => update({ gold })}
            />
            <InlineNumberField
              label={strings.roster.shardsLabel}
              value={draft.wyrdstoneShards}
              onCommit={(wyrdstoneShards) => update({ wyrdstoneShards })}
            />
          </div>

          <RatingHistory warbandId={warband.id} />
        </Card>

        {/* Legality + housekeeping at a glance — reads the draft so a treasury
            or roster change is reflected before it's even saved. */}
        <WarbandHealthPanel warband={draft} />

        <WarbandPhotoEditor warbandId={warband.id} warbandName={warband.name} />

        <Link to={`/warbands/${warband.id}/pre-battle`} className={buttonClasses('primary')}>
          {strings.battle.startBattleButton}
        </Link>

        <Link to={`/warbands/${warband.id}/trading`} className={buttonClasses('secondary')}>
          {strings.roster.visitTrading}
        </Link>

        <Link to={`/warbands/${warband.id}/print`} className={buttonClasses('secondary')}>
          {strings.print.rosterLink}
        </Link>

        <Link
          to={`/warbands/${warband.id}/post-battle`}
          className="block text-center w-full min-h-[40px] leading-[40px] text-bone-300 text-sm"
        >
          {strings.postBattle.startButton}
        </Link>

        {canUndo && (
          <Button variant="secondary" onClick={handleUndo}>
            {strings.postBattle.undoLastBattle}
          </Button>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeading>{strings.roster.heroesSection}</SectionHeading>
            <Link to={`/warbands/${warband.id}/add-hero`} className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
              {strings.roster.addHero}
            </Link>
          </div>
          {warband.heroes.length === 0 && <p className="text-bone-300 text-sm">{strings.roster.noHeroes}</p>}
          <div className="space-y-2">
            {warband.heroes.map((hero) => (
              <ModelRow
                key={hero.id}
                to={`/warbands/${warband.id}/hero/${hero.id}`}
                model={hero}
                warbandType={warband.warbandType}
                photoUrl={photos[hero.id]}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeading>{strings.roster.henchmenSection}</SectionHeading>
            <Link to={`/warbands/${warband.id}/add-henchmen`} className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
              {strings.roster.addHenchmen}
            </Link>
          </div>
          {warband.henchmenGroups.length === 0 && (
            <p className="text-bone-300 text-sm">{strings.roster.noHenchmen}</p>
          )}
          <div className="space-y-2">
            {warband.henchmenGroups.map((group) => (
              <HenchmenGroupCard
                key={group.id}
                warbandId={warband.id}
                warbandType={warband.warbandType}
                group={group}
                photoUrl={photos[group.id]}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeading>{strings.roster.hiredSwordsSection}</SectionHeading>
            <Link to={`/warbands/${warband.id}/add-hired-sword`} className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
              {strings.roster.addHiredSword}
            </Link>
          </div>
          {warband.hiredSwords.length === 0 && (
            <p className="text-bone-300 text-sm">{strings.roster.noHiredSwords}</p>
          )}
          <div className="space-y-2">
            {warband.hiredSwords.map((sword) => (
              <ModelRow
                key={sword.id}
                to={`/warbands/${warband.id}/hired-sword/${sword.id}`}
                model={sword}
                warbandType={warband.warbandType}
                photoUrl={photos[sword.id]}
              />
            ))}
          </div>
        </section>

        <WarbandSharingCard warbandId={warband.id} />

        <ShareableWarbandCard warband={draft} />

        {/* Opens in place rather than as a dialog — see ConfirmByTyping. */}
        {!confirmingDelete ? (
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            {strings.roster.deleteWarband}
          </Button>
        ) : (
          <div className="space-y-2">
            <ConfirmByTyping
              phrase={warband.name}
              label={strings.roster.deleteWarbandTypeLabel(warband.name)}
              action={strings.roster.deleteWarbandAction}
              onConfirm={handleDelete}
              // Only when there is a second party to warn about. A checkbox on
              // a standalone warband would be a tick-box for its own sake, and
              // ticking things for their own sake is how people learn to tick
              // without reading.
              acknowledge={
                campaignName ? strings.roster.deleteWarbandCampaignAck(campaignName) : undefined
              }
              impact={
                <>
                  <p>{strings.roster.deleteWarbandImpact(countModels(warband), campaignName)}</p>
                  <p>{strings.roster.deleteWarbandKeeps}</p>
                  <p className="text-bone-400">{strings.roster.deleteWarbandRecoverable}</p>
                </>
              }
            />
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="w-full min-h-[44px] rounded-md text-bone-300 text-sm"
            >
              {strings.roster.deleteWarbandCancel}
            </button>
          </div>
        )}

        <SaveBar dirty={dirty} onSave={save} onDiscard={discard} />
      </main>
    </div>
  );
}
