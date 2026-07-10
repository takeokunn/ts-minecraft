import { Effect, Option, Ref } from 'effect'
import type { ItemStack } from '@ts-minecraft/inventory'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { PhysicsStageDeps } from './physics-stage-types/deps'
import type { PhysicsStageInputs } from './physics-stage-types/inputs'
import type { PhysicsStageRefs } from './physics-stage-types/refs'
import type { PhysicsStageServices } from './physics-stage-types/services'
import { tryApplyPlayerDamage } from './physics-stage-damage-helpers'
import type { ApplyPlayerDamage } from './physics-stage-survival/types'
import { resolveFallDamage } from './physics-stage-health/fall-damage'
import { applyHostileDamage } from './physics-stage-health/hostile-damage'
import { handleDeathOrSurvival } from './physics-stage-health/death'
import { updateHud } from './physics-stage-health/hud'

export const applyPhysicsHealthAndHud = (
  deps: PhysicsStageDeps,
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  bootsOpt: Option.Option<ItemStack>,
): Effect.Effect<void, never> =>
  logErrors(
  Effect.gen(function* () {
      const refreshedPos = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAllCause(() => Effect.succeed(inputs.initialPlayerPos)),
      )
      yield* Ref.set(refs.finalPosRef, refreshedPos)
      const armorPoints = yield* services.equipmentService.getTotalArmorPoints()
      const isSpectatorMode = yield* services.gameMode.isSpectator()
      const isCreativeMode = yield* services.gameMode.isCreative()
      // Forward the cause: survival effects (lava/fire/drowning/…) pass one and
      // the death screen renders it — a (amount)-only closure silently dropped
      // every cause and made all deaths read as the generic "You died."
      const applyDamage: ApplyPlayerDamage = (amount, cause) => tryApplyPlayerDamage(amount, isSpectatorMode, services, cause)

      const isGrounded = yield* services.gameState.isPlayerGrounded()
      const rawFallDamage = yield* services.healthService.processFallDamage(refreshedPos.y, isGrounded)
      const fallDamage = isCreativeMode ? 0 : resolveFallDamage(rawFallDamage, bootsOpt)
      const tookFallDamage = yield* applyDamage(fallDamage, { kind: 'fall' })
      if (tookFallDamage) {
        yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
      }

      yield* applyHostileDamage(services, refs, inputs, refreshedPos, armorPoints, applyDamage)
      yield* handleDeathOrSurvival(deps, services, refs, inputs, refreshedPos, isGrounded, applyDamage)
      yield* updateHud(services, refs, inputs, armorPoints)
    }),
    'Health error',
  )
