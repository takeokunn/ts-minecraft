import { Effect } from 'effect'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { handleHotbarInput, renderHotbarHud } from '@ts-minecraft/app/frame/stages/interaction-hotbar-handler'
import { runInteractionStageActions } from '@ts-minecraft/app/frame/stages/interaction-stage-actions'
import { resolveInteractionStageIntent } from '@ts-minecraft/app/frame/stages/interaction-stage-intent'
import { readInteractionStageSnapshot } from '@ts-minecraft/app/frame/stages/interaction-stage-snapshot'
import { getPlayerUnderwater } from '@ts-minecraft/app/frame/stages/interaction-stage-underwater'

export const runInteractionStageFrame = (
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
): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    const snapshot = yield* readInteractionStageSnapshot(deps, services, refs)
    if (snapshot.paused) return

    yield* handleHotbarInput(services)

    const intent = resolveInteractionStageIntent(snapshot)

    yield* runInteractionStageActions(deps, services, refs, {
      snapshot,
      intent,
      debugFlags: inputs.debugFlags,
      readPlayerUnderwater: () => getPlayerUnderwater(deps, services),
    })

    if (inputs.debugFlags['ui.hotbar']) {
      yield* renderHotbarHud(services)
    }
  })
