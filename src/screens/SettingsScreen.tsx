import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import { ImportValidationError, downloadExport, importAllData, parseImportFile } from '../storage/persistence';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
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

        <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.settings.aboutSection}</h2>
          <Link
            to="/settings/changelog"
            className="block text-ember-400 font-semibold"
          >
            {strings.settings.changelogLink}
          </Link>
        </section>
      </main>
    </div>
  );
}
