import { Effect } from 'effect'
import type { DebugFeatureFlags } from '@ts-minecraft/app/debug-feature-flags'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { InteractionStageIntent } from '@ts-minecraft/app/frame/stages/interaction-stage-intent'
import type { InteractionStageSnapshot } from '@ts-minecraft/app/frame/stages/interaction-stage-snapshot'
import { runInteractionStageCombatActions } from '@ts-minecraft/app/frame/stages/interaction-stage-combat-actions'
import { runInteractionStagePreActions } from '@ts-minecraft/app/frame/stages/interaction-stage-pre-actions'
import { runInteractionStageUseActions } from '@ts-minecraft/app/frame/stages/interaction-stage-use-actions'

export const runInteractionStageActions = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'respawnPositionRef'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockHighlight'
    | 'blockService'
    | 'chunkManagerService'
    | 'entityManager'
    | 'equipmentService'
    | 'hotbarService'
    | 'inputService'
    | 'inventoryService'
    | 'inventoryRenderer'
    | 'soundManager'
    | 'cropGrowthService'
    | 'fluidService'
    | 'redstoneService'
    | 'chestService'
    | 'furnaceService'
    | 'timeService'
    | 'netherService'
    | 'xpService'
    | 'fishingService'
    | 'hungerService'
    | 'healthService'
    | 'gameState'
    | 'multiplayer'
    | 'gameMode'
    | 'particleSystem'
  >,
  refs: Pick<
    FrameStageRefs,
    | 'dirtyChunksRef'
    | 'totalTimeSecsRef'
    | 'lastPlayerAttackTimeRef'
    | 'attackSwingStateRef'
    | 'breakProgressRef'
    | 'bowChargeStartRef'
    | 'isShieldBlockingRef'
  >,
  context: {
    readonly snapshot: InteractionStageSnapshot
    readonly intent: InteractionStageIntent
    readonly debugFlags: DebugFeatureFlags
    readonly readPlayerUnderwater: () => Effect.Effect<boolean, never>
  },
): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    const { snapshot, intent, debugFlags } = context

    yield* runInteractionStagePreActions(deps, services, refs, {
      snapshot,
      shouldResetBreakProgress: intent.shouldResetBreakProgress,
      shouldResetShieldBlocking: intent.shouldResetShieldBlocking,
      shouldFireBowRelease: intent.shouldFireBowRelease,
    })

    if (!intent.canInteract) return

    const targetBlock = yield* services.blockHighlight.getTargetBlock()
    const targetHit = yield* services.blockHighlight.getTargetHit()

    yield* runInteractionStageCombatActions(deps, services, refs, {
      snapshot,
      debugFlags,
      readPlayerUnderwater: context.readPlayerUnderwater,
      targetBlock,
      targetHit,
    })

    yield* runInteractionStageUseActions(deps, services, refs, {
      snapshot,
      intent,
      targetBlock,
      targetHit,
    })
  })
