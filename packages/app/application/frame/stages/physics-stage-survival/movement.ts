import { Effect, MutableRef } from 'effect'
import { HEALTH_TICK_INTERVAL_SECS } from '@ts-minecraft/app/frame-handler.config'
import { runTickable } from '@ts-minecraft/app/frame/frame-fixed-step'
import { KeyMappings, canSprintWithFood } from '@ts-minecraft/entity'
import type { Position } from '@ts-minecraft/core'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import type { PhysicsColumnReadError } from '../physics-stage-utils'
import {
  resolveIsSprinting,
  resolveJumpExhaustion,
  resolveMovementExhaustionRate,
  shouldApplyJumpExhaustion,
  shouldApplyMovementExhaustion,
} from './movement-logic'
import { applyHungerTicks } from './hunger'
import { handleFishingCatch } from './fishing'
import type { ApplyPlayerDamage, SurvivalMovementState } from './types'

export const applySurvivalMovementAndHunger = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  refreshedPos: Position,
  isGrounded: boolean,
  applyDamage: ApplyPlayerDamage,
): Effect.Effect<SurvivalMovementState, PhysicsColumnReadError> =>
  runTickable(refs.healthTickAccumulatorRef, services.healthService.tick(), inputs.deltaTime, HEALTH_TICK_INTERVAL_SECS).pipe(
    Effect.flatMap(() => services.gameMode.isCreative()),
    Effect.flatMap((inCreative) =>
      services.inputService.isKeyPressed(KeyMappings.SPRINT).pipe(
        Effect.flatMap((ctrlL) =>
          services.inputService.isKeyPressed(KeyMappings.SPRINT_ALT).pipe(
            Effect.flatMap((ctrlR) =>
              services.inputService.isKeyPressed(KeyMappings.MOVE_FORWARD).pipe(
                Effect.flatMap((forward) =>
                  services.inputService.isKeyPressed(KeyMappings.SNEAK).pipe(
                    Effect.flatMap((sneak) =>
                      services.hungerService.getHunger().pipe(
                        Effect.flatMap((hungerForSprintGate) =>
                          Effect.sync(() => {
                            const dx = refreshedPos.x - inputs.initialPlayerPos.x
                            const dz = refreshedPos.z - inputs.initialPlayerPos.z
                            const isSprinting = resolveIsSprinting(
                              ctrlL,
                              ctrlR,
                              forward,
                              sneak,
                              canSprintWithFood(hungerForSprintGate.foodLevel),
                            )
                            const isSneaking = sneak
                            const distanceMoved = Math.hypot(dx, dz)
                            const wasGrounded = MutableRef.get(refs.wasGroundedRef)
                            const movementExhaustion = shouldApplyMovementExhaustion(distanceMoved, isSneaking)
                              ? distanceMoved * resolveMovementExhaustionRate(isSprinting)
                              : null
                            const jumpExhaustion = shouldApplyJumpExhaustion(inCreative, wasGrounded, isGrounded)
                              ? resolveJumpExhaustion(isSprinting)
                              : null

                            MutableRef.set(refs.wasGroundedRef, isGrounded)

                            return {
                              inCreative,
                              isGrounded,
                              isSprinting,
                              isSneaking,
                              distanceMoved,
                              movementExhaustion,
                              jumpExhaustion,
                            }
                          }).pipe(
                            Effect.flatMap(
                              ({ inCreative, isGrounded, isSprinting, isSneaking, distanceMoved, movementExhaustion, jumpExhaustion }) =>
                                (movementExhaustion === null
                                  ? Effect.void
                                  : services.hungerService.addExhaustion(movementExhaustion)
                                ).pipe(
                                  Effect.flatMap(() =>
                                    jumpExhaustion === null
                                      ? Effect.void
                                      : services.hungerService.addExhaustion(jumpExhaustion),
                                  ),
                                  Effect.flatMap(() => applyHungerTicks(services, refs, inputs, refreshedPos, applyDamage)),
                                  Effect.flatMap(() => handleFishingCatch(services, refreshedPos, inputs.deltaTime)),
                                  Effect.as({ inCreative, isGrounded, isSprinting, isSneaking, distanceMoved }),
                                ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  )
