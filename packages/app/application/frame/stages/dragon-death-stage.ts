import { Effect, HashMap, MutableRef, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { DragonDeathEvent } from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-death'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { addExperienceWithMending } from '@ts-minecraft/app/application/frame/stages/xp-mending'

export type DragonDeathStageServices = Pick<
  FrameHandlerServices,
  'entityManager' | 'blockService' | 'chunkManagerService' | 'inventoryService' | 'equipmentService' | 'xpService'
>

export type DragonDeathStageRefs = Pick<FrameStageRefs, 'dirtyChunksRef'>

const markChunkDirty = (
  refs: DragonDeathStageRefs,
  services: Pick<DragonDeathStageServices, 'chunkManagerService'>,
  position: Position,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const coord = worldToChunkCoord(position)
    const coordKey = `${coord.x},${coord.z}`
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
  })

const applyDragonDeathEvent = (
  services: DragonDeathStageServices,
  refs: DragonDeathStageRefs,
  event: DragonDeathEvent,
): Effect.Effect<void, never> => {
  switch (event.type) {
    case 'DragonEggSpawn':
      return Effect.gen(function* () {
        yield* services.blockService.forceSetBlock(event.position, 'DRAGON_EGG').pipe(Effect.catchAll(() => Effect.void))
        yield* markChunkDirty(refs, services, event.position)
      })
    case 'ReturnPortalActivate':
      return Effect.gen(function* () {
        // Activate the full 3×3 exit portal the generator left as inert bedrock.
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const cell = { x: event.position.x + dx, y: event.position.y, z: event.position.z + dz }
            yield* services.blockService.forceSetBlock(cell, 'END_PORTAL').pipe(Effect.catchAll(() => Effect.void))
            yield* markChunkDirty(refs, services, cell)
          }
        }
      })
    case 'XPFountain':
      // XP fountain ticks every frame during the final phase; floor so partial XP/tick
      // accumulates without ever granting fractional experience.
      return addExperienceWithMending(Math.floor(event.amount), services)
    case 'Dying':
    case 'Exploding':
    case 'Complete':
      // Dying/Exploding are visual-only (no world/player effect to apply here). Complete's
      // dragon removal already happened inside the entity manager's death sequence, so there
      // is nothing for the app to do. Ending-credits seam: trigger here on Complete once a
      // credits presentation service exists (none today).
      return Effect.void
  }
}

// Drain the Ender Dragon death events emitted by the entity manager this tick and apply their
// world / player effects (egg + return-portal block placement, XP fountain). The entity layer
// emits these but never touches blocks or XP itself (DDD boundary).
export const dragonDeathStage = (
  services: DragonDeathStageServices,
  refs: DragonDeathStageRefs,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const events = yield* services.entityManager.drainDragonDeathEvents()
    for (const event of events) {
      yield* applyDragonDeathEvent(services, refs, event)
    }
  })
