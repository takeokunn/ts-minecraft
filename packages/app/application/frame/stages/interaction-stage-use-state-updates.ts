import type { InteractionStageIntent } from '@ts-minecraft/app/frame/stages/interaction-stage-intent'
import type { InteractionStageSnapshot } from '@ts-minecraft/app/frame/stages/interaction-stage-snapshot'

export type InteractionStageUseStateRefUpdates = {
  readonly isShieldBlocking: boolean
  readonly bowChargeStart: number | null
}

export const resolveInteractionStageUseStateRefUpdates = (
  snapshot: InteractionStageSnapshot,
  intent: InteractionStageIntent,
): InteractionStageUseStateRefUpdates => ({
  isShieldBlocking: intent.shouldBlockWithShield,
  bowChargeStart: intent.shouldStartBowCharge
    ? snapshot.totalTimeSecs
    : intent.shouldClearBowCharge
      ? null
      : snapshot.bowChargeStart,
})
