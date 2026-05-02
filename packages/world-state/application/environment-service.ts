import { Effect, Layer } from 'effect'
import { EnvironmentPort } from '../domain/environment-port'

const LOCALHOST_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

// Browser-backed implementation of EnvironmentPort.
// Reads window.location.hostname to detect local development.
// When window is unavailable (e.g. SSR, Node test runtime) returns false,
// matching the previous in-line behavior in settings-service.ts.
export const EnvironmentLive = Layer.succeed(
  EnvironmentPort,
  {
    isLocalhost: Effect.sync(() => {
      if (typeof window === 'undefined') return false
      return LOCALHOST_HOSTNAMES.has(window.location.hostname)
    }),
  },
)
