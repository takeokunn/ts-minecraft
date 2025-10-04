import { describe, expect, it } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import * as Layer from 'effect/Layer'
import * as Ref from 'effect/Ref'
import * as Context from 'effect/Context'
import * as Schema from 'effect/Schema'

import { GameLoopService } from './service'
import { GameLoopServiceLive } from './live'
import { makeTimestamp } from '../types/core'

const withService = <A>(
  use: (service: GameLoopService) => Effect.Effect<A>
): Effect.Effect<A> =>
  Effect.scoped(
    Effect.flatMap(Layer.build(GameLoopServiceLive), (ctx) =>
      use(Context.get(ctx, GameLoopService))
    )
  )

describe('GameLoopServiceLive', () => {
  it('initializes and starts the loop', async () => {
    const state = await Effect.runPromise(
      withService((service) =>
        Effect.gen(function* () {
          yield* service.configure({ maxFrameSkip: 2 })
          yield* service.initialize
          return yield* service.start
        })
      )
    )
    expect(state).toBe('running')
  })

  it('increments frame count via nextFrame and triggers callbacks', async () => {
    const { frames, hits } = await Effect.runPromise(
      withService((service) =>
        Effect.gen(function* () {
          yield* service.initialize
          yield* service.start
          const counter = yield* Ref.make(0)
          const registration = yield* service.registerFrameCallback((_, __) =>
            Ref.update(counter, (n) => n + 1)
          )

          const firstTimestamp = Either.getOrElse(makeTimestamp(1_000), (error) => {
            throw new Error(Schema.formatError(error))
          })
          const secondTimestamp = Either.getOrElse(makeTimestamp(1_016), (error) => {
            throw new Error(Schema.formatError(error))
          })

          yield* service.nextFrame(firstTimestamp)
          yield* service.nextFrame(secondTimestamp)
          yield* registration.unregister
          const frames = yield* service.frameCount
          const hits = yield* Ref.get(counter)
          return { frames, hits }
        })
      )
    )

    expect(frames).toBeGreaterThanOrEqual(2)
    expect(hits).toBeGreaterThanOrEqual(2)
  })
})
