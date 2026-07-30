import { useCallback, useEffect, useState } from 'react';
import { Theme, applyTheme, readTheme, writeTheme } from '../lib/theme';

/**
 * The active theme, and a setter that persists it.
 *
 * The document attribute is set by an inline script in index.html before first
 * paint, so this hook is only responsible for changes made while the app is
 * running — it deliberately doesn't re-apply on mount, which would be a no-op
 * at best and a flash at worst.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => readTheme());

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    writeTheme(next);
    applyTheme(next);
  }, []);

  // Keep other tabs in step — changing the theme on a laptop while the phone
  // is open shouldn't leave them disagreeing about a per-device preference on
  // the same device.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== 'mordheim.theme') return;
      const next = readTheme();
      setThemeState(next);
      applyTheme(next);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return [theme, setTheme];
}
