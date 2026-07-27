import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';

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
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-bone-300">
              {strings.auth.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm text-bone-300">
              {strings.auth.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 active:bg-ember-600 disabled:opacity-60 text-ink-950 font-semibold px-4 transition-colors"
          >
            {submitting ? strings.auth.loginSubmitting : strings.auth.loginButton}
          </button>
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
