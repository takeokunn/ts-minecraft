import { Effect, Option } from 'effect'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { TargetBlockHit, TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { handleBlockBreakProgress } from '@ts-minecraft/app/frame/stages/interaction-break-handler'
import { handleLeftClick } from '@ts-minecraft/app/frame/stages/interaction-melee-handler'
import { hasAttackableTargetInCombatRange } from '@ts-minecraft/app/frame/stages/interaction-stage-combat-targeting'
import type { InteractionStageSnapshot } from '@ts-minecraft/app/frame/stages/interaction-stage-snapshot'

export const runInteractionStageCombatActions = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'soundManager'
    | 'entityManager'
    | 'inventoryService'
    | 'equipmentService'
    | 'hotbarService'
    | 'particleSystem'
    | 'gameState'
    | 'inputService'
    | 'xpService'
    | 'multiplayer'
    | 'cropGrowthService'
    | 'hungerService'
    | 'redstoneService'
    | 'droppedItemService'
    | 'droppedXpOrbService'
  >,
  refs: Pick<
    FrameStageRefs,
    'dirtyChunksRef' | 'totalTimeSecsRef' | 'lastPlayerAttackTimeRef' | 'attackSwingStateRef' | 'breakProgressRef'
  >,
  context: {
    readonly snapshot: InteractionStageSnapshot
    readonly debugFlags: DebugFeatureFlags
    readonly readPlayerUnderwater: () => Effect.Effect<boolean, never>
    readonly targetBlock: Option.Option<TargetBlockHit>
    readonly targetHit: Option.Option<TargetRayHit>
  },
): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    const { snapshot, debugFlags } = context
    const entitiesForTargeting =
      snapshot.leftClick || snapshot.mouseHeld ? yield* services.entityManager.getEntities() : null

    if (snapshot.leftClick && entitiesForTargeting !== null) {
      yield* handleLeftClick(deps, services, refs, {
        targetBlock: context.targetBlock,
        targetHit: context.targetHit,
        selectedHotbarItem: snapshot.selectedHotbarItem,
        debugFlags,
        entities: entitiesForTargeting,
      })
    }

    if (snapshot.mouseHeld && entitiesForTargeting !== null) {
      // Determine whether an entity is in attack range — entity attack takes priority over block mining.
      const targetHitDistance = Option.getOrNull(context.targetHit)?.distance ?? null
      const targetEntityPresent = hasAttackableTargetInCombatRange(
        entitiesForTargeting,
        deps.camera,
        targetHitDistance,
      )
      const underwater = yield* context.readPlayerUnderwater()
      yield* handleBlockBreakProgress(services, refs, {
        targetBlock: context.targetBlock,
        selectedHotbarItem: snapshot.selectedHotbarItem,
        targetEntityPresent,
        breakProgressElementOrNull: snapshot.breakProgressElementOrNull,
        creative: snapshot.isCreative,
        underwater,
        debugFlags,
      })
    }
  })
