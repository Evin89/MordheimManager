// A small model router: pick the cheapest Claude model (and a hard output cap)
// that fits the job, so token spend is bounded by the task rather than pinned at
// the top model. Pure and runtime-agnostic — it returns a config object and
// makes no API calls, so it adds zero tokens of its own. (A classifier
// round-trip to "decide" the model would spend the very tokens we're limiting,
// which is why routing here is a heuristic on a declared tier + input size.)
//
// Tradeoff worth keeping in view (Anthropic's own cost guidance): routing across
// models forfeits prompt-cache reuse between them, and the newest model at LOW
// effort often beats a cheaper model at high effort. So keep the tiers few,
// prefer the effort lever within a tier, and judge cost per *completed* task —
// a cheap call that needs a retry to finish the job isn't cheap. Measure before
// adding a tier.

export type Tier = 'cheap' | 'balanced' | 'max';

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type RouteResult = {
  /** Bare current model id — never date-suffixed. */
  model: string;
  /** Hard output ceiling for this route — the most direct spend limiter. */
  maxTokens: number;
  /** Effort is an Opus-/Sonnet-5-tier lever and is rejected by Haiku 4.5, so it
   *  is undefined on the cheap tier. Goes in `output_config.effort`, never top level. */
  effort?: EffortLevel;
  /** A soft input ceiling for the caller to enforce (trim or refuse) before the
   *  call, so an oversized payload can't quietly blow the budget. */
  maxInputTokens: number;
};

// Reference pricing (per MTok, input / output) for choosing tiers, not used at
// runtime: Haiku 4.5 $1/$5 · Sonnet 5 $2/$10 · Opus 5 $5/$25.
const TIERS: Record<Tier, RouteResult> = {
  cheap: { model: 'claude-haiku-4-5', maxTokens: 1500, maxInputTokens: 8_000 },
  balanced: { model: 'claude-sonnet-5', maxTokens: 4_000, effort: 'low', maxInputTokens: 40_000 },
  max: { model: 'claude-opus-5', maxTokens: 8_000, effort: 'high', maxInputTokens: 150_000 },
};

const ORDER: Tier[] = ['cheap', 'balanced', 'max'];

export type RouteInput = {
  /** The job's baseline difficulty, declared by the caller. Short flavor text
   *  like a battle report is 'cheap'. */
  tier: Tier;
  /** Approximate input size in tokens, if known — a `chars / 4` estimate is fine
   *  and free; `count_tokens` is exact but costs a round trip. Used only to
   *  escalate a small model off an oversized input, where it would likely need a
   *  retry that costs more than routing up would. */
  estimatedInputTokens?: number;
};

/** Resolve the model, output cap and effort for a request. Escalates one tier at
 * a time while the input exceeds the current tier's soft ceiling; at the top
 * tier an oversized input is the caller's to trim. */
export function route({ tier, estimatedInputTokens = 0 }: RouteInput): RouteResult {
  let chosen = tier;
  while (estimatedInputTokens > TIERS[chosen].maxInputTokens) {
    const next = ORDER[ORDER.indexOf(chosen) + 1];
    if (!next) break; // already at the top; the payload must be trimmed by the caller.
    chosen = next;
  }
  return TIERS[chosen];
}

/** A rough, free token estimate (~4 chars/token) for feeding `route`. Use
 * `count_tokens` instead when you need the input guard to be exact. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
