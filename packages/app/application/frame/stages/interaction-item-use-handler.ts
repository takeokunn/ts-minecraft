import { Effect, Option, Schema } from 'effect'
import { SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import { HOTBAR_START, isArmorItem, getArmorSlot } from '@ts-minecraft/inventory'
import { getFoodProperties, MAX_FOOD_LEVEL, getMobDefinition } from '@ts-minecraft/entity'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import type { FrameHandlerDeps, FrameHandlerServices } from '@ts-minecraft/app/frame/types'

export const handleFoodConsumption = (
  services: Pick<FrameHandlerServices, 'hotbarService' | 'hungerService' | 'inventoryService' | 'equipmentService' | 'fishingService' | 'xpService'>,
): Effect.Effect<boolean, never> =>
  Effect.all(
    [services.hotbarService.getSelectedBlockType(), services.hotbarService.getSelectedSlot()],
    { concurrency: 'unbounded' },
  ).pipe(
    Effect.flatMap(([selected, selectedSlot]) =>
      Option.match(selected, {
        onNone: () => Effect.succeed(false),
        onSome: (item) => {
          if (!Schema.is(ItemTypeSchema)(item)) return Effect.succeed(false)

          if (item === 'FISHING_ROD') {
            return services.fishingService.isFishing().pipe(
              Effect.flatMap((alreadyFishing) =>
                alreadyFishing
                  ? services.fishingService.cancel().pipe(Effect.as(true))
                  : services.xpService.getXP().pipe(
                      Effect.flatMap((xp) => services.fishingService.cast(xp.totalXP + xp.xpIntoLevel)),
                      Effect.as(true),
                    ),
              ),
            )
          }

          if (isArmorItem(item)) {
            const slotIndex = SlotIndex.make(HOTBAR_START + selectedSlot)
            return services.inventoryService.getSlot(slotIndex).pipe(
              Effect.flatMap((stackOpt) =>
                Option.match(stackOpt, {
                  onNone: () => Effect.succeed(false),
                  onSome: (stack) =>
                    Option.match(getArmorSlot(stack.itemType), {
                      onNone: () => Effect.succeed(false),
                      onSome: (slot) =>
                        services.equipmentService.getEquippedItem(slot).pipe(
                          Effect.flatMap((displaced) =>
                            services.inventoryService
                              .removeBlock(item, 1, slotIndex)
                              .pipe(
                                Effect.andThen(services.equipmentService.equip(stack)),
                                // Swap: return displaced piece to inventory
                                Effect.andThen(
                                  Option.match(displaced, {
                                    onNone: () => Effect.void,
                                    onSome: (old) =>
                                      services.inventoryService.addBlock(old.itemType, 1).pipe(Effect.asVoid),
                                  }),
                                ),
                                Effect.as(true),
                                Effect.catchAll(() => Effect.succeed(false)),
                              ),
                          ),
                        ),
                    }),
                }),
              ),
            )
          }

          return Option.match(getFoodProperties(item), {
            onNone: () => Effect.succeed(false),
            onSome: (food) =>
              services.hungerService.getHunger().pipe(
                Effect.flatMap((hunger) =>
                  hunger.foodLevel >= MAX_FOOD_LEVEL
                    ? Effect.succeed(false)
                    : services.inventoryService
                        .removeBlock(item, 1, SlotIndex.make(HOTBAR_START + selectedSlot))
                        .pipe(
                          Effect.andThen(services.hungerService.eat(food.foodLevel, food.saturationModifier)),
                          Effect.as(true),
                          Effect.catchAll(() => Effect.succeed(false)),
                        ),
                ),
              ),
          })
        },
      }),
    ),
  )

/**
 * Right-click shearing (FR R11): if the player is looking at a sheep while holding
 * SHEARS, shear it — harvests 1-3 wool into the inventory, starts the sheep's wool
 * regrowth timer, plays a cue. Returns true (handled) so the caller skips placement.
 * No-op (false) unless aimed at a woolly sheep with shears in hand. Shears are not
 * consumed (no durability on SHEARS in this build).
 */
export const handleShearAnimal = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<FrameHandlerServices, 'entityManager' | 'hotbarService' | 'inventoryService' | 'soundManager'>,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const selected = yield* services.hotbarService.getSelectedBlockType()
    if (Option.isNone(selected) || selected.value !== 'SHEARS') return false

    const entities = yield* services.entityManager.getEntities()
    const targetId = findAttackableEntity(entities, deps.camera, Option.none())
    if (Option.isNone(targetId)) return false

    // shearEntity is gated (sheep + woolly); only harvest on Some(count).
    const woolOpt = yield* services.entityManager.shearEntity(targetId.value)
    if (Option.isNone(woolOpt)) return false

    const entityOpt = yield* services.entityManager.getEntity(targetId.value)
    yield* services.inventoryService.addBlock('WOOL', woolOpt.value).pipe(Effect.catchAll(() => Effect.void))
    yield* Option.match(entityOpt, {
      onNone: () => Effect.void,
      onSome: (target) =>
        services.soundManager.playEffect('blockBreak', { position: target.position }).pipe(Effect.catchAll(() => Effect.void)),
    })
    return true
  })

export const handleUnequipArmor = (
  services: Pick<FrameHandlerServices, 'equipmentService' | 'inventoryService'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const slots = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'] as const
    for (const slot of slots) {
      const removed = yield* services.equipmentService.unequipSlot(slot)
      yield* Option.match(removed, {
        onNone: () => Effect.void,
        onSome: (stack) =>
          services.inventoryService
            .addBlock(stack.itemType, 1)
            .pipe(Effect.catchAll(() => services.equipmentService.equip(stack).pipe(Effect.asVoid))),
      })
      if (Option.isSome(removed)) return
    }
  })

/**
 * Right-click feeding (FR R6c-3): if the player is looking at a breedable animal
 * while holding that animal's breeding item, feed it — enters love mode, consumes
 * one item, plays a cue. Returns true (consumed) so the caller skips placement.
 * No-op (false) when not aimed at a willing adult of the right species.
 */
export const handleFeedAnimal = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<FrameHandlerServices, 'entityManager' | 'hotbarService' | 'inventoryService' | 'soundManager'>,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const selected = yield* services.hotbarService.getSelectedBlockType()
    if (Option.isNone(selected)) return false
    const heldItem = selected.value

    const entities = yield* services.entityManager.getEntities()
    const targetId = findAttackableEntity(entities, deps.camera, Option.none())
    if (Option.isNone(targetId)) return false

    const entityOpt = yield* services.entityManager.getEntity(targetId.value)
    if (Option.isNone(entityOpt)) return false
    const target = entityOpt.value

    // Held item must be THIS species' breeding item.
    if (getMobDefinition(target.type).breedingItem !== heldItem) return false

    // feedEntity is gated (adult, off cooldown, not already in love); only consume on success.
    const fed = yield* services.entityManager.feedEntity(targetId.value)
    if (!fed) return false

    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    yield* services.inventoryService
      .removeBlock(heldItem, 1, SlotIndex.make(HOTBAR_START + selectedSlot))
      .pipe(Effect.catchAll(() => Effect.void))
    yield* services.soundManager.playEffect('blockPlace', { position: target.position }).pipe(Effect.catchAll(() => Effect.void))
    return true
  })
