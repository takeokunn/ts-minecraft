import type { Effect } from 'effect'
import { Context } from 'effect'

// Decouples application services from `window.location` and DOM globals.
// Wired to a browser-backed implementation via `EnvironmentLayer` in src/layers.ts.
export class EnvironmentPort extends Context.Tag('@minecraft/env/EnvironmentPort')<
  EnvironmentPort,
  {
    readonly isLocalhost: Effect.Effect<boolean>
  }
>() {}
