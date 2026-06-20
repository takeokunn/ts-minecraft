import { Effect, MutableRef } from 'effect'
import {
  CACTUS_DAMAGE,
  FIRE_DAMAGE,
  FIRE_DAMAGE_INTERVAL_SECS,
  LAVA_BURN_DURATION_SECS,
  LAVA_DAMAGE,
  LAVA_DAMAGE_INTERVAL_SECS,
  LIGHTNING_DAMAGE,
  LIGHTNING_DAMAGE_INTERVAL_SECS,
  SUFFOCATION_DAMAGE,
  SUFFOCATION_DAMAGE_INTERVAL_SECS,
  VOID_DAMAGE,
  VOID_DAMAGE_INTERVAL_SECS,
  VOID_DAMAGE_Y,
} from '@ts-minecraft/entity/domain/environment-hazard.config'
import { isSuffocatingBlock } from '@ts-minecraft/entity/domain/environment-hazard-resolution'
import type { BlockType, Position } from '@ts-minecraft/core'
import { resolveTotalFireProtectionReduction } from './fire-protection-logic'
import { applyCadencedHazard } from './hazard-logic'
import { applyDamageAndPlayHurt } from './feedback'
import type { ApplyPlayerDamage } from './types'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import type { SurvivalMovementState } from './types'

const applyFireProtectedDamage = (
  services: PhysicsStageServices,
  refreshedPos: Position,
  applyDamage: ApplyPlayerDamage,
  baseDamage: number,
) =>
  services.equipmentService.getAll().pipe(
    Effect.flatMap((armorSlots) => {
      const fireProtTotal = resolveTotalFireProtectionReduction(armorSlots)
      return applyDamageAndPlayHurt(services, refreshedPos, applyDamage, baseDamage * (1 - fireProtTotal))
    }),
  )

export const applySurvivalHazardEffects = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  refreshedPos: Position,
  movement: SurvivalMovementState,
  feetBlock: BlockType | null,
  eyeBlock: BlockType | null,
  touchingCactus: boolean,
  lightningDamageActive: boolean,
  applyDamage: ApplyPlayerDamage,
) => {
  const lavaContactActive = !movement.inCreative && feetBlock === 'LAVA'

  if (movement.inCreative) {
    MutableRef.set(refs.lavaBurnRemainingSecsRef, 0)
    MutableRef.set(refs.lavaBurnDamageSecsRef, 0)
  } else if (lavaContactActive) {
    MutableRef.set(refs.lavaBurnRemainingSecsRef, LAVA_BURN_DURATION_SECS)
    MutableRef.set(refs.lavaBurnDamageSecsRef, 0)
  } else {
    const burnRemaining = Math.max(0, MutableRef.get(refs.lavaBurnRemainingSecsRef) - inputs.deltaTime)
    MutableRef.set(refs.lavaBurnRemainingSecsRef, burnRemaining)
  }

  const burningAfterLava = !movement.inCreative && !lavaContactActive && MutableRef.get(refs.lavaBurnRemainingSecsRef) > 0

  return applyCadencedHazard({
    active: lavaContactActive,
    accumulatorRef: refs.lavaDamageSecsRef,
    deltaTime: inputs.deltaTime,
    intervalSecs: LAVA_DAMAGE_INTERVAL_SECS,
    onTicks: (ticks) => applyFireProtectedDamage(services, refreshedPos, applyDamage, LAVA_DAMAGE * ticks),
  }).pipe(
    Effect.flatMap(() =>
      applyCadencedHazard({
        active: burningAfterLava,
        accumulatorRef: refs.lavaBurnDamageSecsRef,
        deltaTime: inputs.deltaTime,
        intervalSecs: FIRE_DAMAGE_INTERVAL_SECS,
        onTicks: (ticks) => applyFireProtectedDamage(services, refreshedPos, applyDamage, FIRE_DAMAGE * ticks),
      }),
    ),
    Effect.flatMap(() =>
      !movement.inCreative && touchingCactus
        ? applyDamageAndPlayHurt(services, refreshedPos, applyDamage, CACTUS_DAMAGE).pipe(Effect.asVoid)
        : Effect.void,
    ),
    Effect.flatMap(() =>
      applyCadencedHazard({
        active: !movement.inCreative && lightningDamageActive,
        accumulatorRef: refs.lightningDamageSecsRef,
        deltaTime: inputs.deltaTime,
        intervalSecs: LIGHTNING_DAMAGE_INTERVAL_SECS,
        onTicks: (ticks) => applyDamageAndPlayHurt(services, refreshedPos, applyDamage, LIGHTNING_DAMAGE * ticks),
      }),
    ),
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
}
