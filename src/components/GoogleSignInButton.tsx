import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';
import { Button } from './ui';

/** The four-colour Google "G", inline so it needs no network request and rides
 * the button in both themes. Fixed brand colours by design — a Google mark must
 * look like Google's, not the app's palette. */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" className="flex-none">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/**
 * "Continue with Google" — the same button on both the sign-in and register
 * screens, since Supabase's OAuth flow serves both: it creates the account on
 * first use and signs in a returning user, so there is no separate "sign up with
 * Google". On success the browser leaves for Google's consent page and never
 * returns here, so `submitting` is only ever cleared on the failure path.
 */
export default function GoogleSignInButton() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const { error: oauthError } = await signInWithGoogle();
    if (oauthError) {
      setError(oauthError);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={handleClick} disabled={submitting}>
        <span className="inline-flex items-center gap-2">
          <GoogleGlyph />
          {strings.auth.googleButton}
        </span>
      </Button>
      {error && <p className="text-sm text-blood-500">{error}</p>}
    </div>
  );
}

/** A labelled "or" rule separating the OAuth button from the email form. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-ink-700" />
      <span className="text-xs uppercase tracking-wide text-bone-400">{strings.auth.orDivider}</span>
      <span className="h-px flex-1 bg-ink-700" />
    </div>
  );
}
