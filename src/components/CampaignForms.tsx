import { useState } from 'react';
import DisclosureChevron from './DisclosureChevron';
import { strings } from '../strings';
import { useCreateCampaignMutation, useJoinCampaignMutation } from '../hooks/useCampaign';

/**
 * Entering a code someone shared with you.
 *
 * Appears both in the no-campaign entry state and on the Players tab: a player
 * who already has a campaign of their own (the post-battle wizard creates one
 * automatically on the first committed battle) still needs somewhere to paste a
 * code, and gating this behind "has no campaign" would lock most users out of
 * ever joining one.
 */
export function JoinCampaignForm({ title, compact = false }: { title: string; compact?: boolean }) {
  const joinCampaign = useJoinCampaignMutation();
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    setJoining(true);
    setJoinError(null);
    const error = await joinCampaign(code);
    setJoining(false);
    if (error) setJoinError(error);
    else setCode('');
  }

  const field = (
    <input
      type="text"
      value={code}
      onChange={(e) => setCode(e.target.value)}
      placeholder={strings.campaign.joinCodePlaceholder}
      aria-label={strings.campaign.joinCodeLabel}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 font-mono tracking-widest uppercase focus:outline-none focus:border-ember-500"
    />
  );

  const submit = (
    <button
      type="button"
      onClick={handleJoin}
      disabled={joining || !code.trim()}
      className="min-h-[48px] px-4 rounded-md border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800 disabled:opacity-50 transition-colors shrink-0"
    >
      {strings.campaign.joinButton}
    </button>
  );

  // Compact: one row above the tabs, so it's visible without hunting for it but
  // doesn't compete with the campaign you're actually looking at.
  if (compact) {
    return (
      <section className="space-y-2">
        <label className="block text-bone-300 text-sm">{title}</label>
        <div className="flex gap-2">
          {field}
          {submit}
        </div>
        {joinError && <p className="text-sm text-red-400">{joinError}</p>}
      </section>
    );
  }

  return (
    <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <h2 className="text-bone-100 font-semibold">{title}</h2>
      <p className="text-bone-300 text-sm">{strings.campaign.joinHint}</p>
      <div className="space-y-1">
        <label className="text-bone-300 text-sm">{strings.campaign.joinCodeLabel}</label>
        {field}
      </div>
      {joinError && <p className="text-sm text-red-400">{joinError}</p>}
      <div className="flex">
        <button
          type="button"
          onClick={handleJoin}
          disabled={joining || !code.trim()}
          className="w-full min-h-[48px] rounded-md border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800 disabled:opacity-50 transition-colors"
        >
          {strings.campaign.joinButton}
        </button>
      </div>
    </section>
  );
}

/**
 * Starting a campaign.
 *
 * Lives in its own component because it is needed twice: on the first-run
 * screen, and again once you already lead one. Nothing in the rules or the
 * schema limits a player to a single campaign — `campaign_members` is keyed on
 * (campaign, user) precisely so one person can be in several — but the form was
 * only reachable from the no-campaign branch, so in practice a leader was stuck
 * with the first one they made and could only ever *join* others after that.
 */
export function CreateCampaignForm({ title, hint, compact = false }: { title: string; hint: string; compact?: boolean }) {
  const createCampaign = useCreateCampaignMutation();
  const [open, setOpen] = useState(!compact);
  const [draftName, setDraftName] = useState('My Campaign');
  const [draftUsesBtb, setDraftUsesBtb] = useState(false);

  const body = (
    <>
      <p className="text-bone-300 text-sm">{hint}</p>
      <div className="space-y-1">
        <label className="text-bone-300 text-sm">{strings.campaign.nameLabel}</label>
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder={strings.campaign.namePlaceholder}
          className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
        />
      </div>
      <label className="flex items-center gap-2 min-h-[44px] text-bone-200 text-sm">
        <input
          type="checkbox"
          checked={draftUsesBtb}
          onChange={(e) => setDraftUsesBtb(e.target.checked)}
          className="h-5 w-5 shrink-0"
        />
        {strings.campaign.usesBtbLabel}
      </label>
      <button
        type="button"
        onClick={() => createCampaign(draftName.trim() || 'My Campaign', draftUsesBtb)}
        className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
      >
        {strings.campaign.startButton}
      </button>
    </>
  );

  if (!compact) {
    return (
      <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
        <h2 className="text-bone-100 font-semibold">{title}</h2>
        {body}
      </section>
    );
  }

  // Folded away when you already have a campaign: starting another is a rare
  // thing to want, and it shouldn't push the log down the screen.
  return (
    <section className="rounded-lg bg-ink-900 border border-ink-800 px-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-[48px] flex items-center gap-2 text-left text-bone-100 font-semibold"
      >
        <DisclosureChevron open={open} />
        {title}
      </button>
      {open && <div className="pb-4 space-y-3">{body}</div>}
    </section>
  );
}
