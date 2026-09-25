import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';
import { clearFreshSignIn } from '../lib/firstRun';
import ResendConfirmationButton from '../components/ResendConfirmationButton';
import { Button, Field, TextField } from '../components/ui';
import GoogleSignInButton, { AuthDivider } from '../components/GoogleSignInButton';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // §26.3.2 — the address whose sign-in failed only for want of confirmation.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setUnconfirmedEmail(null);
    const { error: signInError, unconfirmed } = await signIn(email, password);
    setSubmitting(false);
    if (unconfirmed) {
      setUnconfirmedEmail(email);
      return;
    }
    if (signInError) {
      setError(signInError);
      return;
    }
    const from = (location.state as { from?: string } | null)?.from;
    // Sent here from a specific page: going back there wins over the §26.4.1
    // first-run redirect, which only applies to a plain sign-in landing on Home.
    if (from) clearFreshSignIn();
    navigate(from ?? '/', { replace: true });
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.appName}</h1>
          <p className="text-sm text-bone-400">{strings.auth.loginTitle}</p>
        </header>

        <GoogleSignInButton />
        <AuthDivider />

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={strings.auth.emailLabel} htmlFor="email">
            <TextField
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={strings.auth.passwordLabel} htmlFor="password">
            <TextField
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && <p className="text-sm text-blood-500">{error}</p>}
          {unconfirmedEmail && <p className="text-sm text-blood-500">{strings.auth.unconfirmedSignIn}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? strings.auth.loginSubmitting : strings.auth.loginButton}
          </Button>
        </form>

        {/* Outside the form, so it can't be mistaken for (or trigger) sign-in. */}
        {unconfirmedEmail && <ResendConfirmationButton email={unconfirmedEmail} />}

        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-ember-400 font-semibold">
            {strings.auth.forgotPasswordLink}
          </Link>
        </p>

        <p className="text-center text-sm text-bone-400">
          {strings.auth.noAccountPrompt}{' '}
          <Link to="/register" className="text-ember-400 font-semibold">
            {strings.auth.registerLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
