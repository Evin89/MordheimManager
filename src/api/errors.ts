/** Thrown when an optimistic-concurrency update finds `updated_at` no longer matches. */
export class ConcurrencyError extends Error {
  constructor() {
    super('This record changed elsewhere since it was loaded. Reload and redo your change.');
  }
}

/** Postgrest's code for ".single()" resolving to zero rows. */
export const PGRST_NO_ROWS = 'PGRST116';
