import { Effect, Ref, Option } from 'effect'
import { type ChunkCacheKey } from '@ts-minecraft/core'
import { type ChunkAABB } from '../domain/chunk-aabb'
import type { DirtyVoxel } from '../domain/light-engine-model'
import type { ChunkOpsContext } from './chunk-manager-ops'
import type { ChunkCacheEntry } from './chunk-manager-cache'
import { type DirtyBfsResult, type DirtyBoundary } from './chunk-manager-service-helpers'
import { updateLitChunk } from './chunk-manager-service-cache'
import { resolveDirtyLightingPlan } from './chunk-manager-service-dirty-lighting'

const persistLitChunk = (
  ctx: ChunkOpsContext,
  key: ChunkCacheKey,
  skyLight: Uint8Array,
  blockLight: Uint8Array,
): Effect.Effect<void, never> => Ref.update(ctx.cache, (s) => updateLitChunk(s, key, skyLight, blockLight))

const buildEmptyDirtyBfsResult = (): Option.Option<{
  readonly boundary: DirtyBoundary
  readonly affectedAABB: Option.Option<ChunkAABB>
}> => Option.none()

const updateIncrementalDirtyLighting = (
  ctx: ChunkOpsContext,
  key: ChunkCacheKey,
  entry: ChunkCacheEntry,
  dirtyVoxels: ReadonlyArray<DirtyVoxel>,
): Effect.Effect<DirtyBfsResult, never> =>
  Effect.gen(function* () {
    const result = yield* ctx.lightEngine.propagateLightIncremental(entry.chunk, dirtyVoxels)
    yield* persistLitChunk(ctx, key, result.skyLight, result.blockLight)
    return Option.some({ boundary: result.boundary, affectedAABB: result.affectedAABB })
  })

const updateFullDirtyLighting = (
  ctx: ChunkOpsContext,
  key: ChunkCacheKey,
  entry: ChunkCacheEntry,
): Effect.Effect<DirtyBfsResult, never> =>
  Effect.gen(function* () {
    const grids = yield* ctx.lightEngine.updateLight(entry.chunk)
    yield* persistLitChunk(ctx, key, grids.skyLight, grids.blockLight)
    return buildEmptyDirtyBfsResult()
  })

export const updateDirtyChunkLighting = (
  ctx: ChunkOpsContext,
  key: ChunkCacheKey,
  entry: ChunkCacheEntry,
  dirtyVoxels?: ReadonlyArray<DirtyVoxel>,
): Effect.Effect<DirtyBfsResult, never> => {
  const plan = resolveDirtyLightingPlan(entry, dirtyVoxels)

  switch (plan._tag) {
    case 'incremental':
      return updateIncrementalDirtyLighting(ctx, key, entry, plan.dirtyVoxels)
    case 'full':
      return updateFullDirtyLighting(ctx, key, entry)
  }
}

export const resolveDirtyChunkLighting = (
  ctx: ChunkOpsContext,
  key: ChunkCacheKey,
  entry: ChunkCacheEntry | null,
  dirtyVoxels?: ReadonlyArray<DirtyVoxel>,
): Effect.Effect<DirtyBfsResult, never> =>
  entry === null ? Effect.succeed(buildEmptyDirtyBfsResult()) : updateDirtyChunkLighting(ctx, key, entry, dirtyVoxels)
