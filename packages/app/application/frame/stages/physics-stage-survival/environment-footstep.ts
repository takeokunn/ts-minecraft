import { Effect, MutableRef } from 'effect'
import type { BlockType, Position } from '@ts-minecraft/core'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import { FOOTSTEP_SPRINT_INTERVAL_BLOCKS, FOOTSTEP_WALK_INTERVAL_BLOCKS, footstepEffectForBlock } from './footstep-sound-logic'
import { resolveFootstepState } from './footstep-logic'
import type { SurvivalMovementState } from './types'

export const applySurvivalFootstepEffects = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  refreshedPos: Position,
  movement: SurvivalMovementState,
  groundBlock: BlockType | null,
) => {
  const footstepEffect = footstepEffectForBlock(groundBlock)
  const intervalBlocks = movement.isSprinting ? FOOTSTEP_SPRINT_INTERVAL_BLOCKS : FOOTSTEP_WALK_INTERVAL_BLOCKS
  const footstepState = resolveFootstepState({
    currentAccumulator: MutableRef.get(refs.footstepDistanceAccumulatorRef),
    distanceMoved: movement.distanceMoved,
    isGrounded: movement.isGrounded,
    isSneaking: movement.isSneaking,
    hasFootstepEffect: footstepEffect !== null,
    intervalBlocks,
  })
  MutableRef.set(refs.footstepDistanceAccumulatorRef, footstepState.nextAccumulator)
  if (footstepState.shouldPlay && footstepEffect !== null) {
    return services.soundManager.playEffect(footstepEffect, {
      position: refreshedPos,
      gainScale: movement.isSprinting ? 1.15 : 1,
    })
  }

  return Effect.void
}
