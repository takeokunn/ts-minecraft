import { Effect, Option } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/frame/types'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import type { FrameAnimalInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'

/**
 * Right-click shearing (FR R11): if the player is looking at a sheep while holding
 * SHEARS, shear it — harvests 1-3 wool into the inventory, starts the sheep's wool
 * regrowth timer, plays a cue. Returns true (handled) so the caller skips placement.
 * No-op (false) unless aimed at a woolly sheep with shears in hand. Successful
 * shearing consumes 1 durability from the selected SHEARS stack.
 */
export const handleShearAnimal = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: FrameAnimalInteractionServices,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const selected = yield* services.hotbarService.getSelectedBlockType()
    if (Option.getOrNull(selected) !== 'SHEARS') return false

    const entities = yield* services.entityManager.getEntities()
    const targetIdVal = Option.getOrNull(findAttackableEntity(entities, deps.camera, null))
    if (targetIdVal === null) return false

    // shearEntity is gated (sheep + woolly); only harvest on Some(count).
    const woolCount = Option.getOrNull(yield* services.entityManager.shearEntity(targetIdVal))
    if (woolCount === null) return false

    const entityPos = Option.getOrNull(yield* services.entityManager.getEntity(targetIdVal))?.position
    yield* services.inventoryService.addBlock('WOOL', woolCount).pipe(Effect.catchAll(() => Effect.void))
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    yield* services.inventoryService.damageSlot(selectedHotbarSlotIndex(selectedSlot), 1)
    if (entityPos !== undefined) {
      yield* services.soundManager.playEffect('blockBreak', { position: entityPos }).pipe(Effect.catchAll(() => Effect.void))
    }
    return true
  })
