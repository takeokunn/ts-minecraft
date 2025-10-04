import { describe, expect, it } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Context from 'effect/Context'

import { GameLoopService } from './legacy/service'
import { GameLoopDomainLive } from './layer'

describe('GameLoopDomainLive', () => {
  it('exposes GameLoopService through the layer', async () => {
    const state = await Effect.runPromise(
      Effect.scoped(
        Effect.flatMap(Layer.build(GameLoopDomainLive), (ctx) =>
          Effect.gen(function* () {
            const service = Context.get(ctx, GameLoopService)
            yield* service.initialize
            return yield* service.start
          })
        )
      )
    )
    expect(state).toBe('running')
  })
})
