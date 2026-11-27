export type TrackerPhase = 'pregame' | 'start' | 'recovery' | 'movement' | 'shooting' | 'combat' | 'opponent' | 'ended';
export const OWN_PHASES = ['start', 'recovery', 'movement', 'shooting', 'combat'] as const;
export type FirstPlayer = 'me' | 'them';
type Step = { turn: number; phase: TrackerPhase };
type Position = Step & { firstPlayer: FirstPlayer };

export function isMyTurn(turn: number, firstPlayer: FirstPlayer): boolean {
  return (turn % 2 === 1) === (firstPlayer === 'me');
}

export function nextStep({ turn, phase, firstPlayer }: Position): Step {
  switch (phase) {
    case 'pregame': return { turn: 1, phase: firstPlayer === 'me' ? 'start' : 'opponent' };
    case 'combat': return { turn: turn + 1, phase: 'opponent' };
    case 'opponent': return { turn: turn + 1, phase: 'start' };
    case 'ended': return { turn, phase };
    default: return { turn, phase: OWN_PHASES[OWN_PHASES.indexOf(phase) + 1] };
  }
}

export function prevStep({ turn, phase, firstPlayer }: Position): Step | null {
  switch (phase) {
    case 'pregame': return null;
    case 'start':
    case 'opponent':
      return turn === 1 ? { turn, phase: 'pregame' }
        : { turn: turn - 1, phase: isMyTurn(turn - 1, firstPlayer) ? 'combat' : 'opponent' };
    case 'ended': return { turn, phase: isMyTurn(turn, firstPlayer) ? 'start' : 'opponent' };
    default: return { turn, phase: OWN_PHASES[OWN_PHASES.indexOf(phase) - 1] };
  }
}

export const MODEL_STATES = ['outOfAction', 'stunned', 'knockedDown', 'fleeing'] as const;
export type ModelState = typeof MODEL_STATES[number];
export type StateCounts = Record<ModelState | 'rallied', number>;
export const EMPTY_COUNTS: StateCounts = {
  outOfAction: 0, stunned: 0, knockedDown: 0, fleeing: 0, rallied: 0,
};

export function standingCount(counts: StateCounts, count: number): number {
  return count - MODEL_STATES.reduce((sum, state) => sum + counts[state], 0);
}

export function setModelState(counts: StateCounts, state: ModelState | 'standing'): StateCounts {
  return {
    ...EMPTY_COUNTS,
    rallied: state === 'standing' ? counts.rallied : 0,
    ...(state !== 'standing' && { [state]: 1 }),
  };
}

export function reconcileGroup(counts: StateCounts, count: number): StateCounts {
  let remaining = count;
  const result = { ...counts };
  for (const state of [...MODEL_STATES, 'rallied'] as const) {
    result[state] = Math.min(remaining, Math.max(0, counts[state]));
    remaining -= result[state];
  }
  return result;
}

export function applyRecovery(counts: StateCounts) {
  return {
    counts: { ...counts, knockedDown: counts.knockedDown + counts.stunned, stunned: 0 },
    undo: { stunned: counts.stunned, knockedDown: counts.knockedDown },
  };
}

export function undoRecovery(counts: StateCounts, snapshot: Pick<StateCounts, 'stunned' | 'knockedDown'>): StateCounts {
  return { ...counts, ...snapshot };
}

export function standUp(counts: StateCounts, eligible: number, checked: boolean): StateCounts {
  return checked ? { ...counts, knockedDown: Math.max(0, counts.knockedDown - eligible) } : counts;
}

export function shootingCount(counts: StateCounts, count: number): number {
  return standingCount(counts, count) - counts.rallied;
}

export function shootingBlockers(counts: StateCounts): (ModelState | 'rallied')[] {
  return [...MODEL_STATES, 'rallied' as const].filter((state) => counts[state] > 0);
}

export function canCast(counts: StateCounts): boolean {
  return standingCount(counts, 1) === 1;
}
