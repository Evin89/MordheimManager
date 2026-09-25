import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { recordSignupSelfReport } from '../api/profile';
import { isDemoMode } from '../dev/demoMode';
import type { SelfReportAnswer } from '../lib/acquisition';
import { strings } from '../strings';
import SelfReportFields from './SelfReportFields';
import { Button, Card } from './ui';

/**
 * §26.7.2 follow-up — the register form's "How did you find Mordheim Manager?"
 * for accounts made with Google, which never see that form. Asked once, as an
 * inline card, to a Google account less than a day old (the same 24-hour fence
 * the database applies, migration 0049). Saving or skipping both retire it for
 * good on this device: it's a one-off question, not a nag.
 *
 * The "asked" flag is a per-viewer convenience in localStorage, guarded because
 * access can throw — worst case the card shows again, and the database's
 * write-once rule makes a second answer a no-op.
 */

const ASKED_PREFIX = 'mordheim.selfReportAsked.';
const WINDOW_MS = 24 * 3600 * 1000;

function wasAsked(userId: string): boolean {
  try {
    return window.localStorage.getItem(ASKED_PREFIX + userId) === '1';
  } catch {
    return false;
  }
}

function markAsked(userId: string): void {
  try {
    window.localStorage.setItem(ASKED_PREFIX + userId, '1');
  } catch {
    /* ignore */
  }
}

export default function GoogleSelfReportCard() {
  const { user } = useAuth();
  const [answer, setAnswer] = useState<SelfReportAnswer | ''>('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  // Checked every render, not captured once: the session can arrive after mount.
  if (!user || done || isDemoMode() || wasAsked(user.id)) return null;
  const viaGoogle =
    user.app_metadata?.provider === 'google' || (user.identities ?? []).some((i) => i.provider === 'google');
  const fresh = Date.now() - Date.parse(user.created_at) < WINDOW_MS;
  if (!viaGoogle || !fresh) return null;

  function finish() {
    markAsked(user!.id);
    setDone(true);
  }

  async function save() {
    if (!answer) return finish();
    setSaving(true);
    await recordSignupSelfReport(answer, note);
    setSaving(false);
    finish();
  }

  return (
    <Card as="section" gap="sm">
      <p className="text-sm text-bone-200">{strings.auth.selfReportCardIntro}</p>
      <SelfReportFields answer={answer} note={note} onAnswer={setAnswer} onNote={setNote} idPrefix="googleSelfReport" />
      <div className="flex flex-wrap gap-2">
        <Button size="dense" onClick={() => void save()} disabled={saving || !answer}>
          {strings.auth.selfReportSave}
        </Button>
        <Button size="dense" variant="ghost" onClick={finish}>
          {strings.auth.selfReportDismiss}
        </Button>
      </div>
    </Card>
  );
}
