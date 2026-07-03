import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { ChunkManagerService } from '@ts-minecraft/world'
import { CHUNK_HEIGHT, CHUNK_SIZE, LAKE_LEVEL, blockTypeToIndex } from '@ts-minecraft/core'
import { buildTestLayer } from './chunk-manager-test-utils'

const WATER = blockTypeToIndex('WATER')
const ICE = blockTypeToIndex('ICE')

// Worldgen water-level invariant: every legitimate fill path tops out at
// LAKE_LEVEL (= SEA_LEVEL, with RIVER_WATER_LEVEL one below); frozen surfaces
// substitute ICE at the top cell. Water generated ABOVE this line would pour
// down slopes via the fluid sim and coat hillsides in flowing terraces — the
// visual bug hunted in the 2026-07-04 water pass. This probe generates real
// chunks (real noise + biome classification) across a spread of coordinates
// and asserts the ceiling holds everywhere.
describe('terrain water-level invariant', () => {
  const PROBE_COORDS = [
    { x: 0, z: 0 },
    { x: 3, z: -2 },
    { x: -5, z: 7 },
    { x: 12, z: 12 },
    { x: -9, z: -9 },
    { x: 25, z: 4 },
  ]

  it.effect('never generates water above LAKE_LEVEL', () =>
    Effect.gen(function* () {
      const chunkManager = yield* ChunkManagerService
      for (const coord of PROBE_COORDS) {
        const chunk = yield* chunkManager.getChunk(coord)
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            for (let y = LAKE_LEVEL + 1; y < CHUNK_HEIGHT; y++) {
              const idx = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
              const block = chunk.blocks[idx]
              if (block === WATER || block === ICE) {
                expect.fail(
                  `chunk ${coord.x},${coord.z} has ${block === WATER ? 'WATER' : 'ICE'} at local (${lx},${y},${lz}) — above LAKE_LEVEL ${LAKE_LEVEL}`,
                )
              }
            }
          }
        }
      }
    }).pipe(Effect.provide(buildTestLayer().TestLayer)),
  )
})
