import { Context, Effect } from 'effect'

/**
 * Clock Service - Provides time and delta time for game loop
 */
export class Clock extends Context.Tag('Clock')<
  Clock,
  {
    readonly getDelta: () => Effect.Effect<number>
    readonly getElapsedTime: () => Effect.Effect<number>
    readonly start: () => Effect.Effect<void>
    readonly stop: () => Effect.Effect<void>
  }
>() {}