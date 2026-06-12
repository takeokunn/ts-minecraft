import { Effect, Option, Ref } from 'effect'
import { resolveBlockCollisionsInto } from '@ts-minecraft/game'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { MOB_HALF_HEIGHT, MOB_HALF_WIDTH, BREED_XP_REWARD } from '@ts-minecraft/entity'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { runTickable } from '@ts-minecraft/app/frame/frame-runtime-logic'
import { REDSTONE_TICK_INTERVAL_SECS, FLUID_TICK_INTERVAL_SECS } from '@ts-minecraft/app/frame-handler.config'
import { CHUNK_HEIGHT, CHUNK_SIZE, type DeltaTimeSecs, type Position } from '@ts-minecraft/core'

const ENTITY_PHYSICS_CHUNK_OFFSETS = [
  [-1, -1, 0], [-1, 0, 1], [-1, 1, 2],
  [0, -1, 3], [0, 0, 4], [0, 1, 5],
  [1, -1, 6], [1, 0, 7], [1, 1, 8],
] as const
const CHUNK_LOCAL_MASK = CHUNK_SIZE - 1
const RENDER_DISABLED_STRUCTURE_VERSION = Number.NEGATIVE_INFINITY

export const entityUpdateStage = (
  deps: Pick<FrameHandlerDeps, 'scene'>,
  services: Pick<
    FrameHandlerServices,
    'chunkManagerService' | 'entityManager' | 'entityRenderer' | 'redstoneService' | 'fluidService' | 'particleSystem' | 'debugFeatureFlags' | 'xpService'
  >,
  refs: Pick<
    FrameStageRefs,
    | 'lastEntityStructureVersionRef'
    | 'entityPhysicsChunkCacheRef'
    | 'lastEntityPhysicsChunkCoordRef'
    | 'lastEntityPhysicsLoadedChunksRef'
    | 'lastLoadedChunksRef'
    | 'redstoneTickAccumulatorRef'
    | 'fluidTickAccumulatorRef'
  >,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly playerPos: Position
    readonly totalTimeSecs: number
    readonly isNight: boolean
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags()
    const mobsEnabled = debugFlags['mobs.enabled']
    const mobsAiEnabled = mobsEnabled && debugFlags['mobs.ai']
    const mobsPhysicsEnabled = mobsEnabled && debugFlags['mobs.physics']
    const mobsRenderEnabled = mobsEnabled && debugFlags['mobs.render']

    // Entity simulation stays on the frame lane so visible transforms remain responsive.
    // Slower world simulation (furnace/spawn/village) runs on the maintenance lane.
    if (mobsAiEnabled) {
      yield* logErrors(services.entityManager.update(inputs.deltaTime, inputs.playerPos, inputs.isNight), 'Entity system error')
      // R10: reward the player with XP for each animal born this tick (vanilla breeding XP).
      const births = yield* services.entityManager.drainBirths()
      if (births > 0) {
        yield* logErrors(services.xpService.addXP(births * BREED_XP_REWARD), 'Breeding XP error')
      }
    }

    const applyPhysics = services.entityManager.applyPhysics
    if (mobsPhysicsEnabled && typeof applyPhysics === 'function') {
      const playerCx = Math.floor(inputs.playerPos.x / CHUNK_SIZE)
      const playerCz = Math.floor(inputs.playerPos.z / CHUNK_SIZE)
      const lastChunkCoord = yield* Ref.get(refs.lastEntityPhysicsChunkCoordRef)
      const loadedChunks = yield* Ref.get(refs.lastLoadedChunksRef)
      const lastLoadedChunks = yield* Ref.get(refs.lastEntityPhysicsLoadedChunksRef)
      const loadedChunksChanged =
        Option.isSome(loadedChunks) !== Option.isSome(lastLoadedChunks) ||
        Option.getOrElse(Option.zipWith(loadedChunks, lastLoadedChunks, (a, b) => a !== b), () => false)
      let chunkCache = yield* Ref.get(refs.entityPhysicsChunkCacheRef)
      const chunkCoordChanged = lastChunkCoord.cx !== playerCx || lastChunkCoord.cz !== playerCz
      const hasMissingChunk = chunkCache.some((chunk) => chunk == null)

      if (chunkCoordChanged || loadedChunksChanged || hasMissingChunk) {
        const refreshAllChunks = chunkCoordChanged || loadedChunksChanged
        // Mutate the existing cache array in-place to avoid a 9-element Array
        // allocation on every chunk-boundary crossing.  fill() resets all slots
        // when the player moves to a new chunk; individual nulls are filled
        // below when only a partial cache miss remains.
        if (refreshAllChunks) chunkCache.fill(null)

        // Sequential for...of: chunk boundary crossing event (not per-frame).
        // Individual yield* avoids fiber spawn + Effect.gen callback allocations.
        for (const [dx, dz, index] of ENTITY_PHYSICS_CHUNK_OFFSETS) {
          /* c8 ignore next 3 -- cache-hit path: requires 2nd frame at same chunk coord with partial cache populated */
          if (!refreshAllChunks && chunkCache[index] != null) continue
          const chunk = yield* services.chunkManagerService.getChunk({ x: playerCx + dx, z: playerCz + dz }).pipe(Effect.catchAll(() => Effect.succeed(null)))
          if (chunk !== null) chunkCache[index] = chunk
        }

        yield* Ref.set(refs.entityPhysicsChunkCacheRef, chunkCache)
        yield* Ref.set(refs.lastEntityPhysicsChunkCoordRef, { cx: playerCx, cz: playerCz })
        yield* Ref.set(refs.lastEntityPhysicsLoadedChunksRef, loadedChunks)
      }

      /* c8 ignore start -- mob physics block-check: specific edge cases require complex chunk state */
      const isBlockSolid = (wx: number, wy: number, wz: number): boolean => {
        const ly = Math.floor(wy)
        if (ly < 0) return true
        if (ly >= CHUNK_HEIGHT) return false

        const bx = Math.floor(wx)
        const bz = Math.floor(wz)
        const cx = Math.floor(bx / CHUNK_SIZE)
        const cz = Math.floor(bz / CHUNK_SIZE)
        const dx = cx - playerCx
        const dz = cz - playerCz
        if (dx < -1 || dx > 1 || dz < -1 || dz > 1) return false

        const cachedChunk = chunkCache[(dx + 1) * 3 + (dz + 1)]
        if (cachedChunk == null) return false
      /* c8 ignore end */

        const lx = bx & CHUNK_LOCAL_MASK
        const lz = bz & CHUNK_LOCAL_MASK
        return (cachedChunk.blocks[chunkBlockIndexUnchecked(lx, ly, lz)] ?? 0) !== 0
      }

      yield* logErrors(
        applyPhysics(
          inputs.deltaTime,
          (
            outPos: { x: number; y: number; z: number },
            outVel: { x: number; y: number; z: number },
            position: Position,
            velocity: { x: number; y: number; z: number },
          ) => resolveBlockCollisionsInto(outPos, outVel, position, velocity, MOB_HALF_WIDTH, MOB_HALF_HEIGHT, isBlockSolid),
        ),
        'Entity physics error',
      )
    }

    yield* logErrors(
      // Sequential: both are synchronous reads; unbounded concurrency would
      // spawn fibers every frame for no parallelism gain.
      Effect.gen(function* () {
        const entitiesSnapshot = yield* services.entityManager.getEntities()
        const structureVersion = yield* services.entityManager.getStructureVersion()
        const lastStructureVersion = yield* Ref.get(refs.lastEntityStructureVersionRef)
        if (!mobsRenderEnabled) {
          /* c8 ignore start -- mobs-disabled render path; idempotent and hard to trigger in frame tests */
          if (lastStructureVersion !== RENDER_DISABLED_STRUCTURE_VERSION) {
            yield* services.entityRenderer.syncEntities([], deps.scene)
            yield* Ref.set(refs.lastEntityStructureVersionRef, RENDER_DISABLED_STRUCTURE_VERSION)
          }
          /* c8 ignore end */
          return
        }
        if (lastStructureVersion !== structureVersion) {
          yield* services.entityRenderer.syncEntities(entitiesSnapshot, deps.scene)
          yield* Ref.set(refs.lastEntityStructureVersionRef, structureVersion)
        }
        yield* services.entityRenderer.updateEntityTransforms(
          entitiesSnapshot,
          inputs.totalTimeSecs,
          inputs.deltaTime,
        )
      }),
      'Entity render error',
    )

    if (debugFlags['simulation.redstone']) {
      yield* logErrors(
        runTickable(refs.redstoneTickAccumulatorRef, services.redstoneService.tick(), inputs.deltaTime, REDSTONE_TICK_INTERVAL_SECS),
        'Redstone system error',
      )
    }

    if (debugFlags['simulation.fluid']) {
      yield* logErrors(
        runTickable(refs.fluidTickAccumulatorRef, services.fluidService.tick(), inputs.deltaTime, FLUID_TICK_INTERVAL_SECS),
        'Fluid system error',
      )
    }

    // FR-1.6 — block-break particles: integrate position/velocity/lifetime
    // and write the InstancedMesh's instanceMatrix exactly once per frame.
    if (debugFlags['particles.update']) {
      yield* logErrors(services.particleSystem.update(inputs.deltaTime), 'Particle system error')
    }
  })
