import { Effect, Option, Ref } from 'effect'
import { resolveBlockCollisions } from '@ts-minecraft/game'
import type { Chunk } from '@ts-minecraft/world'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { MOB_HALF_HEIGHT, MOB_HALF_WIDTH, BREED_XP_REWARD } from '@ts-minecraft/entity'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { advanceFixedStep } from '@ts-minecraft/app/frame/frame-runtime-logic'
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
      const loadedChunksChanged = Option.isSome(loadedChunks) !== Option.isSome(lastLoadedChunks) ||
        (Option.isSome(loadedChunks) && Option.isSome(lastLoadedChunks) && loadedChunks.value !== lastLoadedChunks.value)
      let chunkCache = yield* Ref.get(refs.entityPhysicsChunkCacheRef)
      const chunkCoordChanged = lastChunkCoord.cx !== playerCx || lastChunkCoord.cz !== playerCz
      const hasMissingChunk = chunkCache.some((chunk) => chunk == null)

      if (chunkCoordChanged || loadedChunksChanged || hasMissingChunk) {
        const refreshAllChunks = chunkCoordChanged || loadedChunksChanged
        const nextChunkCache: Array<Chunk | null> = refreshAllChunks
          ? [
              null, null, null,
              null, null, null,
              null, null, null,
            ]
          : [...chunkCache]

        yield* Effect.forEach(
          ENTITY_PHYSICS_CHUNK_OFFSETS,
          ([dx, dz, index]) => {
            /* c8 ignore next 3 -- cache-hit path: requires 2nd frame at same chunk coord with partial cache populated */
            if (!refreshAllChunks && nextChunkCache[index] != null) {
              return Effect.void
            }

            return services.chunkManagerService.getChunk({
              x: playerCx + dx,
              z: playerCz + dz,
            }).pipe(
              Effect.match({
                onSuccess: (chunk) => { nextChunkCache[index] = chunk },
                onFailure: () => {},
              }),
            )
          },
          { concurrency: 'unbounded', discard: true },
        )

        chunkCache = nextChunkCache
        yield* Ref.set(refs.entityPhysicsChunkCacheRef, nextChunkCache)
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
        applyPhysics(inputs.deltaTime, (position: Position, velocity: { x: number; y: number; z: number }) =>
          resolveBlockCollisions(position, velocity, MOB_HALF_WIDTH, MOB_HALF_HEIGHT, isBlockSolid)
        ),
        'Entity physics error',
      )
    }

    yield* logErrors(
      // Sequential: both are synchronous reads; unbounded concurrency would
      // spawn fibers every frame for no parallelism gain.
      Effect.all([services.entityManager.getEntities(), services.entityManager.getStructureVersion()]).pipe(
        Effect.flatMap(([entitiesSnapshot, structureVersion]) =>
          Ref.get(refs.lastEntityStructureVersionRef).pipe(
            Effect.flatMap((lastStructureVersion) => {
              if (!mobsRenderEnabled) {
                /* c8 ignore start -- mobs-disabled render path; idempotent and hard to trigger in frame tests */
                return lastStructureVersion === RENDER_DISABLED_STRUCTURE_VERSION
                  ? Effect.void
                  : services.entityRenderer.syncEntities([], deps.scene).pipe(
                      Effect.andThen(Ref.set(refs.lastEntityStructureVersionRef, RENDER_DISABLED_STRUCTURE_VERSION)),
                    )
                /* c8 ignore end */
              }

              return (lastStructureVersion === structureVersion
                ? Effect.void
                : services.entityRenderer.syncEntities(entitiesSnapshot, deps.scene).pipe(
                    Effect.andThen(Ref.set(refs.lastEntityStructureVersionRef, structureVersion)),
                  )
              ).pipe(
                Effect.andThen(
                  services.entityRenderer.updateEntityTransforms(
                    entitiesSnapshot,
                    inputs.totalTimeSecs,
                    inputs.deltaTime,
                  ),
                ),
              )
            }),
          ),
        ),
      ),
      'Entity render error',
    )

    if (debugFlags['simulation.redstone']) {
      yield* logErrors(
        Ref.modify(refs.redstoneTickAccumulatorRef, (accumulated) => {
          const { ticks, remainder } = advanceFixedStep(accumulated, inputs.deltaTime, REDSTONE_TICK_INTERVAL_SECS)
          return [ticks, remainder]
        }).pipe(
          Effect.flatMap((ticksToRun) =>
            ticksToRun === 1
              ? services.redstoneService.tick().pipe(Effect.asVoid)
              : ticksToRun > 1
                ? Effect.repeatN(services.redstoneService.tick(), ticksToRun - 1).pipe(Effect.asVoid)
                : Effect.void,
          ),
        ),
        'Redstone system error',
      )
    }

    if (debugFlags['simulation.fluid']) {
      yield* logErrors(
        Ref.modify(refs.fluidTickAccumulatorRef, (accumulated) => {
          const { ticks, remainder } = advanceFixedStep(accumulated, inputs.deltaTime, FLUID_TICK_INTERVAL_SECS)
          return [ticks, remainder]
        }).pipe(
          Effect.flatMap((ticksToRun) =>
            ticksToRun === 1
              ? services.fluidService.tick().pipe(Effect.asVoid)
              : ticksToRun > 1
                ? Effect.repeatN(services.fluidService.tick(), ticksToRun - 1).pipe(Effect.asVoid)
                : Effect.void,
          ),
        ),
        'Fluid system error',
      )
    }

    // FR-1.6 — block-break particles: integrate position/velocity/lifetime
    // and write the InstancedMesh's instanceMatrix exactly once per frame.
    if (debugFlags['particles.update']) {
      yield* logErrors(services.particleSystem.update(inputs.deltaTime), 'Particle system error')
    }
  })
