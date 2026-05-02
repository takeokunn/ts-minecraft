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

const inBounds = (lx: number, y: number, lz: number): boolean =>
  lx >= 0 && lx < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE

const lightBufferOrFresh = (buf: Uint8Array<ArrayBufferLike> | undefined): Uint8Array =>
  Option.match(Option.filter(Option.fromNullable(buf), (b) => b.byteLength === LIGHT_BYTE_LENGTH), {
    onNone: () => createLightBuffer(),
    onSome: (b) => b,
  })

// BFS is per-chunk only — no cross-chunk propagation; boundary lighting is intentionally imperfect.
export class LightEngineService extends Effect.Service<LightEngineService>()(
  '@minecraft/application/LightEngineService',
  {
    effect: Effect.succeed({
      computeLight: (chunk: Chunk): Effect.Effect<LightGrids, never> =>
        Effect.sync(() => {
          const sky = createLightBuffer()
          const block = createLightBuffer()
          computeSkyLight(chunk.blocks, sky)
          computeBlockLight(chunk.blocks, block)
          return { skyLight: sky, blockLight: block }
        }),

      updateLight: (chunk: Chunk): Effect.Effect<LightGrids, never> =>
        Effect.sync(() => {
          const sky = lightBufferOrFresh(chunk.skyLight)
          const block = lightBufferOrFresh(chunk.blockLight)
          computeSkyLight(chunk.blocks, sky)
          computeBlockLight(chunk.blocks, block)
          return { skyLight: sky, blockLight: block }
        }),

      getSkyLight: (chunk: Chunk, lx: number, y: number, lz: number): number => {
        if (!inBounds(lx, y, lz)) return 0
        return Option.match(Option.fromNullable(chunk.skyLight), {
          onNone: () => 15,
          onSome: (grid) => getLightAt(grid, lx, y, lz),
        })
      },

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
