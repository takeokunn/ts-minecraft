import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Effect, Layer, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndexUnsafe, blockTypeToIndex } from '@ts-minecraft/core'
import { ChunkService, ChunkServiceLive, LightEngineLive, LightEngineService } from '@ts-minecraft/world'
import type { ChunkService as ChunkServiceType } from '@ts-minecraft/world'
import { LIGHT_BYTE_LENGTH } from '@ts-minecraft/world'

interface MutableChunk {
  skyLight?: Uint8Array
  blockLight?: Uint8Array
}

const STONE = blockTypeToIndex('STONE')
const LAVA = blockTypeToIndex('LAVA')
const REDSTONE_BLOCK = blockTypeToIndex('REDSTONE_BLOCK')
const AIR = 0

// Block IDs that are interesting for light-propagation property tests.
// We restrict to a small set to keep the state space tractable while still
// covering: opaque blockers (STONE), block emitters (LAVA, REDSTONE_BLOCK),
// and AIR (transparent, non-emitter).
const TEST_BLOCK_IDS = [AIR, STONE, LAVA, REDSTONE_BLOCK] as const

const withLightService = <A>(
  f: (cs: ChunkServiceType, ls: LightEngineService) => Effect.Effect<A, never>,
): Effect.Effect<A, never> =>
  Effect.all([ChunkService, LightEngineService]).pipe(
    Effect.flatMap(([cs, ls]) => f(cs, ls)),
    Effect.provide(Layer.mergeAll(ChunkServiceLive, LightEngineLive)),
  )

// Coordinate arbitraries — bound the search space to a small region to keep
// the property test fast (fc default numRuns multiplied by chunk dimensions
// would otherwise be too slow).
const ArbLx = Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_SIZE - 1)))
const ArbLz = Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_SIZE - 1)))
const ArbY = Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(60, 140)))
const ArbBlockChoice = fc.constantFrom(...TEST_BLOCK_IDS)

const ArbEdit = fc.record({ lx: ArbLx, y: ArbY, lz: ArbLz, block: ArbBlockChoice })
const ArbEditList = fc.array(ArbEdit, { minLength: 1, maxLength: 4 })

const ArbInitialFill = fc.constantFrom(
  // empty chunk
  () => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  // single LAVA at center
  () => {
    const b = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    b[blockIndexUnsafe(8, 100, 8)] = LAVA
    return b
  },
  // STONE pillar at (8, 8) full-height — column has 0 sky exposure
  () => {
    const b = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    for (let y = 0; y < CHUNK_HEIGHT; y++) b[blockIndexUnsafe(8, y, 8)] = STONE
    return b
  },
)

describe('LightEngine BFS-incremental vs full re-compute equivalence (FR-3.4)', () => {
  it.effect.prop(
    'BFS incremental result equals full re-compute for any edit sequence',
    { initial: ArbInitialFill, edits: ArbEditList },
    ({ initial, edits }) =>
      withLightService((cs, ls) =>
        Effect.gen(function* () {
          // Setup chunk-A (incremental) and chunk-B (full re-compute) with
          // identical initial state.
          const baseBlocks = initial()
          const chunkA = yield* cs.createChunk({ x: 0, z: 0 })
          chunkA.blocks.set(baseBlocks)
          const chunkB = yield* cs.createChunk({ x: 0, z: 0 })
          chunkB.blocks.set(baseBlocks)

          // Bake initial lighting on both via full compute (so chunkA has
          // a coherent prior state for incremental BFS).
          const baselineA = yield* ls.updateLight(chunkA)
          ;(chunkA as MutableChunk).skyLight = baselineA.skyLight
          ;(chunkA as MutableChunk).blockLight = baselineA.blockLight

          // Apply each edit; chunkA via BFS incremental, chunkB via full.
          for (let i = 0; i < edits.length; i++) {
            const e = edits[i]!
            const idx = blockIndexUnsafe(e.lx, e.y, e.lz)
            chunkA.blocks[idx] = e.block
            chunkB.blocks[idx] = e.block
            yield* ls.propagateLightIncremental(chunkA, [{ lx: e.lx, y: e.y, lz: e.lz }])
          }

          // Final full re-compute on chunkB (no incremental — fresh buffers).
          const finalB = yield* ls.updateLight(chunkB)
          // chunkA's grids were mutated in place by propagateLightIncremental.
          const finalA = {
            skyLight: (chunkA as MutableChunk).skyLight!,
            blockLight: (chunkA as MutableChunk).blockLight!,
          }

          // Equivalence assertion — every byte must match.
          expect(finalA.skyLight.byteLength).toBe(LIGHT_BYTE_LENGTH)
          expect(finalA.blockLight.byteLength).toBe(LIGHT_BYTE_LENGTH)
          expect(finalA.skyLight).toEqual(finalB.skyLight)
          expect(finalA.blockLight).toEqual(finalB.blockLight)
        }),
      ),
    { fastCheck: { numRuns: 15 }, timeout: 30000 },
  )
})
