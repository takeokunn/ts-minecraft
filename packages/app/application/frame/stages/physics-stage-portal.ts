import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { resolveNetherTravel, type Dimension } from '@ts-minecraft/world'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import { makeColumnReaderAt } from './physics-stage-utils'

const PORTAL_ACTIVATION_SECS = 4.0

const hasEntityType = (
  entities: ReadonlyArray<{ readonly type: string }>,
  type: string,
): boolean => {
  for (const entity of entities) {
    if (entity.type === type) {
      return true
    }
  }

  return false
}

export const applyNetherPortalTravel = (
  services: Pick<FrameHandlerServices, 'netherService' | 'chunkManagerService' | 'gameState' | 'blockService'>,
  refs: Pick<FrameStageRefs, 'portalSecsRef' | 'dirtyChunksRef' | 'finalPosRef'>,
  inputs: { readonly deltaTime: DeltaTimeSecs },
  playerPos: Position,
) =>
  Effect.gen(function* () {
    const py = Math.floor(playerPos.y)
    const columnBlockAt = yield* makeColumnReaderAt(services.chunkManagerService, playerPos)
    const inPortal = columnBlockAt(py) === 'NETHER_PORTAL'

    if (inPortal) {
      const currentSecs = yield* Ref.get(refs.portalSecsRef)
      const newSecs = currentSecs + inputs.deltaTime
      yield* Ref.set(refs.portalSecsRef, newSecs)
      if (newSecs >= PORTAL_ACTIVATION_SECS) {
        yield* Ref.set(refs.portalSecsRef, 0)
        const currentDim = yield* services.netherService.getDimension()
        const destDimPortals = yield* services.netherService.getPortals(
          currentDim === 'overworld' ? 'nether' : 'overworld',
        )
        const plan = resolveNetherTravel(currentDim, playerPos, destDimPortals)
        yield* services.netherService.setDimension(plan.toDimension)
        yield* services.chunkManagerService.setActiveDimension(plan.toDimension)
        yield* services.gameState.respawn(plan.destination)
        yield* Ref.set(refs.finalPosRef, plan.destination)
        const portalLayout = Option.getOrNull(plan.portalToCreate)
        if (portalLayout !== null) {
          for (const pos of portalLayout.frame) {
            yield* services.blockService.forceSetBlock(pos, 'OBSIDIAN').pipe(Effect.catchAll(() => Effect.void))
          }
          for (const pos of portalLayout.interior) {
            yield* services.blockService.forceSetBlock(pos, 'NETHER_PORTAL').pipe(Effect.catchAll(() => Effect.void))
          }
          yield* services.netherService.registerPortal(plan.destination, plan.toDimension)
          const affectedCoords = new Map<string, { readonly x: number; readonly z: number }>()
          const trackAffectedCoord = (pos: Position): void => {
            const coord = worldToChunkCoord(pos)
            const coordKey = `${coord.x},${coord.z}`
            if (!affectedCoords.has(coordKey)) {
              affectedCoords.set(coordKey, coord)
            }
          }
          for (const pos of portalLayout.frame) trackAffectedCoord(pos)
          for (const pos of portalLayout.interior) trackAffectedCoord(pos)
          for (const [coordKey, coord] of affectedCoords) {
            yield* services.chunkManagerService.getChunk(coord).pipe(
              Effect.tap((chunk) =>
                Effect.sync(() => {
                  MutableRef.set(
                    refs.dirtyChunksRef,
                    HashMap.set(MutableRef.get(refs.dirtyChunksRef), coordKey, { chunk, dirtyAABB: Option.none() }),
                  )
                }),
              ),
              Effect.catchAll(() => Effect.void),
            )
          }
        }
      }
    } else {
      yield* Ref.set(refs.portalSecsRef, 0)
    }
  })

export const applyEndPortalTravel = (
  services: Pick<FrameHandlerServices, 'netherService' | 'chunkManagerService' | 'gameState' | 'entityManager'>,
  refs: Pick<FrameStageRefs, 'finalPosRef'>,
  playerPos: Position,
) =>
  Effect.gen(function* () {
    const py = Math.floor(playerPos.y)
    const columnBlockAt = yield* makeColumnReaderAt(services.chunkManagerService, playerPos)
    const onEndPortal = columnBlockAt(py) === 'END_PORTAL'
    if (!onEndPortal) return
    const currentDim = yield* services.netherService.getDimension()
    const destDim: Dimension = currentDim === 'end' ? 'overworld' : 'end'
    const destPos = currentDim === 'end'
      ? { x: 0, y: 68, z: 0 }
      : { x: 0, y: 67, z: 0 }
    yield* services.netherService.setDimension(destDim)
    yield* services.chunkManagerService.setActiveDimension(destDim)
    yield* services.gameState.respawn(destPos)
    yield* Ref.set(refs.finalPosRef, destPos)
    if (destDim === 'end') {
      const existingEntities = yield* services.entityManager.getEntities()
      const hasDragon = hasEntityType(existingEntities, 'EnderDragon')
      if (!hasDragon) {
        yield* services.entityManager.addEntity('EnderDragon', { x: 0, y: 80, z: 20 })
          .pipe(Effect.catchAllCause(() => Effect.void))
      }
    }
  })
