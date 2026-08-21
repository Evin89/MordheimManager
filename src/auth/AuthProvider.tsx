import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { isDemoMode, setDemoMode } from '../dev/demoMode';
import { demoViewer } from '../dev/demoApi';
import {
  acquisitionMetadata,
  getAcquisitionForSignup,
  initAcquisitionCapture,
} from '../lib/acquisition';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Emails a password-reset link that returns the user to /reset-password. */
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  /** Sets a new password for the session established by the reset link. */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * The account demo mode is signed in as.
 *
 * Deliberately replaces any real session rather than sitting alongside it:
 * every screen reads `user.id` to decide whose warbands and campaigns to show,
 * and with a real id there nothing generated would be visible. It carries only
 * the fields the app actually reads — enough of a `User` to stand in, not a
 * usable credential.
 */
function demoSession(): Session {
  const viewer = demoViewer();
  const user = {
    id: viewer.id,
    email: viewer.email,
    user_metadata: { display_name: viewer.displayName },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as unknown as User;
  return { access_token: 'demo', user } as unknown as Session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() =>
    isDemoMode() ? demoSession() : null,
  );
  const [loading, setLoading] = useState(!isDemoMode());

  // §23.4 — stash any acquisition tag on the first app URL before it's lost to
  // in-app navigation, so it's still there when the user reaches /register.
  useEffect(() => {
    initAcquisitionCapture();
  }, []);

  useEffect(() => {
    if (isDemoMode()) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, displayName: string) {
    // §23.4 — where this signup came from, passed through the auth metadata so
    // `handle_new_user` writes it onto the profile atomically (migration 0025).
    // Best-effort: a capture failure must never block a registration.
    let acquisition: Record<string, string> = {};
    try {
      acquisition = acquisitionMetadata(getAcquisitionForSignup());
    } catch {
      /* ignore */
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, ...acquisition } },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    // Signing out of the demo account means leaving demo mode — there is no
    // Supabase session to end, and reloading is how the flag is applied.
    if (isDemoMode()) {
      setDemoMode(false);
      return;
    }
    await supabase.auth.signOut();
  }

  async function requestPasswordReset(email: string) {
    // The `/app` prefix is spelled out because this is a real URL for Supabase,
    // not a router path — `window.location.origin` stops at the domain, and the
    // reset screen lives at /app/reset-password now the app is mounted there.
    // This exact URL must also be on Supabase's allowed redirect list.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/app/reset-password`,
    });
    return { error: error?.message ?? null };
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
