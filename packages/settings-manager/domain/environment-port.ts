import { Context, Effect } from 'effect'

/**
 * Application-layer port for environment-level queries.
 * Decouples application services from `window.location` and other DOM globals.
 * Wired to a browser-backed implementation via `EnvironmentLive` in src/layers.ts.
 */
export class EnvironmentPort extends Context.Tag('@minecraft/application/env/EnvironmentPort')<
  EnvironmentPort,
  {
    /**
     * Resolves to `true` when the host is the local development environment
     * (e.g. `localhost`, `127.0.0.1`, or non-browser test runtimes).
     */
    readonly isLocalhost: Effect.Effect<boolean>
  }
>() {}
