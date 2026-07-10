import { CHUNK_SIZE } from '@ts-minecraft/core'
import { chunkBlockIndexUnchecked } from './math'

// Water bodies (sea/lake/river) all sit well below this line; scanning higher
// would only walk empty sky.
export const HEAL_SCAN_TOP_Y = 96

// Heals "hollow water bed" columns in chunks saved before the carver fix:
// carving used to eat the river/lake bed from beneath its water, leaving a
// floating water sheet over an unlit cavity (the black-void bug). Any AIR run
// directly beneath a water (or ice) block is flooded down to the first solid
// block, restoring a continuous water body.
//
// Also harmlessly solidifies a mid-simulation falling-water column that was
// saved mid-flow — flooding it approximates the steady state the fluid sim
// would reach anyway.
//
// Idempotent and cheap (≤ 16×16×96 reads), so it runs on every storage load
// without marking the chunk dirty.
export const healHollowWaterBeds = (
  blocks: Uint8Array,
  airBlockIndex: number,
  waterBlockIndex: number,
  iceBlockIndex: number,
): boolean => {
  let healed = false
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = HEAL_SCAN_TOP_Y; y >= 1; y--) {
        const current = blocks[chunkBlockIndexUnchecked(lx, y, lz)]
        if (current !== waterBlockIndex && current !== iceBlockIndex) continue
        // Flood the air run below this water down to the first non-AIR block.
        let yy = y - 1
        while (yy >= 1 && blocks[chunkBlockIndexUnchecked(lx, yy, lz)] === airBlockIndex) {
          blocks[chunkBlockIndexUnchecked(lx, yy, lz)] = waterBlockIndex
          healed = true
          yy--
        }
        // Resume the scan below the run we just inspected/filled.
        y = yy + 1
      }
    }
  }
  return healed
}
