import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { blockIndex } from '@ts-minecraft/core'
import { ChunkService } from '../application/chunk-service'
import { ChunkError } from '../domain/errors'

describe('application/chunk-service', () => {
  it.effect('fails with ChunkError for invalid stored block ids', () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
      const idx = Option.getOrElse(blockIndex(1, 2, 3), () => -1)
      chunk.blocks[idx] = 255

      const result = yield* Effect.either(chunkService.getBlock(chunk, 1, 2, 3))

      expect(result._tag).toBe('Left')
      if (result._tag === 'Right') expect.fail('Expected ChunkError')
      expect(result.left).toBeInstanceOf(ChunkError)
      expect(result.left.reason).toContain('Invalid block id')
    }).pipe(Effect.provide(ChunkService.Default))
  )
})
