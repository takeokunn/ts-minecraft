import { it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { describe, expect } from 'vitest'
import { PhysicsEventSchema } from '../events'

describe('Physics events', () => {
  it.effect('decodes world stepped event', () =>
    Effect.gen(function* () {
      const event = yield* Schema.decodeUnknown(PhysicsEventSchema)({
        _tag: 'WorldStepped',
        worldId: 'world-123456',
        deltaTime: 0.016,
        completedAt: 10,
      })
      expect(event._tag).toBe('WorldStepped')
    })
  )
})
