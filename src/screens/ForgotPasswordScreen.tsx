import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: resetError } = await requestPasswordReset(email);
    setSubmitting(false);
    // Only surface genuine transport failures. A rejected *address* still shows
    // the neutral "if an account exists" message, so this screen can't be used
    // to discover which emails are registered.
    if (resetError && /network|fetch|connection/i.test(resetError)) {
      setError(resetError);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.appName}</h1>
          <p className="text-sm text-bone-400">{strings.auth.forgotTitle}</p>
        </header>

        {sent ? (
          <p className="text-sm text-bone-200 rounded-md bg-ink-900 border border-ink-800 p-4">
            {strings.auth.forgotSent}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-bone-300">{strings.auth.forgotIntro}</p>
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

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 active:bg-ember-600 disabled:opacity-60 text-ink-950 font-semibold px-4 transition-colors"
            >
              {submitting ? strings.auth.forgotSubmitting : strings.auth.forgotButton}
            </button>
          </form>
        )}

        <p className="text-center text-sm">
          <Link to="/login" className="text-ember-400 font-semibold">
            {strings.auth.backToLogin}
          </Link>
        </p>
      </div>
    </div>
  );
}
