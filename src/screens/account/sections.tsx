import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ConfirmByTyping from '../../components/ConfirmByTyping';
import { strings } from '../../strings';
import { useAuth } from '../../auth/AuthProvider';
import { ImportValidationError, downloadExport, importAllData, parseImportFile } from '../../storage/persistence';
import { usePush } from '../../hooks/usePush';
import {
  analyticsConfigurable,
  consentChoice,
  setAnalyticsConsent,
  subscribeConsent,
} from '../../lib/analyticsConsent';
import { useInstall } from '../../hooks/useInstall';
import ActivityPanel, { activityWindow } from '../../components/activity/ActivityPanel';
import { useMyActivityDayQuery, useMyActivityQuery } from '../../hooks/useActivity';
import type { ActivityItem } from '../../lib/activityKinds';
import { Button, Card, SectionHeading } from '../../components/ui';
import { deleteMyAccount } from '../../api/account';
import { isDemoMode } from '../../dev/demoMode';

/*
 * The Account sections (§4.6), shared by the sub-screens of §40.4. Lifted out
 * of the old single Account screen unchanged apart from being exported.
 */

/**
 * §19.4 — the game-night reminder toggle. Per device (a push subscription is a
 * browser's, not an account's), so the copy speaks about "this device". Hidden
 * where push can't work — no VAPID key, or plain mobile Safari that hasn't been
 * added to the Home Screen — with a hint instead of a dead switch.
 */
export function NotificationsSection() {
  const { supported, subscribed, permission, busy, enable, disable } = usePush();
  const [message, setMessage] = useState<string | null>(null);
  const s = strings.account.notifications;
  const installState = useInstall();
  const canInstall = installState !== 'installed' && installState !== 'unsupported';

  async function toggle() {
    setMessage(null);
    if (subscribed) {
      await disable();
      return;
    }
    const result = await enable();
    if (result === 'denied') setMessage(s.denied);
    else if (result === 'unsupported') setMessage(s.unsupportedHint);
  }

  return (
    <Card as="section">
      <SectionHeading>{s.section}</SectionHeading>
      <p className="text-bone-300 text-sm">{s.hint}</p>
      {!supported ? (
        <p className="text-bone-400 text-xs">
          {s.unsupportedHint}
          {/* §36.4 — lead the explanation somewhere actionable. */}
          {canInstall && (
            <>
              {' '}
              <a href="#install" className="text-ember-400 font-semibold">
                {strings.install.pushLink}
              </a>
            </>
          )}
        </p>
      ) : permission === 'denied' ? (
        <p className="text-bone-400 text-xs">{s.blocked}</p>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          role="switch"
          aria-checked={subscribed}
          className={`min-h-[44px] px-4 rounded-md border font-semibold ${
            subscribed ? 'border-ember-500 text-ember-400' : 'border-ink-700 text-bone-200 hover:bg-ink-800'
          } disabled:opacity-60`}
        >
          {busy ? strings.common.loading : subscribed ? s.on : s.off}
        </button>
      )}
      {message && <p className="text-bone-400 text-xs">{message}</p>}
    </Card>
  );
}

/**
 * §23.7 / Privacy Policy §10 — the standing analytics control, so a choice made
 * (or skipped) at the first-run banner can be changed at any time. Applies to
 * everyone, signed in or not: analytics is anonymous. Hidden entirely when it
 * can't run regardless — no PostHog project, demo mode, or the browser sending
 * Do-Not-Track — because a switch that does nothing is worse than no switch.
 */
export function AnalyticsSection() {
  const [choice, setChoice] = useState(consentChoice());
  useEffect(() => subscribeConsent(setChoice), []);

  if (!analyticsConfigurable()) return null;

  const on = choice === 'granted';
  const s = strings.account.analytics;

  return (
    <Card as="section">
      <SectionHeading>{s.section}</SectionHeading>
      <p className="text-bone-300 text-sm">{s.hint}</p>
      <button
        type="button"
        onClick={() => setAnalyticsConsent(!on)}
        role="switch"
        aria-checked={on}
        className={`min-h-[44px] px-4 rounded-md border font-semibold ${
          on ? 'border-ember-500 text-ember-400' : 'border-ink-700 text-bone-200 hover:bg-ink-800'
        }`}
      >
        {on ? s.on : s.off}
      </button>
      <p>
        <a href="/privacy.html" className="text-ember-400 text-sm underline underline-offset-2">
          {s.privacyLink}
        </a>
      </p>
    </Card>
  );
}

/**
 * §4.9.4.1 — your own activity calendar. The same panel an admin sees on the
 * player screen, fed by `my_activity()`, which takes no user id: nothing about
 * a player is visible to the operator that the player can't see themselves.
 *
 * Collapsed by default and fetched only once opened (§12.2 fetch-narrowly) —
 * it's a curiosity, not something anyone needs on every visit to Account.
 */
/** Your own warbands open in the editor; a warband you commented on opens as
 * the shared roster. Campaigns have no per-id screen to link to. */
function selfHref(item: ActivityItem): string | null {
  if (item.kind === 'warband_created' || item.kind === 'warband_edit') return `/warbands/${item.refId}`;
  if (item.kind === 'comment') return `/rosters/${item.refId}`;
  return null;
}

export function YourActivitySection() {
  const [open, setOpen] = useState(false);
  const [range] = useState(() => activityWindow());
  const [day, setDay] = useState<string | null>(null);
  const { data, isLoading, error } = useMyActivityQuery(range.from, range.to, open);
  const dayItems = useMyActivityDayQuery(open ? day : null);
  const s = strings.activity;

  return (
    <Card as="section">
      <SectionHeading>{s.selfTitle}</SectionHeading>
      <p className="text-bone-300 text-sm">{s.selfHint}</p>
      {open ? (
        <>
          <ActivityPanel
            rows={data}
            isLoading={isLoading}
            error={error}
            start={range.start}
            end={range.end}
            selected={day}
            onSelect={setDay}
            dayItems={dayItems}
            hrefFor={selfHref}
          />
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {s.hide}
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {s.show}
        </Button>
      )}
    </Card>
  );
}

/**
 * Export and import (§4.6). Import replaces everything on the account, so a
 * parsed file waits for the type-to-confirm (§10.1) before anything is written.
 */
export function DataSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof parseImportFile> | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    if (!user) return;
    try {
      await downloadExport(user.id);
    } catch {
      setImportMessage(strings.connection.lost);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;
    setImportMessage(null);
    try {
      const text = await file.text();
      // Parse first, so a bad file is reported before anything is asked of
      // the user; the overwrite itself waits for the inline confirm below.
      setPendingImport(parseImportFile(text));
    } catch (err) {
      const message = err instanceof ImportValidationError ? err.message : 'Unexpected error reading file.';
      setImportMessage(strings.account.importError(message));
    }
  }

  async function confirmImport() {
    if (!pendingImport || !user) return;
    setImporting(true);
    try {
      await importAllData(user.id, pendingImport);
      // Import replaces server-side rows wholesale, so drop every cached query
      // rather than trying to patch individual entries.
      await queryClient.invalidateQueries();
      setImportMessage(strings.account.importSuccess);
    } catch (err) {
      const message = err instanceof ImportValidationError ? err.message : 'Unexpected error reading file.';
      setImportMessage(strings.account.importError(message));
    } finally {
      setImporting(false);
      setPendingImport(null);
    }
  }

  return (
    <Card as="section">
      <SectionHeading>{strings.account.dataSection}</SectionHeading>
      {user ? (
        <>
          <div className="flex flex-col gap-3">
            <Button onClick={handleExport}>{strings.account.exportButton}</Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {strings.account.importButton}
            </Button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
          </div>
          {pendingImport && (
            <ConfirmByTyping
              phrase={strings.account.importConfirmPhrase}
              label={strings.account.importConfirmLabel}
              action={strings.account.importConfirmAction}
              impact={<p>{strings.account.importOverwriteWarning}</p>}
              busy={importing}
              onConfirm={confirmImport}
            />
          )}
          {importMessage && <p className="text-sm text-bone-300">{importMessage}</p>}
        </>
      ) : (
        <p className="text-bone-300 text-sm">{strings.account.signedOutHint}</p>
      )}
    </Card>
  );
}

/**
 * §35.5 — delete your own account (migration 0066). Behind a button so the
 * danger zone isn't open by default, then the unrecoverable tier (§10.1):
 * the impact in full, and a typed phrase.
 *
 * Lives on Account › Your data, which requires sign-in, so the "deleted"
 * confirmation is shown on the sign-in screen this sends you to.
 */
export function DeleteAccountSection() {
  const s = strings.account;
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const demo = isDemoMode();
      await deleteMyAccount();
      queryClient.clear();
      navigate('/login', { replace: true, state: { accountDeleted: true } });
      // Demo mode has no server session; leaving it is its sign-out.
      if (demo) await signOut();
    } catch (err) {
      setError(s.deleteAccountError(err instanceof Error ? err.message : String(err)));
      setBusy(false);
    }
  }

  return (
    <Card as="section">
      <SectionHeading>{s.deleteAccountSection}</SectionHeading>
      <p className="text-bone-300 text-sm">{s.deleteAccountIntro}</p>
      {!open ? (
        <Button variant="danger" onClick={() => setOpen(true)}>
          {s.deleteAccountButton}
        </Button>
      ) : (
        <>
          <ConfirmByTyping
            phrase={s.deleteAccountPhrase}
            label={s.deleteAccountLabel}
            action={s.deleteAccountAction}
            impact={
              <>
                <p>{s.deleteAccountGoes}</p>
                <p>{s.deleteAccountStays}</p>
                <p>{s.deleteAccountLeaders}</p>
              </>
            }
            busy={busy}
            onConfirm={confirm}
          />
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            {s.deleteAccountCancel}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}
