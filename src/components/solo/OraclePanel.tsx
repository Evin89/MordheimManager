import { useState } from 'react';
import { Button, Card, Field, SectionHeading, Select } from '../ui';
import {
  askYesNo,
  rollReaction,
  rollCityEvent,
  Likelihood,
  LIKELIHOOD_LABELS,
} from '../../lib/solo/oracle';

/**
 * The solo oracle panel: a yes/no with likelihood, a reaction roll, and a random
 * city event — for the calls a solo player has no opponent to make. Each result
 * can be dropped into the game log via `onLog`. App-original, badged as not part
 * of the rules.
 */
export default function OraclePanel({ onLog }: { onLog?: (text: string) => void }) {
  const [likelihood, setLikelihood] = useState<Likelihood>('fifty');
  const [answer, setAnswer] = useState<string | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [event, setEvent] = useState<string | null>(null);

  return (
    <Card as="section">
      <SectionHeading>The Oracle</SectionHeading>
      <p className="text-bone-400 text-xs">
        A solo dice helper for the calls no opponent is here to make. App-original — not part of the
        rules.
      </p>

      {/* Yes / No */}
      <div className="rounded-md bg-ink-950 border border-ink-800 p-3 space-y-2">
        <p className="text-bone-200 text-sm font-semibold">Ask a Yes / No</p>
        <div className="flex flex-wrap gap-2 items-end">
          <Field label="Likelihood" htmlFor="oracle-likelihood" className="flex-1 min-w-[9rem]">
            <Select
              id="oracle-likelihood"
              value={likelihood}
              onChange={(e) => setLikelihood(e.target.value as Likelihood)}
            >
              {(Object.keys(LIKELIHOOD_LABELS) as Likelihood[]).map((k) => (
                <option key={k} value={k}>
                  {LIKELIHOOD_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            size="dense"
            fullWidth={false}
            onClick={() => {
              const a = askYesNo(likelihood);
              const text = `Oracle (${LIKELIHOOD_LABELS[likelihood]}, d6=${a.roll}): ${a.text}`;
              setAnswer(text);
              onLog?.(text);
            }}
          >
            Roll
          </Button>
        </div>
        {answer && <p className="text-bone-100 text-sm">{answer}</p>}
      </div>

      {/* Reaction */}
      <div className="rounded-md bg-ink-950 border border-ink-800 p-3 space-y-2">
        <p className="text-bone-200 text-sm font-semibold">Reaction (2D6)</p>
        <Button
          size="dense"
          variant="secondary"
          fullWidth={false}
          onClick={() => {
            const r = rollReaction();
            const text = `Reaction (2d6=${r.roll}): ${r.label} — ${r.text}`;
            setReaction(text);
            onLog?.(text);
          }}
        >
          Roll reaction
        </Button>
        {reaction && <p className="text-bone-100 text-sm">{reaction}</p>}
      </div>

      {/* City event */}
      <div className="rounded-md bg-ink-950 border border-ink-800 p-3 space-y-2">
        <p className="text-bone-200 text-sm font-semibold">City Event (D66)</p>
        <Button
          size="dense"
          variant="secondary"
          fullWidth={false}
          onClick={() => {
            const ev = rollCityEvent();
            const text = `City event (D66=${ev.roll}): ${ev.text}`;
            setEvent(text);
            onLog?.(text);
          }}
        >
          Roll event
        </Button>
        {event && <p className="text-bone-100 text-sm">{event}</p>}
      </div>
    </Card>
  );
}
