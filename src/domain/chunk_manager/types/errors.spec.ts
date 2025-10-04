import type { ChunkId } from '@domain/chunk/value_object/chunk_id/types'
import { ChunkIdSchema } from '@domain/chunk/value_object/chunk_id/types'
import { describe, expect, it } from '@effect/vitest'
import { Schema } from 'effect'
import { makeChunkDistance, makeMaxActiveChunks } from './core'
import {
  ActivationErrorSchema,
  ActivationFailureSchema,
  DeactivationFailureSchema,
  makeActivationError,
  makeConfigError,
  makeDeactivationError,
} from './errors'

const sampleChunkId: ChunkId = Schema.decodeUnknownSync(ChunkIdSchema)('chunk-1')

describe('chunk_manager/types/errors', () => {
  it('makeActivationError embeds failure details', () => {
    const failure = Schema.decodeUnknownSync(ActivationFailureSchema)({
      _tag: 'PoolLimitReached',
      activeCount: 5,
      maxActive: makeMaxActiveChunks(4),
    })
    const error = makeActivationError(sampleChunkId, failure)
    const parsed = Schema.decodeUnknownEither(ActivationErrorSchema)(error)
    expect(parsed._tag).toBe('Right')
  })

  it('makeDeactivationError reports lifecycle violation', () => {
    const failure = Schema.decodeUnknownSync(DeactivationFailureSchema)({
      _tag: 'LifecycleViolation',
      stage: 'Destroyed',
    })
    const error = makeDeactivationError(sampleChunkId, failure)
    expect(error.failure._tag).toBe('LifecycleViolation')
  })

  it('makeConfigError rejects invalid configuration', () => {
    const error = makeConfigError({
      _tag: 'InvalidDistance',
      activationDistance: makeChunkDistance(12),
      deactivationDistance: makeChunkDistance(8),
    })
    expect(error.failure._tag).toBe('InvalidDistance')
  })
})
