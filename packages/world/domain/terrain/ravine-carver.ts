import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { ColumnState } from './generator-types'
import { columnStateIndex } from './generator-pipeline-model'
import { chunkBlockIndexUnchecked } from './math'

// Ravines: long narrow canyons sliced into the surface along a low-frequency
// noise band (the same band trick rivers use, but rarer, deeper, and with
// walls that taper toward the floor). Bottoms deep enough expose a lava bed
// like vanilla's.
export const RAVINE_NOISE_SCALE = 0.004
export const RAVINE_WORLD_OFFSET = 40_000
export const RAVINE_CENTER = 0.5
// Single-octave noise clusters near 0.5 (see the river-width lesson), so this
// narrow band still yields ~2% of columns — vanilla-rare slashes, not canyonsprawl.
export const RAVINE_HALF_WIDTH = 0.006
export const RAVINE_MAX_DEPTH = 28
const RAVINE_LAVA_BED_BELOW_Y = 16

// Carves this chunk's ravine columns. ravineNoiseVals are normalized [0,1]
// samples indexed lx * CHUNK_SIZE + lz — the same convention as the
// generator's column coordinate arrays and columnStates.
export const carveRavines = (
  blocks: Uint8Array,
  ravineNoiseVals: ReadonlyArray<number>,
  columnStates: ReadonlyArray<ColumnState>,
  airBlockIndex: number,
  lavaBlockIndex: number,
  bedrockBlockIndex: number,
): number => {
  let carvedColumns = 0
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const noise = ravineNoiseVals[lx * CHUNK_SIZE + lz]
      if (noise === undefined) continue
      const distance = Math.abs(noise - RAVINE_CENTER)
      if (distance >= RAVINE_HALF_WIDTH) continue

      const state = columnStates[columnStateIndex(lx, lz)]
      if (state === undefined) continue
      // Water bodies keep their beds — vanilla surface ravines don't slice rivers open.
      if (state.biome === 'OCEAN' || state.biome === 'RIVER') continue

      // Walls taper: full depth at the band center, shallow at the edges.
      const taper = 1 - (distance / RAVINE_HALF_WIDTH) ** 2
      const depth = Math.round(RAVINE_MAX_DEPTH * taper)
      if (depth < 3) continue

      const floorY = Math.max(6, state.surfaceY - depth)
      for (let y = state.surfaceY; y > floorY; y--) {
        const idx = chunkBlockIndexUnchecked(lx, y, lz)
        if (blocks[idx] === bedrockBlockIndex) continue
        blocks[idx] = airBlockIndex
      }
      // Deep cuts reach the lava table.
      if (floorY <= RAVINE_LAVA_BED_BELOW_Y) {
        const idx = chunkBlockIndexUnchecked(lx, floorY, lz)
        if (blocks[idx] !== bedrockBlockIndex) blocks[idx] = lavaBlockIndex
      }
      carvedColumns++
    }
  }
  return carvedColumns
}
