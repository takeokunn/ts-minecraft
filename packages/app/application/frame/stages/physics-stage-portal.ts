import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { resolveNetherTravel, type Dimension } from '@ts-minecraft/world'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import { makeColumnReaderAt } from './physics-stage-utils'
import { buildRespawnPosition } from '@ts-minecraft/app/main/session-world-loader'

export const PORTAL_ACTIVATION_SECS = 4.0
export const PORTAL_REENTRY_COOLDOWN_SECS = 4.0

const tickPortalCooldown = (cooldownSecs: number, deltaTime: DeltaTimeSecs): number =>
  Math.max(0, cooldownSecs - deltaTime)

export const collectAffectedChunkCoords = (
  positions: ReadonlyArray<Position>,
): ReadonlyMap<string, { readonly x: number; readonly z: number }> => {
  const coords = new Map<string, { readonly x: number; readonly z: number }>()
  for (const pos of positions) {
    const coord = worldToChunkCoord(pos)
    const key = `${coord.x},${coord.z}`
    if (!coords.has(key)) coords.set(key, coord)
  }
  return coords
}

export const applyNetherPortalTravel = (
  services: Pick<FrameHandlerServices, 'netherService' | 'chunkManagerService' | 'gameState' | 'blockService' | 'entityManager' | 'statisticsService' | 'dimensionFade'>,
  refs: Pick<FrameStageRefs, 'portalSecsRef' | 'portalCooldownSecsRef' | 'dirtyChunksRef' | 'finalPosRef'>,
  inputs: { readonly deltaTime: DeltaTimeSecs },
  playerPos: Position,
) =>
  Effect.gen(function* () {
    const cooldownSecs = yield* Ref.get(refs.portalCooldownSecsRef)
    if (cooldownSecs > 0) {
      yield* Ref.set(refs.portalCooldownSecsRef, tickPortalCooldown(cooldownSecs, inputs.deltaTime))
      yield* Ref.set(refs.portalSecsRef, 0)
      return
    }

    const py = Math.floor(playerPos.y)
    const columnBlockAt = yield* makeColumnReaderAt(services.chunkManagerService, playerPos)
    const inPortal = columnBlockAt(py) === 'NETHER_PORTAL'

    if (inPortal) {
      const currentSecs = yield* Ref.get(refs.portalSecsRef)
      const newSecs = currentSecs + inputs.deltaTime
      yield* Ref.set(refs.portalSecsRef, newSecs)
      if (newSecs >= PORTAL_ACTIVATION_SECS) {
        yield* Ref.set(refs.portalSecsRef, 0)
        // Mask the destination chunk-scene rebuild (a ~1s render stall) behind a fade.
        yield* services.dimensionFade.flash()
        const currentDim = yield* services.netherService.getDimension()
        const destDimPortals = yield* services.netherService.getPortals(
          currentDim === 'overworld' ? 'nether' : 'overworld',
        )
        const plan = resolveNetherTravel(currentDim, playerPos, destDimPortals)
        yield* services.netherService.setDimension(plan.toDimension)
        yield* services.chunkManagerService.setActiveDimension(plan.toDimension)
        yield* services.entityManager.setActiveDimension(plan.toDimension)
        yield* services.statisticsService.recordDimensionVisited(plan.toDimension)
        yield* services.gameState.respawn(plan.destination)
        yield* Ref.set(refs.finalPosRef, plan.destination)
        yield* Ref.set(refs.portalCooldownSecsRef, PORTAL_REENTRY_COOLDOWN_SECS)
        const portalLayout = Option.getOrNull(plan.portalToCreate)
        if (portalLayout !== null) {
          yield* Effect.forEach(
            portalLayout.frame,
            (pos) => services.blockService.forceSetBlock(pos, 'OBSIDIAN').pipe(Effect.catchAll(() => Effect.void)),
            { discard: true },
          )
          yield* Effect.forEach(
            portalLayout.interior,
            (pos) => services.blockService.forceSetBlock(pos, 'NETHER_PORTAL').pipe(Effect.catchAll(() => Effect.void)),
            { discard: true },
          )
          yield* services.netherService.registerPortal(plan.destination, plan.toDimension)
          const affectedCoords = collectAffectedChunkCoords([...portalLayout.frame, ...portalLayout.interior])
          yield* Effect.forEach(
            [...affectedCoords],
            ([coordKey, coord]) =>
              services.chunkManagerService.getChunk(coord).pipe(
                Effect.tap((chunk) =>
                  Effect.sync(() => {
                    MutableRef.set(
                      refs.dirtyChunksRef,
                      HashMap.set(MutableRef.get(refs.dirtyChunksRef), coordKey, { chunk, dirtyAABB: Option.none() }),
                    )
                  }),
                ),
                Effect.catchAll(() => Effect.void),
              ),
            { discard: true },
          )
        }
      }
    } else {
      yield* Ref.set(refs.portalSecsRef, 0)
    }
  })

export const applyEndPortalTravel = (
  services: Pick<FrameHandlerServices, 'netherService' | 'chunkManagerService' | 'gameState' | 'entityManager' | 'statisticsService' | 'dimensionFade'>,
  refs: Pick<FrameStageRefs, 'finalPosRef'>,
  playerPos: Position,
) =>
  Effect.gen(function* () {
    const py = Math.floor(playerPos.y)
    const columnBlockAt = yield* makeColumnReaderAt(services.chunkManagerService, playerPos)
    const onEndPortal = columnBlockAt(py) === 'END_PORTAL'
    if (!onEndPortal) return
    yield* services.dimensionFade.flash()
    const currentDim = yield* services.netherService.getDimension()
    const destDim: Dimension = currentDim === 'end' ? 'overworld' : 'end'
    yield* services.netherService.setDimension(destDim)
    yield* services.chunkManagerService.setActiveDimension(destDim)
    // Overworld return resolves the ACTUAL surface at world origin — a fixed
    // y=68 could drop the player onto (or into) whatever terrain generates there.
    const destPos = currentDim === 'end'
      ? yield* buildRespawnPosition({ x: 0, y: 68, z: 0 }, services.chunkManagerService).pipe(
          Effect.catchAllCause(() => Effect.succeed({ x: 0, y: 68, z: 0 })),
        )
      : { x: 0, y: 67, z: 0 }
    yield* services.entityManager.setActiveDimension(destDim)
    yield* services.statisticsService.recordDimensionVisited(destDim)
    yield* services.gameState.respawn(destPos)
    yield* Ref.set(refs.finalPosRef, destPos)
    if (destDim === 'end') {
      const existingEntities = yield* services.entityManager.getEntities()
      const hasDragon = existingEntities.some((e) => e.type === 'EnderDragon')
      if (!hasDragon) {
        yield* services.entityManager.addEntity('EnderDragon', { x: 0, y: 80, z: 20 })
          .pipe(Effect.catchAllCause(() => Effect.void))
      }
    }
  })
