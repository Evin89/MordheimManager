import { Link, useNavigate } from 'react-router-dom';
import { CreateCampaignForm, JoinCampaignForm } from '../components/CampaignForms';
import { strings } from '../strings';
import { useCampaignSummariesQuery, useSetActiveCampaign } from '../hooks/useCampaign';
import { readActiveCampaignId } from '../lib/activeCampaign';
import { CampaignSummary } from '../types';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <p className="font-heading-sc text-ink-faded text-xs uppercase tracking-[0.06em]">{label}</p>
      <p className="text-bone-100 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CampaignCard({
  summary,
  isActive,
  onOpen,
}: {
  summary: CampaignSummary;
  isActive: boolean;
  onOpen: () => void;
}) {
  const { campaign, role, memberCount, battleCount, myWarbandCount } = summary;
  const isLeader = role === 'campaign_leader';

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        isActive ? 'border-ember-500 bg-ink-900' : 'border-ink-800 bg-ink-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-bone-100 font-semibold truncate">{campaign.name}</p>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {/* Role first: it's the thing that decides what you can do here. */}
            <span
              className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${
                isLeader
                  ? 'border-ember-500 text-ember-400'
                  : 'border-ink-700 text-bone-300'
              }`}
            >
              {isLeader ? strings.campaign.roleLeader : strings.campaign.rolePlayer}
            </span>
            {campaign.usesBTB && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-bone-300">
                {strings.home.btbBadge}
              </span>
            )}
            {isActive && (
              <span className="text-xs font-semibold uppercase tracking-wide text-ember-400">
                {strings.campaign.activeBadge}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={strings.campaign.playersStat} value={memberCount} />
        <Stat label={strings.campaign.battlesStat} value={battleCount} />
        <Stat label={strings.campaign.yourWarbandsStat} value={myWarbandCount} />
      </div>

      {/* Only leaders can hand the code out, so only they are shown it here. */}
      {isLeader && campaign.joinCode && (
        <p className="text-bone-300 text-sm">
          {strings.campaign.joinCodeLabel}:{' '}
          <code className="font-mono tracking-widest text-ember-400">{campaign.joinCode}</code>
        </p>
      )}

      {/* Only on the campaign you're actually in: /campaign/events resolves
          against the active campaign, so offering it on the others would open
          the wrong one's calendar. */}
      {isActive && (
        <Link
          to="/campaign/events"
          className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
        >
          {strings.events.homeLink}
        </Link>
      )}

      <button
        type="button"
        onClick={onOpen}
        className={`w-full min-h-[48px] rounded-md font-semibold transition-colors ${
          isActive
            ? 'border border-ink-700 text-bone-100 hover:bg-ink-800'
            : 'bg-ember-500 hover:bg-ember-600 text-ink-950'
        }`}
      >
        {isActive ? strings.campaign.openActive : strings.campaign.switchToThis}
      </button>
    </div>
  );
}

/**
 * Every campaign you're in, at a glance.
 *
 * The campaign screen only ever shows one campaign, and switching was a bare
 * dropdown of names — which tells you nothing about which one you lead, which
 * is still being played, or where your warbands are. This is the index that was
 * missing; the campaign screen remains the detail view for whichever is active.
 */
export default function MyCampaignsScreen() {
  const { data: summaries, isLoading } = useCampaignSummariesQuery();
  const setActiveCampaign = useSetActiveCampaign();
  const navigate = useNavigate();
  const activeId = readActiveCampaignId();

  function open(campaignId: string) {
    setActiveCampaign(campaignId);
    navigate('/campaign');
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* A plain header, not BackHeader: this is now a nav destination in its
          own right, and a back arrow on a tab root goes nowhere useful. */}
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.campaign.myCampaignsTitle}</h1>
      </header>

      <main className="flex-1 px-4 py-6 space-y-4">
        {isLoading && <p className="text-bone-300">{strings.common.loading}</p>}

        {!isLoading && (summaries?.length ?? 0) === 0 && (
          <p className="text-bone-300 text-sm">{strings.campaign.myCampaignsEmpty}</p>
        )}

        {(summaries ?? []).map((summary) => (
          <CampaignCard
            key={summary.campaign.id}
            summary={summary}
            // Falls back to the first, matching how the app picks one elsewhere.
            isActive={summary.campaign.id === (activeId ?? summaries?.[0]?.campaign.id)}
            onOpen={() => open(summary.campaign.id)}
          />
        ))}

        {/* The forms themselves, not a link to them. This used to send you to
            the campaign *detail* screen to find them, which is the one place a
            list of campaigns shouldn't take you. */}
        <div className="pt-2 space-y-4">
          <JoinCampaignForm title={strings.campaign.joinAnotherTitle} compact />
          <CreateCampaignForm
            title={strings.campaign.startAnotherTitle}
            hint={strings.campaign.startAnotherHint}
            compact
          />
        </div>
      </main>
    </div>
  );
}
