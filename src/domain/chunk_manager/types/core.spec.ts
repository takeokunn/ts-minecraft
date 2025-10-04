import { describe, expect, it } from '@effect/vitest'
import { Either, Schema } from 'effect'
import {
  ChunkManagerConfigSchema,
  ChunkPoolIdSchema,
  DefaultChunkManagerConfig,
  makeChunkDistance,
  makeChunkLifetime,
  makeChunkPriority,
  makeMaxActiveChunks,
  makeResourceUsagePercent,
} from './core'

describe('chunk_manager/types/core', () => {
  it('makeChunkPriority accepts boundary values', () => {
    expect(makeChunkPriority(0)).toBe(0)
    expect(makeChunkPriority(50)).toBe(50)
    expect(makeChunkPriority(100)).toBe(100)
  })

  it('ChunkPoolIdSchema rejects empty strings', () => {
    const decoded = Schema.decodeUnknownEither(ChunkPoolIdSchema)('')
    expect(Either.isLeft(decoded)).toBe(true)
  })

  it('DefaultChunkManagerConfig satisfies schema invariants', () => {
    const result = Schema.decodeUnknownEither(ChunkManagerConfigSchema)(DefaultChunkManagerConfig)
    expect(Either.isRight(result)).toBe(true)
  })

  it('makeChunkLifetime rejects negative values', () => {
    const decode = Schema.decodeUnknownEither
    const invalid = decode(Schema.Number)(-10)
    expect(invalid._tag).toBe('Right')
    expect(() => makeChunkLifetime(-10)).toThrowError()
  })

  it('brand helpers create strongly typed values', () => {
    const distance = makeChunkDistance(5)
    const maxActive = makeMaxActiveChunks(64)
    const pressure = makeResourceUsagePercent(0.5)

    expect(distance).toBe(5)
    expect(maxActive).toBe(64)
    expect(pressure).toBeCloseTo(0.5)
  })
})
