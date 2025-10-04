import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { InputService } from '../input-service'
import { InputTimestamp } from '../model'
import { makeSnapshot } from '../state'

const stubSnapshot = makeSnapshot(InputTimestamp(0))

const stubService: InputService = {
  ingest: () => Effect.void,
  currentSnapshot: () => Effect.succeed(stubSnapshot),
  isKeyPressed: () => Effect.succeed(false),
  isMousePressed: () => Effect.succeed(false),
  latestMouseDelta: () => Effect.succeed(stubSnapshot.mouseDelta),
  bindAction: () => Effect.void,
}

describe('InputService tag', () => {
  it.effect('provides service through context', () =>
    Effect.gen(function* () {
      const service = yield* InputService
      expect(service).toEqual(stubService)
    }).pipe(Effect.provide(Layer.succeed(InputService, stubService)))
  )
})
