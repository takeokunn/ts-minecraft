import { Effect } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'
import { blockTypeToIndex } from '@ts-minecraft/core'
import type { Chunk } from '../chunk'
import { NoiseServicePort } from '../noise-service-port'
import type { ChunkFactory } from './generator-types'
import { chunkBlockIndexUnchecked, hash3 } from './math'
import { CAVE_SAMPLE_STRIDE, CAVE_NOISE_SCALE } from './constants'

const NETHER_FLOOR_BEDROCK_TOP = 3     // y=0 always, y=1-3 probabilistic
const NETHER_CEILING_Y = 127           // Top bedrock layer always
const NETHER_CEILING_BEDROCK_BOTTOM = 124  // y=124-126 probabilistic ceiling bedrock
const NETHER_LAVA_LEVEL = 32           // Air below this y becomes lava
const NETHER_HABITABLE_TOP = 123       // NETHERRACK up to here
// More aggressive cave carving than overworld (0.18); creates large open caverns
const NETHER_CAVE_THRESHOLD = 0.36
// Noise offset ensures nether caves are independent of overworld cave patterns
const NETHER_NOISE_SALT = 100000

// Bedrock floor probabilities indexed by y (y=0 always bedrock)
const FLOOR_BEDROCK_PROB: readonly number[] = [1.0, 0.75, 0.5, 0.25]
// Bedrock ceiling probabilities from bottom: y=124=0.25, 125=0.5, 126=0.75, 127=1.0
const CEILING_BEDROCK_PROB: readonly number[] = [0.25, 0.5, 0.75, 1.0]

export const generateNetherTerrain = (
  chunkService: ChunkFactory,
  noiseService: NoiseServicePort,
  coord: ChunkCoord,
): Effect.Effect<Chunk, never> =>
  Effect.gen(function* () {
    const chunk = yield* chunkService.createChunk(coord)
    const blocks = chunk.blocks
    const baseWorldX = coord.x * CHUNK_SIZE
    const baseWorldZ = coord.z * CHUNK_SIZE

    const netherrackIndex = blockTypeToIndex('NETHERRACK')
    const bedrockIndex = blockTypeToIndex('BEDROCK')
    const lavaIndex = blockTypeToIndex('LAVA')
    // AIR is index 0 (default from createChunk); no fill needed

    // --- Fill habitable nether region with NETHERRACK ---
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y <= NETHER_HABITABLE_TOP; y++) {
          blocks[chunkBlockIndexUnchecked(lx, y, lz)] = netherrackIndex
        }
      }
    }

    // --- Bedrock floor: y=0 always; y=1-3 probabilistic ---
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseWorldX + lx
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wz = baseWorldZ + lz
        for (let y = 0; y <= NETHER_FLOOR_BEDROCK_TOP; y++) {
          const prob = FLOOR_BEDROCK_PROB[y]!
          if (hash3(wx, y, wz) < prob) {
            blocks[chunkBlockIndexUnchecked(lx, y, lz)] = bedrockIndex
          }
        }
      }
    }

    // --- Bedrock ceiling: y=127 always; y=124-126 probabilistic ---
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseWorldX + lx
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wz = baseWorldZ + lz
        for (let y = NETHER_CEILING_BEDROCK_BOTTOM; y <= NETHER_CEILING_Y; y++) {
          const probIdx = y - NETHER_CEILING_BEDROCK_BOTTOM
          const prob = CEILING_BEDROCK_PROB[probIdx]!
          if (hash3(wx, y + 500, wz) < prob) {
            blocks[chunkBlockIndexUnchecked(lx, y, lz)] = bedrockIndex
          }
        }
      }
    }

    // --- Cave carving via 3D noise (same stride as overworld, offset to avoid correlation) ---
    const caveSX = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
    const caveSZ = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
    const caveYTop = Math.floor(NETHER_HABITABLE_TOP / CAVE_SAMPLE_STRIDE) + 1
    const pointCount = caveSX * caveSZ * caveYTop

    const caveXs: number[] = []
    const caveYs: number[] = []
    const caveZs: number[] = []
    caveXs.length = pointCount
    caveYs.length = pointCount
    caveZs.length = pointCount

    let idx = 0
    for (let sy = 0; sy < caveYTop; sy++) {
      const y = sy * CAVE_SAMPLE_STRIDE * CAVE_NOISE_SCALE
      for (let sz = 0; sz < caveSZ; sz++) {
        const z = (baseWorldZ + sz * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE + NETHER_NOISE_SALT
        for (let sx = 0; sx < caveSX; sx++) {
          caveXs[idx] = (baseWorldX + sx * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE + NETHER_NOISE_SALT
          caveYs[idx] = y
          caveZs[idx] = z
          idx++
        }
      }
    }

    const caveSamples = yield* noiseService.noise3DBatchXYZ(caveXs, caveYs, caveZs)

    const sample = (sx: number, sy: number, sz: number): number =>
      caveSamples[sx + sz * caveSX + sy * caveSX * caveSZ]!

    const CARVE_FLOOR = NETHER_FLOOR_BEDROCK_TOP + 1  // y=4
    const CARVE_CEILING = NETHER_HABITABLE_TOP - 5    // y=118

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const sx0 = Math.floor(lx / CAVE_SAMPLE_STRIDE)
      const sx1 = sx0 + 1
      const fx = (lx - sx0 * CAVE_SAMPLE_STRIDE) / CAVE_SAMPLE_STRIDE
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const sz0 = Math.floor(lz / CAVE_SAMPLE_STRIDE)
        const sz1 = sz0 + 1
        const fz = (lz - sz0 * CAVE_SAMPLE_STRIDE) / CAVE_SAMPLE_STRIDE
        for (let y = CARVE_FLOOR; y <= CARVE_CEILING; y++) {
          const blockIdx = chunkBlockIndexUnchecked(lx, y, lz)
          // Never carve bedrock
          if (blocks[blockIdx] === bedrockIndex) continue

          const sy0 = Math.floor(y / CAVE_SAMPLE_STRIDE)
          const sy1 = sy0 + 1
          const fy = (y - sy0 * CAVE_SAMPLE_STRIDE) / CAVE_SAMPLE_STRIDE

          // Trilinear interpolation
          const c000 = sample(sx0, sy0, sz0); const c100 = sample(sx1, sy0, sz0)
          const c010 = sample(sx0, sy0, sz1); const c110 = sample(sx1, sy0, sz1)
          const c001 = sample(sx0, sy1, sz0); const c101 = sample(sx1, sy1, sz0)
          const c011 = sample(sx0, sy1, sz1); const c111 = sample(sx1, sy1, sz1)
          const c00 = c000 * (1 - fx) + c100 * fx; const c10 = c010 * (1 - fx) + c110 * fx
          const c01 = c001 * (1 - fx) + c101 * fx; const c11 = c011 * (1 - fx) + c111 * fx
          const c0 = c00 * (1 - fz) + c10 * fz;   const c1 = c01 * (1 - fz) + c11 * fz
          const interpolated = c0 * (1 - fy) + c1 * fy

          if (Math.abs(interpolated) < NETHER_CAVE_THRESHOLD) {
            blocks[blockIdx] = y <= NETHER_LAVA_LEVEL ? lavaIndex : 0
          }
        }
      }
    }

    return { ...chunk, blocks }
  })
