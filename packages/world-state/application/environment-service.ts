import { Effect, HashSet, Layer } from 'effect'
import { EnvironmentPort } from '../domain/environment-port'

const LOCALHOST_HOSTNAMES = HashSet.make('localhost', '127.0.0.1', '0.0.0.0', '::1')

// Browser-backed implementation of EnvironmentPort.
// Reads window.location.hostname to detect local development.
// When window is unavailable (e.g. SSR, Node test runtime) returns false,
// matching the previous in-line behavior in settings-service.ts.
export const EnvironmentLive = Layer.succeed(
  EnvironmentPort,
  {
    isLocalhost: Effect.sync(() => {
      if (typeof window === 'undefined') return false
      /* c8 ignore next */
      return HashSet.has(LOCALHOST_HOSTNAMES, window.location.hostname)
    }),
  },
)
