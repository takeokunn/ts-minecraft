import { Effect } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { handleRightClickPriorityFromContext } from '@ts-minecraft/app/frame/stages/interaction-right-click-handler'
import { shouldRunInteractionStageUseTargetActions, type InteractionStageUseTargetActionsContext } from '@ts-minecraft/app/frame/stages/interaction-stage-use-target-actions-helpers'

export const runInteractionStageUseTargetActions = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'respawnPositionRef'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'soundManager'
    | 'hotbarService'
    | 'chestService'
    | 'furnaceService'
    | 'timeService'
    | 'netherService'
    | 'inventoryService'
    | 'inventoryRenderer'
    | 'xpService'
    | 'multiplayer'
    | 'entityManager'
    | 'equipmentService'
    | 'fishingService'
    | 'hungerService'
    | 'healthService'
    | 'gameState'
    | 'cropGrowthService'
    | 'fluidService'
    | 'gameMode'
    | 'redstoneService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: InteractionStageUseTargetActionsContext,
): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    const { snapshot, intent } = context

    if (!shouldRunInteractionStageUseTargetActions(snapshot, intent)) return

    yield* handleRightClickPriorityFromContext(deps, services, refs, context)
  })
