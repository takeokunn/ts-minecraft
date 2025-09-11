/**
 * Clock Port - Interface for time operations
 *
 * This port defines the contract for time-related operations,
 * allowing the domain layer to work with time without
 * depending on specific time implementations.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'

export interface IClockPort {
  // Time operations
  readonly now: () => Effect.Effect<number, never, never>
  readonly deltaTime: () => Effect.Effect<number, never, never>

  // Frame timing
  readonly frameTime: () => Effect.Effect<number, never, never>
  readonly fps: () => Effect.Effect<number, never, never>

  // Time control
  readonly pause: () => Effect.Effect<void, never, never>
  readonly resume: () => Effect.Effect<void, never, never>
  readonly isPaused: () => Effect.Effect<boolean, never, never>

  // Time scaling
  readonly setTimeScale: (scale: number) => Effect.Effect<void, never, never>
  readonly getTimeScale: () => Effect.Effect<number, never, never>
}

export class ClockPort extends Context.GenericTag('ClockPort')<ClockPort, IClockPort>() {}
