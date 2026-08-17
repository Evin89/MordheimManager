import { useState } from 'react';
import DisclosureChevron from './DisclosureChevron';
import { strings } from '../strings';
import { useCreateCampaignMutation, useJoinCampaignMutation } from '../hooks/useCampaign';
import { Button, Card, SectionHeading, Field, TextField } from './ui';

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
    <TextField
      type="text"
      value={code}
      onChange={(e) => setCode(e.target.value)}
      placeholder={strings.campaign.joinCodePlaceholder}
      aria-label={strings.campaign.joinCodeLabel}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      className="font-mono tracking-widest uppercase"
    />
  );

  // Compact: one row above the tabs, so it's visible without hunting for it but
  // doesn't compete with the campaign you're actually looking at.
  if (compact) {
    return (
      <section className="space-y-2">
        <label className="block text-bone-300 text-sm">{title}</label>
        <div className="flex gap-2">
          {field}
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={handleJoin}
            disabled={joining || !code.trim()}
            className="shrink-0"
          >
            {strings.campaign.joinButton}
          </Button>
        </div>
        {joinError && <p className="text-sm text-blood-500">{joinError}</p>}
      </section>
    );
  }

  return (
    <Card as="section">
      <SectionHeading>{title}</SectionHeading>
      <p className="text-bone-300 text-sm">{strings.campaign.joinHint}</p>
      <Field label={strings.campaign.joinCodeLabel}>{field}</Field>
      {joinError && <p className="text-sm text-blood-500">{joinError}</p>}
      <Button variant="secondary" onClick={handleJoin} disabled={joining || !code.trim()}>
        {strings.campaign.joinButton}
      </Button>
    </Card>
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
      <Field label={strings.campaign.nameLabel}>
        <TextField
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder={strings.campaign.namePlaceholder}
        />
      </Field>
      <label className="flex items-center gap-2 min-h-[44px] text-bone-200 text-sm">
        <input
          type="checkbox"
          checked={draftUsesBtb}
          onChange={(e) => setDraftUsesBtb(e.target.checked)}
          className="h-5 w-5 shrink-0"
        />
        {strings.campaign.usesBtbLabel}
      </label>
      <Button onClick={() => createCampaign(draftName.trim() || 'My Campaign', draftUsesBtb)}>
        {strings.campaign.startButton}
      </Button>
    </>
  );

  if (!compact) {
    return (
      <Card as="section">
        <SectionHeading>{title}</SectionHeading>
        {body}
      </Card>
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
