// Stage 7: interactionStage — block highlight, then break/place/redstone interactions.
import { Effect } from 'effect'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { runInteractionStageFrame } from '@ts-minecraft/app/frame/stages/interaction-stage-frame'

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
    | 'fluidService'
    | 'cropGrowthService'
    | 'soundManager'
    | 'entityManager'
    | 'inventoryService'
    | 'inventoryRenderer'
    | 'chestService'
    | 'equipmentService'
    | 'xpService'
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
  refs: Pick<FrameStageRefs, 'dirtyChunksRef' | 'totalTimeSecsRef' | 'lastPlayerAttackTimeRef' | 'attackSwingStateRef' | 'breakProgressRef' | 'bowChargeStartRef' | 'isShieldBlockingRef'>,
  inputs: {
    readonly debugFlags: DebugFeatureFlags
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const debugFlags = inputs.debugFlags

    // Keep block targeting live for interactions while allowing the outline itself
    // to be toggled independently.
    yield* services.blockHighlight.update(deps.camera, deps.scene)
    yield* services.blockHighlight.setVisible(debugFlags['ui.blockHighlight'])

    // Handle block interaction (break/place) and hotbar (suppressed when paused)
    yield* logErrors(
      runInteractionStageFrame(deps, services, refs, inputs),
      'Block interaction error',
    )
  })
