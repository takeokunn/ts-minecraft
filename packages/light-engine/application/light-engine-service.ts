import { Effect, Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, type Chunk } from '@ts-minecraft/domain'
import {
  computeBlockLight,
  computeSkyLight,
  createLightBuffer,
  getLightAt,
  LIGHT_BYTE_LENGTH,
  type LightGrids,
} from '@ts-minecraft/domain'

export type { LightGrids } from '@ts-minecraft/domain'

/**
 * LightEngineService — Phase 1.6
 *
 * Computes and caches two 4-bit-per-voxel light grids per chunk:
 *   - skyLight:   top-down propagation from y=CHUNK_HEIGHT-1
 *   - blockLight: emitted by emissive blocks (LAVA=15, REDSTONE_ORE=9, …)
 *
 * Cross-chunk BFS is out of scope for Phase 1.6 — each chunk is computed in isolation,
 * so lighting at chunk boundaries is imperfect (acceptable trade-off).
 *
 * API:
 *   - computeLight(chunk):   runs both BFS passes, returns the two grids
 *   - updateLight(chunk):    same as compute, reusing chunk.skyLight/blockLight as output buffers when valid-sized (no mutation of chunk)
 *   - getSkyLight(chunk, lx, y, lz):   reads skyLight; returns 15 if not yet computed
 *   - getBlockLight(chunk, lx, y, lz): reads blockLight; returns 0 if not yet computed
 *
 * Rendering integration (mesh color per-vertex, AO, smooth interpolation) is out of scope —
 * this phase is pure data + algorithm only.
 */

const inBounds = (lx: number, y: number, lz: number): boolean =>
  lx >= 0 && lx < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE

const lightBufferOrFresh = (buf: Uint8Array<ArrayBufferLike> | undefined): Uint8Array =>
  Option.match(Option.filter(Option.fromNullable(buf), (b) => b.byteLength === LIGHT_BYTE_LENGTH), {
    onNone: () => createLightBuffer(),
    onSome: (b) => b,
  })

export class LightEngineService extends Effect.Service<LightEngineService>()(
  '@minecraft/application/LightEngineService',
  {
    effect: Effect.succeed({
      /**
       * Compute both light grids for a chunk (no mutation).
       * Pure sync compute wrapped in Effect at service boundary.
       */
      computeLight: (chunk: Chunk): Effect.Effect<LightGrids, never> =>
        Effect.sync(() => {
          const sky = createLightBuffer()
          const block = createLightBuffer()
          computeSkyLight(chunk.blocks, sky)
          computeBlockLight(chunk.blocks, block)
          return { skyLight: sky, blockLight: block }
        }),

      /**
       * Compute fresh grids; reuses chunk.skyLight/blockLight as output buffers if they have
       * the correct byteLength, otherwise allocates. Does NOT mutate the chunk — caller is
       * responsible for reassignment.
       */
      updateLight: (chunk: Chunk): Effect.Effect<LightGrids, never> =>
        Effect.sync(() => {
          const sky = lightBufferOrFresh(chunk.skyLight)
          const block = lightBufferOrFresh(chunk.blockLight)
          computeSkyLight(chunk.blocks, sky)
          computeBlockLight(chunk.blocks, block)
          return { skyLight: sky, blockLight: block }
        }),

      /**
       * Read sky light at a local chunk position.
       * If skyLight has not been computed yet, returns 15 (treat as daylight default).
       * Out-of-bounds returns 0.
       */
      getSkyLight: (chunk: Chunk, lx: number, y: number, lz: number): number => {
        if (!inBounds(lx, y, lz)) return 0
        return Option.match(Option.fromNullable(chunk.skyLight), {
          onNone: () => 15,
          onSome: (grid) => getLightAt(grid, lx, y, lz),
        })
      },

      /**
       * Read block (emissive) light at a local chunk position.
       * If blockLight has not been computed yet, returns 0.
       * Out-of-bounds returns 0.
       */
      getBlockLight: (chunk: Chunk, lx: number, y: number, lz: number): number => {
        if (!inBounds(lx, y, lz)) return 0
        return Option.match(Option.fromNullable(chunk.blockLight), {
          onNone: () => 0,
          onSome: (grid) => getLightAt(grid, lx, y, lz),
        })
      },
    }),
  }
) {}

export const LightEngineLive = LightEngineService.Default
