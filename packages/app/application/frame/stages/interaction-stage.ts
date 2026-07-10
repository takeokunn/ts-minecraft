import { Effect, MutableRef, Ref } from 'effect'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import { blockIdAt as blockIdAtCached } from '@ts-minecraft/game'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { runInteractionStageFrame } from '@ts-minecraft/app/frame/stages/interaction-stage-frame'
import { tickFoodConsumption } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/food-consumption'

export const interactionStage = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'scene' | 'gamePausedRef' | 'respawnPositionRef' | 'breakProgressElement'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockHighlight'
    | 'hotbarService'
    | 'hotbarRenderer'
    | 'inputService'
    | 'blockService'
    | 'chunkManagerService'
    | 'crosshair'
    | 'fluidService'
    | 'cropGrowthService'
    | 'soundManager'
    | 'entityManager'
    | 'parkedVehicleService'
    | 'inventoryService'
    | 'inventoryRenderer' | 'sleepOverlay'
    | 'chestService'
    | 'equipmentService'
    | 'xpService' | 'statisticsService'
    | 'fishingService'
    | 'redstoneService'
    | 'furnaceService'
    | 'netherService'
    | 'particleSystem'
    | 'hungerService'
    | 'healthService'
    | 'gameState'
    | 'timeService'
    | 'multiplayer'
    | 'gameMode'
    | 'droppedItemService'
    | 'droppedXpOrbService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef' | 'totalTimeSecsRef' | 'lastPlayerAttackTimeRef' | 'attackSwingStateRef' | 'breakProgressRef' | 'bowChargeStartRef' | 'isShieldBlockingRef' | 'hitStopFramesRef' | 'entityPhysicsChunkCacheRef' | 'lastEntityPhysicsChunkCoordRef'>,
  inputs: {
    readonly debugFlags: DebugFeatureFlags
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const debugFlags = inputs.debugFlags
    const isDead = yield* services.healthService.isDead()

    if (isDead) {
      MutableRef.set(refs.breakProgressRef, null)
      MutableRef.set(refs.bowChargeStartRef, null)
      MutableRef.set(refs.isShieldBlockingRef, false)
      yield* services.blockHighlight.setVisible(false)
      return
    }

    // Keep block targeting live for interactions while allowing the outline itself
    // to be toggled independently. The cached-chunk lookup routes targeting
    // through the voxel-DDA fast path (entity-physics 7x7 cache, radius 3 —
    // always covers the 5-block reach around the player).
    const targetingChunkCache = yield* Ref.get(refs.entityPhysicsChunkCacheRef)
    const targetingPlayerChunk = yield* Ref.get(refs.lastEntityPhysicsChunkCoordRef)
    const targetingBlockIdAt = Number.isFinite(targetingPlayerChunk.cx)
      ? (x: number, y: number, z: number) =>
          blockIdAtCached(x, y, z, targetingChunkCache, targetingPlayerChunk.cx, targetingPlayerChunk.cz, 3)
      : undefined
    // Chew ticker: finishes (or cancels) an in-progress food use after the
    // vanilla 1.61s hold.
    const rightHeld = yield* services.inputService.isMouseDown(2)
    yield* tickFoodConsumption(services, MutableRef.get(refs.totalTimeSecsRef), rightHeld)

    yield* services.blockHighlight.update(deps.camera, deps.scene, targetingBlockIdAt)
    // Only force-hide when the debug flag is off. Forcing visible=true here
    // overrode update()'s own decisions (fluid targets draw no outline), which
    // painted a wireframe around invisible water in front of a swimming player.
    if (!debugFlags['ui.blockHighlight']) {
      yield* services.blockHighlight.setVisible(false)
    }

    yield* logErrors(
      runInteractionStageFrame(deps, services, refs, inputs),
      'Block interaction error',
    )
  })
