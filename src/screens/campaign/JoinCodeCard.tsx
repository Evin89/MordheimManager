import { useState } from 'react';
import InviteShareButtons from '../../components/InviteShareButtons';
import ConfirmAction from '../../components/ConfirmAction';
import { Button, SectionHeading } from '../../components/ui';
import { strings } from '../../strings';
import {
  useRegenerateJoinCodeMutation } from '../../hooks/useCampaign';
import { Campaign } from '../../types';

export function JoinCodeCard({ campaign, isLeader }: { campaign: Campaign; isLeader: boolean }) {
  const regenerate = useRegenerateJoinCodeMutation();
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  async function copy() {
    if (!campaign.joinCode) return;
    try {
      await navigator.clipboard.writeText(campaign.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the code is on screen to read anyway.
    }
  }

  return (
    <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <SectionHeading>{strings.campaign.shareCodeSection}</SectionHeading>
      <p className="text-bone-300 text-sm">{strings.campaign.shareCodeHint}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="flex-1 min-w-[8rem] min-h-[48px] leading-[48px] text-center rounded-md bg-ink-800 border border-ink-700 text-ember-400 font-mono text-lg tracking-widest">
          {campaign.joinCode ?? strings.campaign.noCodeYet}
        </code>
        <Button variant="secondary" fullWidth={false} onClick={copy} disabled={!campaign.joinCode}>
          {copied ? strings.campaign.codeCopied : strings.campaign.copyCode}
        </Button>
      </div>
      {campaign.joinCode && (
        <InviteShareButtons campaignName={campaign.name} joinCode={campaign.joinCode} />
      )}

      {isLeader &&
        (confirmRegenerate ? (
          <ConfirmAction
            impact={<p>{strings.campaign.regenerateConfirm}</p>}
            action={strings.campaign.regenerateAction}
            onConfirm={() => {
              regenerate(campaign.id);
              setConfirmRegenerate(false);
            }}
            onCancel={() => setConfirmRegenerate(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRegenerate(true)}
            className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
          >
            {strings.campaign.regenerateCode}
          </button>
        ))}
    </section>
  );
}
