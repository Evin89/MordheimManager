import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';
import { Button, Field, TextField } from '../components/ui';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signUpError } = await signUp(email, password, displayName);
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.appName}</h1>
          <p className="text-sm text-bone-400">{strings.auth.registerTitle}</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={strings.auth.displayNameLabel} htmlFor="displayName">
            <TextField
              id="displayName"
              type="text"
              required
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
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
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && <p className="text-sm text-blood-500">{error}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? strings.auth.registerSubmitting : strings.auth.registerButton}
          </Button>
        </form>

        <p className="text-center text-sm text-bone-400">
          {strings.auth.hasAccountPrompt}{' '}
          <Link to="/login" className="text-ember-400 font-semibold">
            {strings.auth.loginLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
