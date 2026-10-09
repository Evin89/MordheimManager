import { ReactNode, useEffect, useRef, useState } from 'react';
import ConfirmAction from '../components/ConfirmAction';
import { strings } from '../strings';

/**
 * One way to spend gold (spec §5.4, §9): recruiting a Hero, Henchmen or a Hired
 * Sword, and buying gear for a model, a group or the treasury.
 *
 * Before this, each of those six screens chained its own `window.confirm`s —
 * slot limit, then warband size, then gold, each a separate browser dialog —
 * and blocked the two-weapon limit with `window.alert`. §5.4 bars both. Now a
 * screen describes the purchase once and the hook decides:
 *
 * - `blocked` — a hard rule (weapon slots full). Shown inline; nothing happens.
 * - `warnings` — rulebook limits a group may bend by agreement (over the slot or
 *   size cap, not enough gold). All of them are listed together in one inline
 *   ConfirmAction, so the player reads every reason before deciding once.
 * - neither — the purchase goes through straight away.
 *
 * Render `panel` near the control that started the purchase. It scrolls itself
 * into view, so it can't open off-screen under a long shop list.
 */
export type PurchaseRequest = {
  /** Reasons to pause. Falsy entries are ignored, so callers can inline checks. */
  warnings?: (string | null | false | undefined)[];
  /** A rule that refuses the purchase outright. */
  blocked?: string | null;
  /** The confirm button's label, e.g. "Buy anyway". */
  action?: string;
  /** Applies the purchase. Called at most once. */
  proceed: () => void;
};

type Pending = { warnings: string[]; action: string; proceed: () => void };

/** The gold check every flow shares. */
export function goldWarning(cost: number, gold: number): string | null {
  return cost > gold ? strings.trading.insufficientGoldConfirm(cost, gold) : null;
}

function BlockedNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [message]);
  return (
    <div ref={ref} role="alert" className="space-y-3 rounded-lg border border-blood-600 p-4">
      <p className="text-danger text-sm">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-[48px] px-4 rounded-md border border-ink-700 text-bone-200 text-sm font-semibold"
      >
        {strings.trading.dismiss}
      </button>
    </div>
  );
}

export function usePurchase(): {
  attempt: (request: PurchaseRequest) => void;
  panel: ReactNode;
  clear: () => void;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  function clear() {
    setPending(null);
    setBlocked(null);
  }

  function attempt({ warnings = [], blocked: refusal, action, proceed }: PurchaseRequest) {
    clear();
    if (refusal) {
      setBlocked(refusal);
      return;
    }
    const reasons = warnings.filter((w): w is string => typeof w === 'string' && w.length > 0);
    if (reasons.length === 0) {
      proceed();
      return;
    }
    setPending({ warnings: reasons, action: action ?? strings.trading.buyAnyway, proceed });
  }

  let panel: ReactNode = null;
  if (blocked) {
    panel = <BlockedNotice message={blocked} onDismiss={clear} />;
  } else if (pending) {
    panel = (
      <ConfirmAction
        // Keyed by content so a second attempt with different reasons re-mounts
        // and scrolls back into view.
        key={pending.warnings.join('|')}
        impact={
          <>
            {pending.warnings.length === 1 ? (
              <p>{pending.warnings[0]}</p>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {pending.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <p className="text-bone-100 font-semibold">{strings.trading.purchasePrompt}</p>
          </>
        }
        action={pending.action}
        onConfirm={() => {
          const { proceed } = pending;
          setPending(null);
          proceed();
        }}
        onCancel={clear}
      />
    );
  }

  return { attempt, panel, clear };
}
