// All user-facing UI copy lives here so a future translation pass is a
// single-file change. Game-content text (skill effects, injury text, etc.)
// lives in /src/data instead — this file is app-chrome only.

export const strings = {
  appName: 'Mordheim Campaign Manager',
  tagline: 'Offline warband & campaign bookkeeping',
  nav: {
    warbands: 'Warbands',
    postBattle: 'Post-Battle',
    trading: 'Trading',
    campaign: 'Campaign',
    settings: 'Settings',
  },
  home: {
    warbandCount: (n: number) => `${n} warband${n === 1 ? '' : 's'} stored on this device`,
    noCampaign: 'No campaign started yet',
  },
  settings: {
    title: 'Settings',
    dataSection: 'Your Data',
    exportButton: 'Export all data (.json)',
    importButton: 'Import data from file',
    importOverwriteWarning: 'Importing will overwrite all warbands and campaign data currently stored on this device. This cannot be undone. Continue?',
    importSuccess: 'Import complete.',
    importError: (message: string) => `Import failed: ${message}`,
  },
} as const;
