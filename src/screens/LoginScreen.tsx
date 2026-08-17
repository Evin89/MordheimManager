import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';
import { Button, Field, TextField } from '../components/ui';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.appName}</h1>
          <p className="text-sm text-bone-400">{strings.auth.loginTitle}</p>
        </header>

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

          <Button type="submit" disabled={submitting}>
            {submitting ? strings.auth.loginSubmitting : strings.auth.loginButton}
          </Button>
        </form>

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
