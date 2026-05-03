import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, MutableRef } from 'effect'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import { buildTestLayer } from './chunk-manager-test-utils'

describe('terrain/chunk-terrain-caves', () => {
  describe('Phase 1.3 — 3D cave carving', () => {
    const AIR = 0
    const BEDROCK = 16

    const idx = (lx: number, y: number, lz: number): number =>
      y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

    it.effect('bedrock layer (y<=4) must be intact after cave carving', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const coords = [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
          { x: 0, z: 1 },
          { x: -1, z: 2 },
        ]

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                Arr.forEach(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) =>
                  Arr.forEach(Arr.makeBy(CHUNK_SIZE, (lz) => lz), (lz) => {
                    expect(chunk.blocks[idx(lx, 0, lz)]).toBe(BEDROCK)
                    Arr.forEach([1, 2, 3, 4], (y) => expect(chunk.blocks[idx(lx, y, lz)]).not.toBe(AIR))
                  })
                )
              })
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('carves SOME AIR voxels in the deep-stone region (y=10..40)', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const coords = [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
          { x: 0, z: 1 },
          { x: 1, z: 1 },
        ]
        const airVoxelCountRef = MutableRef.make(0)

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                Arr.forEach(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) =>
                  Arr.forEach(Arr.makeBy(CHUNK_SIZE, (lz) => lz), (lz) =>
                    Arr.forEach(Arr.makeBy(31, (i) => 10 + i), (y) => {
                      if (chunk.blocks[idx(lx, y, lz)] === AIR) {
                        MutableRef.update(airVoxelCountRef, n => n + 1)
                      }
                    })
                  )
                )
              })
            }),
          { concurrency: 1 },
        )

        expect(MutableRef.get(airVoxelCountRef)).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('deterministic carving — same seed produces identical cave patterns', () => {
      const layer1 = buildTestLayer().TestLayer
      const layer2 = buildTestLayer().TestLayer

      return Effect.gen(function* () {
        const chunkA = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 5, z: -3 })
        }).pipe(Effect.provide(layer1))

        const chunkB = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 5, z: -3 })
        }).pipe(Effect.provide(layer2))

        expect(chunkA.blocks).toEqual(chunkB.blocks)
      })
    })
  })
})
