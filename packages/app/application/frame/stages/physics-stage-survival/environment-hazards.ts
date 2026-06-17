import { Effect } from 'effect'
import {
  isSuffocatingBlock,
  LAVA_DAMAGE,
  LAVA_DAMAGE_INTERVAL_SECS,
  SUFFOCATION_DAMAGE,
  SUFFOCATION_DAMAGE_INTERVAL_SECS,
  VOID_DAMAGE,
  VOID_DAMAGE_INTERVAL_SECS,
  VOID_DAMAGE_Y,
} from '@ts-minecraft/entity'
import type { BlockType, Position } from '@ts-minecraft/core'
import { resolveTotalFireProtectionReduction } from './fire-protection-logic'
import { applyCadencedHazard } from './hazard-logic'
import { applyDamageAndPlayHurt } from './feedback'
import type { ApplyPlayerDamage } from './types'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import type { SurvivalMovementState } from './types'

export const applySurvivalHazardEffects = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  refreshedPos: Position,
  movement: SurvivalMovementState,
  feetBlock: BlockType | null,
  eyeBlock: BlockType | null,
  applyDamage: ApplyPlayerDamage,
) =>
  applyCadencedHazard({
    active: !movement.inCreative && feetBlock === 'LAVA',
    accumulatorRef: refs.lavaDamageSecsRef,
    deltaTime: inputs.deltaTime,
    intervalSecs: LAVA_DAMAGE_INTERVAL_SECS,
    onTicks: (ticks) =>
      services.equipmentService.getAll().pipe(
        Effect.flatMap((armorSlots) => {
          const fireProtTotal = resolveTotalFireProtectionReduction(armorSlots)
          return applyDamageAndPlayHurt(services, refreshedPos, applyDamage, LAVA_DAMAGE * ticks * (1 - fireProtTotal))
        }),
      ),
  }).pipe(
    Effect.flatMap(() =>
      applyCadencedHazard({
        active: !movement.inCreative && isSuffocatingBlock(eyeBlock),
        accumulatorRef: refs.suffocationDamageSecsRef,
        deltaTime: inputs.deltaTime,
        intervalSecs: SUFFOCATION_DAMAGE_INTERVAL_SECS,
        onTicks: (ticks) => applyDamageAndPlayHurt(services, refreshedPos, applyDamage, SUFFOCATION_DAMAGE * ticks),
      }),
    ),
    Effect.flatMap(() =>
      applyCadencedHazard({
        active: !movement.inCreative && refreshedPos.y < VOID_DAMAGE_Y,
        accumulatorRef: refs.voidDamageSecsRef,
        deltaTime: inputs.deltaTime,
        intervalSecs: VOID_DAMAGE_INTERVAL_SECS,
        onTicks: (ticks) => applyDamageAndPlayHurt(services, refreshedPos, applyDamage, VOID_DAMAGE * ticks),
      }),
    ),
  )
