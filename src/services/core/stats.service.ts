import { Context, Effect } from 'effect'

/**
 * Performance statistics
 */
export interface PerformanceStats {
  readonly fps: number
  readonly ms: number
  readonly memory?: number
}

/**
 * Stats Service - Performance monitoring
 */
export class Stats extends Context.Tag('Stats')<
  Stats,
  {
    readonly begin: () => Effect.Effect<void, never, never>
    readonly end: () => Effect.Effect<void, never, never>
    readonly getStats: () => Effect.Effect<PerformanceStats, never, never>
  }
>() {}