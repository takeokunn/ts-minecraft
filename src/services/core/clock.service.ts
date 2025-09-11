import { Context, Effect } from 'effect'

/**
 * Clock Service - Provides time and delta time for game loop
 */
export class Clock extends Context.Tag('Clock')<
  Clock,
  {
    readonly getDelta: () => Effect.Effect<number, never, never>
    readonly getElapsedTime: () => Effect.Effect<number, never, never>
    readonly start: () => Effect.Effect<void, never, never>
    readonly stop: () => Effect.Effect<void, never, never>
  }
>() {}