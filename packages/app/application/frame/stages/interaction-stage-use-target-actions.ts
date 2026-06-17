import { Effect } from 'effect'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
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
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: InteractionStageUseTargetActionsContext,
): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    const { snapshot, intent } = context

    if (!shouldRunInteractionStageUseTargetActions(snapshot, intent)) return

    yield* handleRightClickPriorityFromContext(deps, services, refs, context)
  })
