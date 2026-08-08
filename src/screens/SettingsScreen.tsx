import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../hooks/useTheme';
import { strings } from '../strings';
import { useIsAdminQuery } from '../hooks/useIssues';
import { useAuth } from '../auth/AuthProvider';
import { ImportValidationError, downloadExport, importAllData, parseImportFile } from '../storage/persistence';
import { isDemoMode, setDemoMode } from '../dev/demoMode';
import { MAX_DISPLAY_NAME } from '../api/profile';
import { useMyProfileQuery, useUpdateDisplayNameMutation } from '../hooks/useProfile';


/**
 * Renaming yourself.
 *
 * This is the only field on the screen other people see — it labels you in
 * campaign standings, the pre-battle opponent picker and the public gallery —
 * and until now it was set once at registration and never editable, so a typo
 * at signup was permanent.
 *
 * Saved explicitly rather than on each keystroke, matching how the roster and
 * campaign screens treat typed fields: a name is something you finish writing
 * before you mean it.
 */
function DisplayNameField() {
  const { data: profile } = useMyProfileQuery();
  const mutation = useUpdateDisplayNameMutation();
  const [draft, setDraft] = useState<string | null>(null);

  // Null until the user types, so the loaded name shows without a second
  // effect copying it into state — and a rename landing elsewhere is picked up
  // rather than pinned to whatever this field first rendered.
  const value = draft ?? profile?.displayName ?? '';
  const trimmed = value.trim();
  const dirty = profile !== undefined && profile !== null && trimmed !== profile.displayName;

  return (
    <div className="space-y-2">
      <label htmlFor="display-name" className="block text-bone-300 text-sm">
        {strings.settings.displayNameLabel}
      </label>
      <input
        id="display-name"
        type="text"
        value={value}
        maxLength={MAX_DISPLAY_NAME}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
      />
      <p className="text-bone-400 text-xs">{strings.settings.displayNameHint}</p>

      {dirty && (
        <button
          type="button"
          disabled={!trimmed || mutation.isPending}
          onClick={() => mutation.mutate(trimmed, { onSuccess: () => setDraft(null) })}
          className="min-h-[48px] w-full rounded-md bg-ember-500 hover:bg-ember-600 disabled:opacity-50 text-ink-950 font-semibold px-4 transition-colors"
        >
          {mutation.isPending ? strings.common.loading : strings.settings.displayNameSave}
        </button>
      )}

      {!trimmed && <p className="text-blood-500 text-xs">{strings.settings.displayNameEmpty}</p>}
      {mutation.isSuccess && !dirty && (
        <p className="text-bone-300 text-xs">{strings.settings.displayNameSaved}</p>
      )}
      {mutation.isError && (
        <p className="text-blood-500 text-xs">{(mutation.error as Error).message}</p>
      )}
    </div>
  );
}

export default function SettingsScreen() {
  const [theme, setTheme] = useTheme();
  const { user, signOut } = useAuth();
  const { data: isAdmin } = useIsAdminQuery();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  function handleImportClick() {
    fileInputRef.current?.click();
  }

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

    try {
      const text = await file.text();
      const data = parseImportFile(text);
      if (!window.confirm(strings.settings.importOverwriteWarning)) return;
      await importAllData(user.id, data);
      // Import replaces server-side rows wholesale, so drop every cached query
      // rather than trying to patch individual entries.
      await queryClient.invalidateQueries();
      setImportMessage(strings.settings.importSuccess);
    } catch (err) {
      const message = err instanceof ImportValidationError ? err.message : 'Unexpected error reading file.';
      setImportMessage(strings.settings.importError(message));
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.settings.title}</h1>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        {/* Above the account sections deliberately: it works signed out, and
            it's the one setting someone might want before anything else. */}
        <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.settings.appearanceSection}</h2>
          <ThemeToggle theme={theme} onChange={setTheme} />
          {/* One line describing the *selected* theme, rather than a caption
              under each option — the slider already shows both. */}
          <p className="text-bone-300 text-sm">{strings.settings.themeHints[theme]}</p>
        </section>

        {/* Export/import move real rows in and out of the account, so they only
            make sense (and only work) when signed in. */}
        <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.settings.dataSection}</h2>
          {user ? (
            <>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleExport}
                  className="min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 active:bg-ember-600 text-ink-950 font-semibold px-4 transition-colors"
                >
                  {strings.settings.exportButton}
                </button>
                <button
                  type="button"
                  onClick={handleImportClick}
                  className="min-h-[48px] rounded-md border border-ink-700 hover:bg-ink-800 text-bone-100 font-semibold px-4 transition-colors"
                >
                  {strings.settings.importButton}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {importMessage && <p className="text-sm text-bone-300">{importMessage}</p>}
            </>
          ) : (
            <p className="text-bone-300 text-sm">{strings.settings.signedOutHint}</p>
          )}
        </section>

        <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.settings.accountSection}</h2>
          {user ? (
            <>
              {user.email && <p className="text-bone-300 text-sm">{strings.settings.signedInAs(user.email)}</p>}

              <DisplayNameField />

              <button
                type="button"
                onClick={() => signOut()}
                className="min-h-[48px] w-full rounded-md border border-blood-600 text-blood-500 font-semibold px-4 hover:bg-blood-600 hover:text-bone-100 transition-colors"
              >
                {strings.settings.signOutButton}
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="block text-center min-h-[48px] leading-[48px] w-full rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold px-4 transition-colors"
            >
              {strings.settings.signInButton}
            </Link>
          )}
        </section>

        {/* Only rendered for an admin, but that's presentation, not protection:
            `issue_reports` and `admin_stats()` are admin-gated in the database,
            so hiding the link and showing it are equally safe. It's here because
            an unlinked route you have to remember the URL of is a bad way to
            reach a screen you use. */}
        {isAdmin && (
          <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
            <h2 className="text-bone-100 font-semibold">{strings.settings.adminSection}</h2>
            <p className="text-bone-300 text-sm">{strings.settings.adminHint}</p>
            <Link
              to="/admin"
              className="block text-center min-h-[48px] leading-[48px] w-full rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold px-4 transition-colors"
            >
              {strings.settings.adminLink}
            </Link>
          </section>
        )}

        {/* Admins only, and dev builds only.
            
            `import.meta.env.DEV` is replaced with `false` in a production build,
            so this section is compiled away there regardless — the admin check
            narrows who sees it while developing, it does not make the toggle
            available in production. It could not be: `isDemoMode()` is itself
            gated on DEV, so in production the button would render and do
            nothing.

            `|| isDemoMode()` is not redundant. Demo mode replaces the data
            layer, including the admin check, so without it a signed-out
            developer could never reach the toggle to turn demo mode *on* — and
            once on, would need it to turn the thing back off. `?demo=0` still
            works as an escape hatch either way. */}
        {import.meta.env.DEV && (isAdmin || isDemoMode()) && (
          <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
            <h2 className="text-bone-100 font-semibold">Demo data</h2>
            <p className="text-bone-300 text-sm">
              Fills the app with 50 players, 100 warbands and 10 campaigns so the screens can be
              judged at volume. Nothing is written to the database — reloading with this off
              returns you to your own account.
            </p>
            <button
              type="button"
              onClick={() => setDemoMode(!isDemoMode())}
              className="min-h-[48px] w-full rounded-md border border-ink-700 hover:bg-ink-800 text-bone-100 font-semibold px-4 transition-colors"
            >
              {isDemoMode() ? 'Leave demo mode' : 'Enter demo mode'}
            </button>
          </section>
        )}

      </main>
    </div>
  );
}
