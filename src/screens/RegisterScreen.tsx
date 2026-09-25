import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';
import { Button, Card, Field, TextField } from '../components/ui';
import SelfReportFields from '../components/SelfReportFields';
import ResendConfirmationButton from '../components/ResendConfirmationButton';
import type { SelfReportAnswer } from '../lib/acquisition';
import GoogleSignInButton, { AuthDivider } from '../components/GoogleSignInButton';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // §26.7.2 — optional; '' means skipped and is sent as nothing at all.
  const [selfReport, setSelfReport] = useState<SelfReportAnswer | ''>('');
  const [selfReportNote, setSelfReportNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // §26.3.2 — set once a signup succeeds without a session (confirmation on).
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signUpError, needsConfirmation } = await signUp(email, password, displayName, {
      answer: selfReport || null,
      note: selfReportNote,
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    // Used to navigate to Home either way — with no session that was the
    // signed-out Home, saying nothing, which looks exactly like a broken signup.
    if (needsConfirmation) {
      setAwaitingConfirmation(email);
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

        {awaitingConfirmation ? (
          <div className="space-y-4">
            <Card as="section" gap="sm">
              <h2 className="text-bone-100 font-semibold">{strings.auth.checkEmailTitle}</h2>
              <p className="text-sm text-bone-200">{strings.auth.checkEmailBody(awaitingConfirmation)}</p>
              <p className="text-sm text-bone-300">{strings.auth.checkEmailSpam}</p>
            </Card>
            <ResendConfirmationButton email={awaitingConfirmation} />
            <p className="text-sm text-bone-400">{strings.auth.checkEmailExisting}</p>
            <div className="flex flex-wrap justify-center gap-x-4 text-sm">
              <Link to="/login" className="text-ember-400 font-semibold">
                {strings.auth.loginLink}
              </Link>
              <Link to="/forgot-password" className="text-ember-400 font-semibold">
                {strings.auth.forgotPasswordLink}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <GoogleSignInButton />
            <AuthDivider />

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

              <SelfReportFields
                answer={selfReport}
                note={selfReportNote}
                onAnswer={setSelfReport}
                onNote={setSelfReportNote}
              />

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
          </>
        )}
      </div>
    </div>
  );
}
