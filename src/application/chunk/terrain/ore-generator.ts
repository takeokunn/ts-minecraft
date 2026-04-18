import { Array as Arr } from 'effect'
import { blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { ORE_CONFIGS, ORE_MIN_Y_FLOOR, DEEPSLATE_CEILING } from './constants'
import { mulberry32, seedFromChunk, chunkBlockIndexUnchecked } from './math'

/**
 * Pre-resolved ore block indices — parallel arrays to ORE_CONFIGS.
 * Computed once at module load; reused across every chunk generation.
 */
export const ORE_REGULAR_INDICES: ReadonlyArray<number> = Arr.map(ORE_CONFIGS, (cfg) => blockTypeToIndex(`${cfg.name}_ORE`))
export const ORE_DEEPSLATE_INDICES: ReadonlyArray<number> = Arr.map(ORE_CONFIGS, (cfg) => blockTypeToIndex(`DEEPSLATE_${cfg.name}_ORE`))

/**
 * Grow a single ore vein starting at (seedX, seedY, seedZ) via stack-based
 * random walk. Places `targetSize` voxels total (fewer if candidates run out).
 *
 * Replaces ONLY stoneBlockIndex or deepslateBlockIndex — skips AIR/WATER/
 * BEDROCK/DIRT/other-ores. The block type chosen at each voxel depends on
 * the altitude: y < DEEPSLATE_CEILING → deepslate variant, else regular.
 *
 * `yMin`/`yMax` clamp the vein's vertical extent to the ore's depth band so
 * neighbor expansion cannot leak a vein outside the configured range (e.g.
 * DIAMOND growing from y=16 up to y=17).
 *
 * `rngState` is advanced across calls — caller threads the returned state
 * back into subsequent rolls so the whole chunk's ore placement is one
 * deterministic PRNG stream.
 */
export const growVein = (
  blocks: Uint8Array,
  seedX: number,
  seedY: number,
  seedZ: number,
  targetSize: number,
  oreIndex: number,
  deepslateOreIndex: number,
  stoneBlockIndex: number,
  deepslateBlockIndex: number,
  yMin: number,
  yMax: number,
  rngState: number
): number => {
  let state = rngState
  let placed = 0
  // Stack of candidate (lx, y, lz) positions — seeded with the start voxel.
  const stack: number[] = [seedX, seedY, seedZ]

  while (placed < targetSize && stack.length > 0) {
    // Pick a random candidate from the stack (random-walk-ish — avoids linear
    // BFS shape). Advance RNG for the pick.
    const { state: s1, value: pickRng } = mulberry32(state)
    state = s1
    const pickIdx = Math.floor(pickRng * (stack.length / 3)) * 3
    const cx = stack[pickIdx]!
    const cy = stack[pickIdx + 1]!
    const cz = stack[pickIdx + 2]!
    // Swap-remove the picked triple from the stack (O(1) removal).
    const lastBase = stack.length - 3
    if (pickIdx !== lastBase) {
      stack[pickIdx] = stack[lastBase]!
      stack[pickIdx + 1] = stack[lastBase + 1]!
      stack[pickIdx + 2] = stack[lastBase + 2]!
    }
    stack.length = lastBase

    // Bounds check — skip out-of-chunk candidates silently.
    if (cx < 0 || cx >= CHUNK_SIZE || cz < 0 || cz >= CHUNK_SIZE) continue
    // Vertical clamp: enforces per-ore depth band (protects bedrock too via yMin).
    if (cy < yMin || cy > yMax) continue

    const idx = chunkBlockIndexUnchecked(cx, cy, cz)
    const current = blocks[idx]!
    // Replace STONE or DEEPSLATE only — never anything else.
    if (current !== stoneBlockIndex && current !== deepslateBlockIndex) continue

    blocks[idx] = cy < DEEPSLATE_CEILING ? deepslateOreIndex : oreIndex
    placed++

    // Push 6 neighbors as future candidates; random-walk pick naturally grows a blob.
    stack.push(cx + 1, cy, cz)
    stack.push(cx - 1, cy, cz)
    stack.push(cx, cy + 1, cz)
    stack.push(cx, cy - 1, cz)
    stack.push(cx, cy, cz + 1)
    stack.push(cx, cy, cz - 1)
  }

  return state
}

/**
 * Place depth-banded ore veins into a pre-carved chunk block array.
 *
 * Pure synchronous function. Seeded deterministically from (baseWorldX,
 * baseWorldZ) so chunk reloads produce identical ore placement. No external
 * RNG dependency, no Effect overhead.
 *
 * Never overwrites AIR/WATER/BEDROCK/DIRT/GRASS/SAND/existing-ores. Only
 * STONE and DEEPSLATE are valid replacement targets.
 */
export const placeOres = (
  blocks: Uint8Array,
  baseWorldX: number,
  baseWorldZ: number,
  oreIndices: {
    stoneBlockIndex: number
    deepslateBlockIndex: number
    regular: ReadonlyArray<number>   // parallel to ORE_CONFIGS
    deepslate: ReadonlyArray<number> // parallel to ORE_CONFIGS
  }
): void => {
  const { stoneBlockIndex, deepslateBlockIndex, regular, deepslate } = oreIndices

  for (let oreIdx = 0; oreIdx < ORE_CONFIGS.length; oreIdx++) {
    const cfg = ORE_CONFIGS[oreIdx]!
    const oreBlock = regular[oreIdx]!
    const deepslateOreBlock = deepslate[oreIdx]!

    // Seed per-ore RNG stream from chunk coord + per-ore salt — deterministic.
    let state = seedFromChunk(baseWorldX, baseWorldZ, cfg.saltX, cfg.saltZ)

    // Vein count: avgVeins ± 1 variance. avgVeins=0 → always 0; small avg stays small.
    const { state: s0, value: countRng } = mulberry32(state)
    state = s0
    const count = Math.max(0, Math.round(cfg.avgVeins - 1 + countRng * 2))

    // Effective Y band, clamped to the protected floor.
    const yMin = Math.max(cfg.minY, ORE_MIN_Y_FLOOR)
    const yMax = Math.min(cfg.maxY, CHUNK_HEIGHT - 1)
    if (yMax < yMin) continue

    for (let v = 0; v < count; v++) {
      // Re-roll seed position up to MAX_SEED_ATTEMPTS if the initial voxel
      // isn't STONE/DEEPSLATE — otherwise caves/surface quirks can prevent
      // nearly all veins from placing at shallow-depth ores (e.g. DIAMOND).
      const { state: ssize, value: rsize } = mulberry32(state)
      state = ssize
      const veinSize = cfg.minSize + Math.floor(rsize * (cfg.maxSize - cfg.minSize + 1))

      const MAX_SEED_ATTEMPTS = 8
      let placed = false
      for (let attempt = 0; attempt < MAX_SEED_ATTEMPTS && !placed; attempt++) {
        const { state: sx, value: rx } = mulberry32(state)
        const { state: sy, value: ry } = mulberry32(sx)
        const { state: sz, value: rz } = mulberry32(sy)
        state = sz

        const seedX = Math.floor(rx * CHUNK_SIZE)
        const seedY = Math.floor(yMin + ry * (yMax - yMin + 1))
        const seedZ = Math.floor(rz * CHUNK_SIZE)

        const seedIdx = chunkBlockIndexUnchecked(seedX, seedY, seedZ)
        const seedCurrent = blocks[seedIdx]!
        if (seedCurrent !== stoneBlockIndex && seedCurrent !== deepslateBlockIndex) continue

        state = growVein(
          blocks,
          seedX,
          seedY,
          seedZ,
          veinSize,
          oreBlock,
          deepslateOreBlock,
          stoneBlockIndex,
          deepslateBlockIndex,
          yMin,
          yMax,
          state
        )
        placed = true
      }
    }
  }
}
