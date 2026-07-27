import { create } from 'zustand';

// Set from the QueryClient's global onError handlers (see main.tsx) whenever a
// Supabase read/write fails. Surfaced as a banner (ConnectionBanner) — spec
// section 8.4: "the user needs to know immediately that a save didn't go through."
type ConnectionStatusState = {
  lastError: string | null;
  reportError: (message: string) => void;
  clear: () => void;
};

export const useConnectionStatus = create<ConnectionStatusState>((set) => ({
  lastError: null,
  reportError: (message) => set({ lastError: message }),
  clear: () => set({ lastError: null }),
}));
