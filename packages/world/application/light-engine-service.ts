import { Effect } from 'effect'
import { getLightAt } from '@ts-minecraft/block'
import type { Chunk } from '../domain/chunk'
import type { DirtyVoxel, IncrementalLightResult } from '../domain/light-engine-model'
import { inLightBounds } from '../domain/light-engine-utils'
import { computeFreshLight, propagateIncremental, updateExistingLight, type LightGrids } from '../domain/light-engine-helpers'

export type { BoundaryDirty, DirtyVoxel, IncrementalLightResult } from '../domain/light-engine-model'
export type { LightGrids } from '../domain/light-engine-helpers'
export { FULL_RECOMPUTE_THRESHOLD } from '../domain/light-engine-utils'

export class LightEngineService extends Effect.Service<LightEngineService>()(
  '@minecraft/application/LightEngineService',
  {
    effect: Effect.succeed({
      computeLight: (chunk: Chunk): Effect.Effect<LightGrids, never> => Effect.sync(() => computeFreshLight(chunk)),
      updateLight: (chunk: Chunk): Effect.Effect<LightGrids, never> => Effect.sync(() => updateExistingLight(chunk)),
      propagateLightIncremental: (
        chunk: Chunk,
        dirtyVoxels: ReadonlyArray<DirtyVoxel>,
      ): Effect.Effect<IncrementalLightResult, never> => Effect.sync(() => propagateIncremental(chunk, dirtyVoxels)),
      getSkyLight: (chunk: Chunk, lx: number, y: number, lz: number): number => {
        if (!inLightBounds(lx, y, lz)) return 0
        return chunk.skyLight ? getLightAt(chunk.skyLight, lx, y, lz) : 15
      },
      getBlockLight: (chunk: Chunk, lx: number, y: number, lz: number): number => {
        if (!inLightBounds(lx, y, lz)) return 0
        return chunk.blockLight ? getLightAt(chunk.blockLight, lx, y, lz) : 0
      },
    }),
  }
) {}
