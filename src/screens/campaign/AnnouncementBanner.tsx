import { useState } from 'react';
import ConfirmAction from '../../components/ConfirmAction';
import { Button, Textarea } from '../../components/ui';
import { strings } from '../../strings';
import {
  useSetAnnouncementMutation } from '../../hooks/useCampaign';
import { Campaign } from '../../types';

/**
 * The narrative log (§17.3) — a story between games, on the same Log tab as the
 * battle records because both answer "what happened over time". A composer, then
 * the entries newest-first. Any member may write; the author or a leader may
 * remove (the 0017 policy decides, not this component).
 */
/**
 * §19.3 — the campaign's single pinned announcement. Shown above the tabs to
 * everyone who can see the campaign; a leader also gets the editor here. Kept
 * out of the Log tab so a notice can't hide behind a tab nobody has open.
 */
export function AnnouncementBanner({ campaign, isLeader }: { campaign: Campaign; isLeader: boolean }) {
  const setAnnouncement = useSetAnnouncementMutation(campaign.id);
  const current = campaign.pinnedAnnouncement;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const s = strings.campaign.announcement;

  function openEditor() {
    setDraft(current ?? '');
    setEditing(true);
  }
  function save() {
    setAnnouncement(draft.trim() || null);
    setEditing(false);
  }
  const [confirmClear, setConfirmClear] = useState(false);
  function clear() {
    setConfirmClear(true);
  }

  // A player with nothing pinned sees nothing; only a leader gets the affordance.
  if (!current && !isLeader && !editing) return null;

  if (editing) {
    return (
      <section className="rounded-lg bg-ink-900 border border-ember-500/40 p-4 space-y-2">
        <label htmlFor="campaign-announcement" className="text-bone-300 text-sm">
          {s.label}
        </label>
        <Textarea
          id="campaign-announcement"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={s.placeholder}
          rows={2}
        />
        <div className="flex gap-2">
          <Button size="dense" fullWidth={false} onClick={save} className="flex-1">
            {current ? s.update : s.save}
          </Button>
          <Button size="dense" variant="secondary" fullWidth={false} onClick={() => setEditing(false)} className="flex-1">
            {s.cancel}
          </Button>
        </div>
      </section>
    );
  }

  if (!current) {
    // Leader, nothing pinned yet.
    return (
      <button
        type="button"
        onClick={openEditor}
        className="w-full rounded-lg border border-dashed border-ink-700 text-bone-300 text-sm py-2 hover:border-ember-500 hover:text-bone-100"
      >
        + {s.pin}
      </button>
    );
  }

  return (
    <section className="rounded-lg bg-ember-500/10 border border-ember-500/40 p-4 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <span className="text-ember-400 text-xs font-semibold uppercase tracking-wide">{s.label}</span>
        {isLeader && (
          <div className="flex gap-3 shrink-0">
            <button type="button" onClick={openEditor} className="text-bone-300 text-xs font-semibold">
              {s.update}
            </button>
            <button type="button" onClick={clear} className="text-danger text-xs font-semibold">
              {s.clear}
            </button>
          </div>
        )}
      </div>
      <p className="text-bone-100 whitespace-pre-wrap">{current}</p>
      {campaign.pinnedAnnouncementAt && (
        <p className="text-bone-400 text-xs">
          {s.posted(new Date(campaign.pinnedAnnouncementAt).toLocaleDateString())}
        </p>
      )}
      {confirmClear && (
        <ConfirmAction
          prompt={s.clearConfirm}
          action={s.clear}
          onConfirm={() => {
            setAnnouncement(null);
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </section>
  );
}
