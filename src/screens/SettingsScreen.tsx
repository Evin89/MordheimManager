import { useRef, useState } from 'react';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { ImportValidationError, downloadExport, parseImportFile } from '../storage/persistence';

export default function SettingsScreen() {
  const importAll = useAppStore((state) => state.importAll);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const data = parseImportFile(text);
      if (!window.confirm(strings.settings.importOverwriteWarning)) return;
      importAll(data);
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
        <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.settings.dataSection}</h2>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={downloadExport}
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
        </section>
      </main>
    </div>
  );
}
