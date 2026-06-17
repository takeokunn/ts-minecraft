import { Option } from 'effect'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import type { InteractionStageIntent } from '@ts-minecraft/app/frame/stages/interaction-stage-intent'
import type { InteractionStageSnapshot } from '@ts-minecraft/app/frame/stages/interaction-stage-snapshot'

export type InteractionStageUseTargetActionsContext = {
  readonly snapshot: InteractionStageSnapshot
  readonly intent: InteractionStageIntent
  readonly targetHit: Option.Option<TargetRayHit>
}

export const shouldRunInteractionStageUseTargetActions = (
  snapshot: InteractionStageSnapshot,
  intent: InteractionStageIntent,
): boolean => snapshot.rightClick && !intent.selectedIsBow
