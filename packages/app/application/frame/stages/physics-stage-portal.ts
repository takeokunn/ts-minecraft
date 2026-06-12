import { Effect, HashMap, Option, Ref } from 'effect'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { resolveNetherTravel, type Dimension } from '@ts-minecraft/world'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { makeColumnReaderAt } from './physics-stage-utils'

const PORTAL_ACTIVATION_SECS = 4.0

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
      const newSecs = yield* Ref.updateAndGet(refs.portalSecsRef, (s) => s + inputs.deltaTime)
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
          const allPositions = [...portalLayout.frame, ...portalLayout.interior]
          const affectedCoordKeys = Array.from(
            new Set(allPositions.map((pos) => `${Math.floor(pos.x / CHUNK_SIZE)},${Math.floor(pos.z / CHUNK_SIZE)}`)),
          )
          for (const coordKey of affectedCoordKeys) {
            const parts = coordKey.split(',')
            const cx = parseInt(parts[0]!, 10)
            const cz = parseInt(parts[1]!, 10)
            yield* Effect.gen(function* () {
              const chunk = yield* services.chunkManagerService.getChunk({ x: cx, z: cz })
              yield* Ref.update(refs.dirtyChunksRef, (map) =>
                HashMap.set(map, coordKey, { chunk, dirtyAABB: Option.none() }),
              )
            }).pipe(Effect.catchAll(() => Effect.void))
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
      const hasDragon = existingEntities.some((e) => e.type === 'EnderDragon')
      if (!hasDragon) {
        yield* services.entityManager.addEntity('EnderDragon', { x: 0, y: 80, z: 20 })
          .pipe(Effect.catchAllCause(() => Effect.void))
      }
    }
  })
