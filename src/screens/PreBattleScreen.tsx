import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { Button, TextField, Textarea, Select } from '../components/ui';
import { strings } from '../strings';
import { BattleSession, defaultBattleSession, useAppStore } from '../store/useAppStore';
import { useWarbandList, useWarbandLookup } from '../hooks/useWarbands';
import { useBattlesQuery, useCampaignWarbandsQuery, useMyCampaignQuery } from '../hooks/useCampaign';
import scenariosData from '../data/scenarios.json';
import { suggestScenario } from '../lib/scenarioSuggest';
import { computeWarbandRating } from '../lib/rating';
import ScenarioSetupPanel from '../components/ScenarioSetupPanel';

export default function PreBattleScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const warbands = useWarbandList();
  const { warband, loading } = useWarbandLookup(warbandId);
  const otherWarbands = warbands.filter((w) => w.id !== warbandId);
  const { data: campaign } = useMyCampaignQuery();
  const { data: campaignWarbands } = useCampaignWarbandsQuery(campaign?.id);
  // Gates scenarios with a minimum campaign-progress requirement; for a one-off
  // game (no campaign) everything is eligible.
  const { data: campaignBattles } = useBattlesQuery(campaign?.id);
  // Everything in the campaign that isn't already offered above: this warband,
  // and any of the player's own, which are listed in their own group.
  const ownIds = new Set(warbands.map((w) => w.id));
  const campaignOpponents = (campaignWarbands ?? []).filter((w) => !ownIds.has(w.id));
  const storedSession = useAppStore((state) => (warbandId ? state.battleSessions[warbandId] : undefined));
  const setStoredSession = useAppStore((state) => state.setBattleSession);
  const clearStoredSession = useAppStore((state) => state.clearBattleSession);

  const [session, setSession] = useState<BattleSession>(
    () => storedSession ?? defaultBattleSession(warbandId ?? ''),
  );
  const [lastRandomRoll, setLastRandomRoll] = useState<string | null>(null);
  const [showFairPairing, setShowFairPairing] = useState(false);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
  if (!warband) return <Navigate to="/warbands" replace />;

  function updateSession(patch: Partial<BattleSession>) {
    const updated = { ...session, ...patch };
    setSession(updated);
    setStoredSession(updated);
  }

  // Fair-pairing: every opponent you could pick, ranked by how close its rating
  // is to yours. Your own warbands compute their rating; a campaign opponent's
  // is carried on its row. A close match is a fair game; a big gap tells you
  // who'd be the underdog before you commit.
  const myRating = computeWarbandRating(warband);
  const pairingCandidates = [
    ...otherWarbands.map((w) => ({
      id: w.id,
      name: w.name,
      rating: computeWarbandRating(w),
      sub: strings.battle.preBattle.opponentGroupMine,
    })),
    ...campaignOpponents.map((w) => ({
      id: w.id,
      name: w.name,
      rating: w.rating,
      sub: w.playerName || strings.campaign.unnamedPlayer,
    })),
  ].sort((a, b) => Math.abs(a.rating - myRating) - Math.abs(b.rating - myRating));

  function pickOpponent(id: string, name: string) {
    updateSession({ opponentWarbandId: id, opponentName: name });
  }

  // A saved draft only counts as "a battle in progress" once there's real
  // during-battle work in it — not merely a scenario picked on this very screen.
  // On that, offer restore rather than silently resuming (§4.3.2).
  const hasProgress =
    !!storedSession &&
    (storedSession.turn > 1 ||
      storedSession.events.length > 0 ||
      storedSession.outOfAction.heroIds.length > 0 ||
      storedSession.outOfAction.hiredSwordIds.length > 0 ||
      Object.keys(storedSession.outOfAction.henchmenCounts).length > 0 ||
      Object.keys(storedSession.enemyOutOfAction).length > 0 ||
      Object.keys(storedSession.wyrdstoneCarried).length > 0);

  function discardDraft() {
    if (!warband) return;
    clearStoredSession(warband.id);
    setSession(defaultBattleSession(warband.id));
  }

  // Weighted suggestion (§21.3): a group plays some scenarios far more than
  // others, so this is not a uniform roll. Only ever fills the field the manual
  // picker fills — the player keeps or changes it.
  function rollRandomScenario() {
    const picked = suggestScenario(campaign ? (campaignBattles?.length ?? 0) : undefined);
    if (!picked) return;
    setLastRandomRoll(picked.name);
    updateSession({ scenario: picked.name });
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.battle.preBattle.title} subtitle={warband.name} />

      <main className="flex-1 px-4 py-6 space-y-6">
        {hasProgress && (
          <div className="rounded-lg border border-ember-500/50 bg-ember-500/10 p-4 space-y-2">
            <p className="text-ember-400 font-semibold text-sm">{strings.battle.preBattle.restore.title}</p>
            <p className="text-bone-300 text-xs">
              {strings.battle.preBattle.restore.since(
                storedSession?.startedAt ? new Date(storedSession.startedAt).toLocaleString() : '',
              )}
            </p>
            <div className="flex gap-2">
              <Button
                size="dense"
                fullWidth={false}
                onClick={() => navigate(`/warbands/${warband.id}/during-battle`)}
                className="flex-1"
              >
                {strings.battle.preBattle.restore.resume}
              </Button>
              <Button size="dense" variant="secondary" fullWidth={false} onClick={discardDraft} className="flex-1">
                {strings.battle.preBattle.restore.discard}
              </Button>
            </div>
          </div>
        )}

        <section className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="scenario">
            {strings.battle.preBattle.scenarioLabel}
          </label>
          <Select
            id="scenario"
            value={session.scenario}
            onChange={(e) => {
              setLastRandomRoll(null);
              updateSession({ scenario: e.target.value });
            }}
          >
            <option value="">{strings.battle.preBattle.scenarioPlaceholder}</option>
            {scenariosData.scenarios.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button size="dense" onClick={rollRandomScenario}>
            {strings.battle.preBattle.rollRandomButton}
          </Button>
          {lastRandomRoll && (
            <p className="text-bone-300 text-xs">{strings.battle.preBattle.randomRollResultLabel(lastRandomRoll)}</p>
          )}
          {/* The data cites the chapter, not a page per scenario, so this points
              at the range rather than inventing a precise number. */}
          <p className="text-bone-400 text-xs">{strings.battle.preBattle.scenarioPageHint}</p>

          {session.scenario && <ScenarioSetupPanel scenarioName={session.scenario} />}
        </section>

        <section className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="opponent-name">
            {strings.battle.preBattle.opponentNameLabel}
          </label>
          <TextField
            id="opponent-name"
            type="text"
            value={session.opponentName}
            onChange={(e) => updateSession({ opponentName: e.target.value })}
            placeholder={strings.battle.preBattle.opponentNamePlaceholder}
          />

          <label className="block text-bone-200 text-sm font-semibold pt-2" htmlFor="opponent-warband">
            {strings.battle.preBattle.opponentWarbandLabel}
          </label>
          <Select
            id="opponent-warband"
            value={session.opponentWarbandId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              // Picking a known warband fills the free-text name too, so the
              // battle log reads sensibly without retyping it.
              const picked =
                otherWarbands.find((w) => w.id === id) ?? campaignOpponents.find((w) => w.id === id);
              updateSession({
                opponentWarbandId: id,
                opponentName: picked ? picked.name : session.opponentName,
              });
            }}
          >
            <option value="">{strings.battle.preBattle.opponentWarbandNone}</option>
            {otherWarbands.length > 0 && (
              <optgroup label={strings.battle.preBattle.opponentGroupMine}>
                {otherWarbands.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </optgroup>
            )}
            {campaignOpponents.length > 0 && (
              <optgroup label={strings.battle.preBattle.opponentGroupCampaign}>
                {campaignOpponents.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.playerName || strings.campaign.unnamedPlayer}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
          {campaign && campaignOpponents.length === 0 && (
            <p className="text-bone-400 text-xs">{strings.battle.preBattle.noCampaignOpponents}</p>
          )}

          {pairingCandidates.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowFairPairing((v) => !v)}
                className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
              >
                {strings.battle.preBattle.fairPairing.toggle}
              </button>

              {showFairPairing && (
                <div className="mt-1 rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-bone-300 text-xs uppercase tracking-wide">
                      {strings.battle.preBattle.fairPairing.heading}
                    </p>
                    <p className="text-bone-400 text-xs tabular-nums">
                      {strings.battle.preBattle.fairPairing.myRating(myRating)}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {pairingCandidates.map((c) => {
                      const gap = c.rating - myRating;
                      const gapLabel =
                        gap === 0
                          ? strings.battle.preBattle.fairPairing.even
                          : gap > 0
                            ? strings.battle.preBattle.fairPairing.theyFavoured(gap)
                            : strings.battle.preBattle.fairPairing.youFavoured(-gap);
                      const selected = session.opponentWarbandId === c.id;
                      return (
                        <li
                          key={c.id}
                          className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                            selected ? 'border-ember-500 bg-ink-800' : 'border-ink-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-bone-100 text-sm font-semibold truncate">{c.name}</p>
                            <p className="text-bone-400 text-xs truncate">
                              {c.sub} · {strings.battle.preBattle.fairPairing.ratingLabel(c.rating)}
                            </p>
                            <p
                              className={`text-xs ${
                                gap > 0 ? 'text-ember-400' : gap < 0 ? 'text-bone-300' : 'text-verdigris'
                              }`}
                            >
                              {gapLabel}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => pickOpponent(c.id, c.name)}
                            disabled={selected}
                            className="shrink-0 min-h-[40px] px-3 rounded-md border border-ink-700 text-bone-100 text-sm font-semibold disabled:opacity-50 disabled:border-ember-500 disabled:text-ember-400"
                          >
                            {selected
                              ? strings.battle.preBattle.fairPairing.picked
                              : strings.battle.preBattle.fairPairing.pick}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="pre-battle-notes">
            {strings.battle.preBattle.notesLabel}
          </label>
          <Textarea
            id="pre-battle-notes"
            value={session.notes}
            onChange={(e) => updateSession({ notes: e.target.value })}
          />
        </section>

        <Button onClick={() => navigate(`/warbands/${warband.id}/during-battle`)}>
          {strings.battle.preBattle.continueButton}
        </Button>

        <Link
          to={`/warbands/${warband.id}/post-battle`}
          className="block text-center w-full min-h-[44px] leading-[44px] text-bone-300 text-sm"
        >
          {strings.battle.preBattle.skipToPostBattle}
        </Link>
      </main>
    </div>
  );
}
