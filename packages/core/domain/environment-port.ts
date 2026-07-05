import type { Effect } from 'effect'
import { Context } from 'effect'

// Decouples application services from `window.location` and DOM globals.
// Wired to a browser-backed implementation via `EnvironmentLayer` in src/layers.ts.
export class EnvironmentPort extends Context.Tag('@minecraft/env/EnvironmentPort')<
  EnvironmentPort,
  {
    readonly isLocalhost: Effect.Effect<boolean>
    // OS-level accessibility preference (prefers-reduced-motion: reduce). Seeds
    // the reducedMotion default so motion-sensitive users get it on first run
    // without hunting for the toggle (WCAG 2.3.3).
    readonly prefersReducedMotion: Effect.Effect<boolean>
  }
>() {}
