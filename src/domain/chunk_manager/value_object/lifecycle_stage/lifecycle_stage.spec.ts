import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { DestructionReasonSchema, makeChunkLifetime, makeTimestamp } from '../../types/core'
import {
  activateStage,
  createInitializedStage,
  deactivateStage,
  destroyStage,
  markPendingDestruction,
  updateIdleDuration,
} from './lifecycle_stage'

describe('chunk_manager/value_object/lifecycle_stage', () => {
  it.effect('activateStage transitions from initialized to active', () =>
    Effect.gen(function* () {
      const now = makeTimestamp(10)
      const stage = createInitializedStage(now)
      const activated = yield* activateStage(stage, now)
      expect(activated._tag).toBe('Active')
    })
  )

  it.effect('deactivateStage fails when lifecycle invalid', () =>
    Effect.gen(function* () {
      const now = makeTimestamp(20)
      const stage = createInitializedStage(now)
      const result = yield* deactivateStage(stage, now).pipe(Effect.exit)
      expect(result._tag).toBe('Failure')
    })
  )

  it.effect('markPendingDestruction and destroyStage complete lifecycle', () =>
    Effect.gen(function* () {
      const now = makeTimestamp(30)
      const inactive = yield* activateStage(createInitializedStage(now - 10), now - 5).pipe(
        Effect.flatMap((active) => deactivateStage(active, now - 1))
      )

      const reason = Schema.decodeUnknownSync(DestructionReasonSchema)({
        _tag: 'ManualEviction',
        requestedBy: 'test-suite',
      })

      const pending = yield* markPendingDestruction(inactive, now, reason)
      const destroyed = yield* destroyStage(pending, now + 1)
      expect(destroyed._tag).toBe('Destroyed')
    })
  )

  it.effect('updateIdleDuration refreshes inactive stage idle time', () =>
    Effect.gen(function* () {
      const now = makeTimestamp(100)
      const activated = yield* activateStage(createInitializedStage(now - 10), now - 5)
      const inactive = yield* deactivateStage(activated, now)
      const updated = updateIdleDuration(inactive, makeChunkLifetime(20))
      expect(updated._tag).toBe('Inactive')
      expect(updated.idleFor).toBe(20)
    })
  )
})
