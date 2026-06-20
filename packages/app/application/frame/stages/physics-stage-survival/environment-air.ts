import { Effect, MutableRef } from 'effect'
import { DROWN_DAMAGE, DROWN_DAMAGE_INTERVAL_SECS } from '@ts-minecraft/entity/domain/environment-hazard.config'
import type { BlockType, Position } from '@ts-minecraft/core'
import { resolveAirState, resolveEffectiveMaxAirSecs } from './air-logic'
import { applyCadencedHazard } from './hazard-logic'
import { syncAirMeterFeedback } from './environment-feedback'
import { applyDamageAndPlayHurt } from './feedback'
import type { ApplyPlayerDamage } from './types'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import type { SurvivalMovementState } from './types'

export const applySurvivalAirEffects = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  refreshedPos: Position,
  movement: SurvivalMovementState,
  eyeBlock: BlockType | null,
  applyDamage: ApplyPlayerDamage,
) =>
  Effect.flatMap(services.equipmentService.getEquippedItem('HELMET'), (helmetOpt) => {
    const headSubmerged = !movement.inCreative && eyeBlock === 'WATER'
    const effectiveMaxAirSecs = resolveEffectiveMaxAirSecs(helmetOpt)
    const airState = resolveAirState(MutableRef.get(refs.airSecsRef), headSubmerged, inputs.deltaTime, effectiveMaxAirSecs)
    MutableRef.set(refs.airSecsRef, airState.airSecs)

    const drownEffect = applyCadencedHazard({
      active: headSubmerged && airState.airSecs <= 0,
      accumulatorRef: refs.drownDamageSecsRef,
      deltaTime: inputs.deltaTime,
      intervalSecs: DROWN_DAMAGE_INTERVAL_SECS,
      onTicks: (ticks) => applyDamageAndPlayHurt(services, refreshedPos, applyDamage, DROWN_DAMAGE * ticks),
    })

    if (MutableRef.get(refs.lastAirBubblesRef) === airState.airBubbles) {
      return drownEffect
    }

    return drownEffect.pipe(
      Effect.tap(() => {
        MutableRef.set(refs.lastAirBubblesRef, airState.airBubbles)
        return syncAirMeterFeedback(inputs.airElementOrNull, airState.airBubbles)
      }),
    )
  })
