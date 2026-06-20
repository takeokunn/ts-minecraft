import { Effect, MutableRef } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { handleBowFire } from '@ts-minecraft/app/frame/stages/interaction-bow-handler'
import { handleUnequipArmor } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/unequip-armor'
import type { InteractionStageSnapshot } from '@ts-minecraft/app/frame/stages/interaction-stage-snapshot'

export const runInteractionStagePreActions = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<
    FrameHandlerServices,
    | 'entityManager'
    | 'equipmentService'
    | 'inventoryService'
    | 'hotbarService'
    | 'soundManager'
    | 'droppedItemService'
    | 'droppedXpOrbService'
    | 'xpService'
  >,
  refs: Pick<FrameStageRefs, 'breakProgressRef' | 'isShieldBlockingRef' | 'bowChargeStartRef'>,
  context: {
    readonly snapshot: InteractionStageSnapshot
    readonly shouldResetBreakProgress: boolean
    readonly shouldResetShieldBlocking: boolean
    readonly shouldFireBowRelease: boolean
  },
): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    const { snapshot, shouldResetBreakProgress, shouldResetShieldBlocking, shouldFireBowRelease } = context

    if (snapshot.unequipArmor) {
      yield* handleUnequipArmor(services)
    }

    if (shouldResetBreakProgress) MutableRef.set(refs.breakProgressRef, null)
    if (shouldResetShieldBlocking) MutableRef.set(refs.isShieldBlockingRef, false)

    if (shouldFireBowRelease && snapshot.bowChargeStart !== null) {
      const entities = yield* services.entityManager.getEntities()
      yield* handleBowFire(deps, services, entities, {
        chargeStartSecs: snapshot.bowChargeStart,
        nowSecs: snapshot.totalTimeSecs,
      })
      MutableRef.set(refs.bowChargeStartRef, null)
    }
  })
