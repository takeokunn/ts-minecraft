import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'
import { ChunkService, ChunkServiceLive } from './chunk'

describe('ChunkService.worldToChunkCoord', () => {
  it.effect('maps (0, 0) to chunk { x: 0, z: 0 }', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const coord = yield* cs.worldToChunkCoord(0, 0)
      expect(coord).toEqual({ x: 0, z: 0 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('maps (15, 15) to chunk { x: 0, z: 0 } (last block in chunk)', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const coord = yield* cs.worldToChunkCoord(15, 15)
      expect(coord).toEqual({ x: 0, z: 0 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('maps (16, 0) to chunk { x: 1, z: 0 } (first block of next chunk)', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const coord = yield* cs.worldToChunkCoord(CHUNK_SIZE, 0)
      expect(coord).toEqual({ x: 1, z: 0 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('maps (-1, 0) to chunk { x: -1, z: 0 }', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const coord = yield* cs.worldToChunkCoord(-1, 0)
      expect(coord).toEqual({ x: -1, z: 0 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('maps (-16, -16) to chunk { x: -1, z: -1 }', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const coord = yield* cs.worldToChunkCoord(-CHUNK_SIZE, -CHUNK_SIZE)
      expect(coord).toEqual({ x: -1, z: -1 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('maps (32, 48) to chunk { x: 2, z: 3 }', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const coord = yield* cs.worldToChunkCoord(32, 48)
      expect(coord).toEqual({ x: 2, z: 3 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )
})

describe('ChunkService.chunkToWorldCoord', () => {
  it.effect('chunk { x: 0, z: 0 } at local (0, 0) maps to world (0, 0)', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const coord = yield* cs.chunkToWorldCoord({ x: 0, z: 0 }, 0, 0)
      expect(coord).toEqual({ x: 0, z: 0 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('chunk { x: 1, z: 0 } at local (0, 0) maps to world (16, 0)', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const coord = yield* cs.chunkToWorldCoord({ x: 1, z: 0 }, 0, 0)
      expect(coord).toEqual({ x: CHUNK_SIZE, z: 0 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('chunk { x: -1, z: -1 } at local (0, 0) maps to world (-16, -16)', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const coord = yield* cs.chunkToWorldCoord({ x: -1, z: -1 }, 0, 0)
      expect(coord).toEqual({ x: -CHUNK_SIZE, z: -CHUNK_SIZE })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('chunk { x: 2, z: 3 } at local (5, 7) maps to world (37, 55)', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const coord = yield* cs.chunkToWorldCoord({ x: 2, z: 3 }, 5, 7)
      expect(coord).toEqual({ x: 2 * CHUNK_SIZE + 5, z: 3 * CHUNK_SIZE + 7 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('worldToChunkCoord and chunkToWorldCoord are inverse operations', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const worldX = 45
      const worldZ = -20
      const chunkCoord = yield* cs.worldToChunkCoord(worldX, worldZ)
      const localX = worldX - chunkCoord.x * CHUNK_SIZE
      const localZ = worldZ - chunkCoord.z * CHUNK_SIZE
      const backToWorld = yield* cs.chunkToWorldCoord(chunkCoord, localX, localZ)
      expect(backToWorld).toEqual({ x: worldX, z: worldZ })
    }).pipe(Effect.provide(ChunkServiceLive))
  )
})
