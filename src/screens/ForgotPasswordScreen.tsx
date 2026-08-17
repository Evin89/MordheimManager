import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';
import { Button, Card, Field, TextField } from '../components/ui';

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
          <Card gap="none">
            <p className="text-sm text-bone-200">{strings.auth.forgotSent}</p>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-bone-300">{strings.auth.forgotIntro}</p>
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

            {error && <p className="text-sm text-blood-500">{error}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? strings.auth.forgotSubmitting : strings.auth.forgotButton}
            </Button>
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
