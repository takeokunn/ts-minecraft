import { Effect, MutableRef, Option } from 'effect'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { TargetBlockHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { handleCreativePickBlock } from '@ts-minecraft/app/frame/stages/interaction-creative-pick-handler'
import { handleRedstoneInput } from '@ts-minecraft/app/frame/stages/interaction-redstone-handler'
import type {
  InteractionStageIntent,
} from '@ts-minecraft/app/frame/stages/interaction-stage-intent'
import type { InteractionStageSnapshot } from '@ts-minecraft/app/frame/stages/interaction-stage-snapshot'
import { resolveInteractionStageUseStateRefUpdates } from '@ts-minecraft/app/frame/stages/interaction-stage-use-state-updates'

export const runInteractionStageUseStateActions = (
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'gameMode'
    | 'hotbarService'
    | 'inventoryService'
    | 'redstoneService'
  >,
  refs: Pick<FrameStageRefs, 'isShieldBlockingRef' | 'bowChargeStartRef'>,
  context: {
    readonly snapshot: InteractionStageSnapshot
    readonly intent: InteractionStageIntent
    readonly targetBlock: Option.Option<TargetBlockHit>
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const { snapshot, intent, targetBlock } = context

    if (snapshot.middleClick) {
      yield* handleCreativePickBlock(services, targetBlock)
    }

    if (intent.hasRedstoneInput) {
      yield* handleRedstoneInput(services, snapshot.redstoneFlags, targetBlock)
    }

    const updates = resolveInteractionStageUseStateRefUpdates(snapshot, intent)
    MutableRef.set(refs.isShieldBlockingRef, updates.isShieldBlocking)
    MutableRef.set(refs.bowChargeStartRef, updates.bowChargeStart)
  })
