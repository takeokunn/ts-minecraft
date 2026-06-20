import { Effect, Option } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import { getMobDefinition } from '@ts-minecraft/entity/domain/mob/mobs/get-mob-definition'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import type { FrameAnimalInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/animal'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'

/**
 * Right-click feeding (FR R6c-3): if the player is looking at a breedable animal
 * while holding that animal's breeding item, feed it — enters love mode, consumes
 * one item, plays a cue. Returns true (consumed) so the caller skips placement.
 * No-op (false) when not aimed at a willing adult of the right species.
 */
export const handleFeedAnimal = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: FrameAnimalInteractionServices,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const selected = yield* services.hotbarService.getSelectedBlockType()
    const heldItem = Option.getOrNull(selected)
    if (heldItem === null) return false

    const entities = yield* services.entityManager.getEntities()
    const targetIdVal = Option.getOrNull(findAttackableEntity(entities, deps.camera, null))
    if (targetIdVal === null) return false

    const target = Option.getOrNull(yield* services.entityManager.getEntity(targetIdVal))
    if (target === null) return false

    // Held item must be THIS species' breeding item.
    if (getMobDefinition(target.type).breedingItem !== heldItem) return false

    // feedEntity is gated (adult, off cooldown, not already in love); only consume on success.
    const fed = yield* services.entityManager.feedEntity(targetIdVal)
    if (!fed) return false

    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    yield* services.inventoryService
      .removeBlock(heldItem, 1, selectedHotbarSlotIndex(selectedSlot))
      .pipe(Effect.catchAll(() => Effect.void))
    yield* services.soundManager.playEffect('blockPlace', { position: target.position }).pipe(Effect.catchAll(() => Effect.void))
    return true
  })
