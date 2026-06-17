import { Effect, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import { getDepthStriderWaterDrag } from '@ts-minecraft/game'
import { enchantmentsOf } from '@ts-minecraft/inventory'
import { applyNetherPortalTravel, applyEndPortalTravel } from './physics-stage-portal'
import type { PhysicsStageDeps } from './physics-stage-types/deps'
import type { PhysicsStageInputs } from './physics-stage-types/inputs'
import type { PhysicsStageRefs } from './physics-stage-types/refs'
import type { PhysicsStageServices } from './physics-stage-types/services'
import { applyPhysicsHealthAndHud } from './physics-stage-health'

export const physicsStage = (
  deps: PhysicsStageDeps,
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
) =>
  Effect.gen(function* () {
    const bootsOpt = yield* services.equipmentService.getEquippedItem('BOOTS')
    let waterHorizontalDrag: number | undefined
    for (const enchantment of enchantmentsOf(bootsOpt)) {
      if (enchantment.type === 'DEPTH_STRIDER') {
        waterHorizontalDrag = getDepthStriderWaterDrag(enchantment.level)
        break
      }
    }

    yield* logErrors(
      services.gameState.update(inputs.deltaTime, waterHorizontalDrag),
      'Physics update error',
    )

    yield* Ref.set(refs.finalPosRef, inputs.initialPlayerPos)
    yield* applyPhysicsHealthAndHud(deps, services, refs, inputs, bootsOpt)

    const playerPos = yield* Ref.get(refs.finalPosRef)
    yield* logErrors(applyNetherPortalTravel(services, refs, inputs, playerPos), 'Portal travel error')
    yield* logErrors(applyEndPortalTravel(services, refs, playerPos), 'End portal travel error')

    return yield* Ref.get(refs.finalPosRef)
  })
