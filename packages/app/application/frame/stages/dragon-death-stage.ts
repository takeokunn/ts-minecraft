import { Effect, HashMap, MutableRef, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { DragonDeathEvent } from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-death'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import { PILLAR_POSITIONS, worldToBlockIndex } from '@ts-minecraft/world'
import { decodeBlockType } from '@ts-minecraft/core'
import { setLiveEndCrystalPositions } from '@ts-minecraft/entity'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { addExperienceWithMending } from '@ts-minecraft/app/application/frame/stages/xp-mending'

export type DragonDeathStageServices = Pick<
  FrameHandlerServices,
  'entityManager' | 'blockService' | 'chunkManagerService' | 'inventoryService' | 'equipmentService' | 'xpService'
>

export type DragonDeathStageRefs = Pick<FrameStageRefs, 'dirtyChunksRef'>

// Crystal-scan cadence (frames). Pillar tops are fixed world coordinates, so a
// 1 Hz block probe is enough for dragon healing to track crystal destruction.
const CRYSTAL_SCAN_INTERVAL_FRAMES = 60
let crystalScanCountdown = 0

const scanEndCrystals = (
  services: DragonDeathStageServices,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const positions: Array<{ x: number; y: number; z: number }> = []
    for (const pillar of PILLAR_POSITIONS) {
      const y = pillar.height + 1
      const block = yield* readBlockType(services, pillar.x, y, pillar.z)
      if (block === 'END_CRYSTAL') positions.push({ x: pillar.x, y, z: pillar.z })
    }
    yield* Effect.sync(() => setLiveEndCrystalPositions(positions))
  })

const readBlockType = (
  services: DragonDeathStageServices,
  x: number, y: number, z: number,
): Effect.Effect<string | null, never> =>
  Effect.gen(function* () {
    const { chunkCoord, flatIdx } = worldToBlockIndex({ x, y, z })
    const chunkOpt = yield* services.chunkManagerService.getChunk(chunkCoord).pipe(Effect.option)
    if (chunkOpt._tag === 'None') return null
    return Option.getOrNull(decodeBlockType(chunkOpt.value.blocks[flatIdx]))
  })

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
    // Once-per-second crystal probe keeps dragon healing in sync with the world.
    if (crystalScanCountdown <= 0) {
      crystalScanCountdown = CRYSTAL_SCAN_INTERVAL_FRAMES
      yield* scanEndCrystals(services)
    } else {
      crystalScanCountdown -= 1
    }

    const events = yield* services.entityManager.drainDragonDeathEvents()
    for (const event of events) {
      yield* applyDragonDeathEvent(services, refs, event)
    }
  })
