import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';
import { Button } from './ui';

/**
 * §26.3.2 — "send the confirmation email again", shared by the post-signup
 * screen and the sign-in screen's unconfirmed-account message. Before this there
 * was no way to get a second link: a lost or expired email meant a dead account,
 * and a fresh signup with a near-identical name.
 *
 * Supabase rate-limits resends; its error is shown as-is, since "wait N seconds"
 * is exactly what the user needs to read.
 */
export default function ResendConfirmationButton({ email }: { email: string }) {
  const { resendConfirmation } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    if (!email) return;
    setState('sending');
    setError(null);
    const { error: resendError } = await resendConfirmation(email);
    if (resendError) {
      setError(resendError);
      setState('idle');
      return;
    }
    setState('sent');
  }

  return (
    <div className="space-y-1">
      <Button variant="secondary" onClick={() => void resend()} disabled={state === 'sending' || !email}>
        {state === 'sending' ? strings.auth.resendSubmitting : strings.auth.resendButton}
      </Button>
      {state === 'sent' && <p className="text-sm text-bone-300">{strings.auth.resendSent}</p>}
      {error && <p className="text-sm text-blood-500">{error}</p>}
    </div>
  );
}
