import { useEffect, useState } from 'react';

/** The value, delayed until it's stopped changing for `delayMs`. The one
 * generic debounce primitive in the app — for anything that fires a request
 * per keystroke and shouldn't (an as-you-type availability check, a search
 * box hitting the server rather than filtering what's already loaded). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
