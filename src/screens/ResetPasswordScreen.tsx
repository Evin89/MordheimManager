import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';

const MIN_PASSWORD_LENGTH = 6;

/**
 * Landing page for the emailed reset link. supabase-js parses the recovery
 * token out of the URL on load and establishes a temporary session, so by the
 * time this renders `user` is set and `updateUser({ password })` will work.
 * No session means the link was bad, already used, or expired.
 */
export default function ResetPasswordScreen() {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(strings.auth.resetTooShort);
      return;
    }
    if (password !== confirm) {
      setError(strings.auth.resetMismatch);
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    // The recovery session is a real session, so the user is already signed in.
    navigate('/', { replace: true });
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.appName}</h1>
          <p className="text-sm text-bone-400">{strings.auth.resetTitle}</p>
        </header>

        {!user ? (
          <>
            <p className="text-sm text-bone-200 rounded-md bg-ink-900 border border-ink-800 p-4">
              {strings.auth.resetNoSession}
            </p>
            <p className="text-center text-sm">
              <Link to="/forgot-password" className="text-ember-400 font-semibold">
                {strings.auth.forgotTitle}
              </Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-bone-300">{strings.auth.resetIntro}</p>
            <div className="space-y-1">
              <label htmlFor="new-password" className="text-sm text-bone-300">
                {strings.auth.newPasswordLabel}
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="confirm-password" className="text-sm text-bone-300">
                {strings.auth.confirmPasswordLabel}
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 active:bg-ember-600 disabled:opacity-60 text-ink-950 font-semibold px-4 transition-colors"
            >
              {submitting ? strings.auth.resetSubmitting : strings.auth.resetButton}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
