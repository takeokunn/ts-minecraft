import { Effect, Option, Schema } from 'effect'
import { SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import type { InventoryItem } from '@ts-minecraft/core'
import { HOTBAR_START, isArmorItem, getArmorSlot, enchantmentsOf } from '@ts-minecraft/inventory'
import { getFoodProperties, MAX_FOOD_LEVEL, getMobDefinition } from '@ts-minecraft/entity'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import type { FrameHandlerDeps, FrameHandlerServices } from '@ts-minecraft/app/frame/types'

// ─── Fishing rod ─────────────────────────────────────────────────────────────

const handleFishingRodActivation = (
  services: Pick<FrameHandlerServices, 'fishingService' | 'xpService' | 'inventoryService'>,
  selectedSlot: number,
): Effect.Effect<boolean, never> =>
  services.fishingService.isFishing().pipe(
    Effect.flatMap((alreadyFishing) => {
      if (alreadyFishing) return services.fishingService.cancel().pipe(Effect.as(true))
      return Effect.all(
        [services.xpService.getXP(), services.inventoryService.getSlot(SlotIndex.make(HOTBAR_START + selectedSlot))],
        { concurrency: 'unbounded' },
      ).pipe(
        Effect.flatMap(([xp, rodStack]) => {
          const enchantments = enchantmentsOf(rodStack)
          const lure = enchantments.find((e) => e.type === 'LURE')
          const luck = enchantments.find((e) => e.type === 'LUCK_OF_THE_SEA')
          return services.fishingService.cast(
            xp.totalXP + xp.xpIntoLevel,
            lure?.level ?? 0,
            luck?.level ?? 0,
          )
        }),
        Effect.as(true),
      )
    }),
  )

// ─── Armor equip ─────────────────────────────────────────────────────────────

const handleArmorEquipFromHotbar = (
  services: Pick<FrameHandlerServices, 'inventoryService' | 'equipmentService'>,
  selectedSlot: number,
  item: InventoryItem,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const slotIndex = SlotIndex.make(HOTBAR_START + selectedSlot)
    const stack = Option.getOrNull(yield* services.inventoryService.getSlot(slotIndex))
    if (stack === null) return false
    const armorSlot = Option.getOrNull(getArmorSlot(stack.itemType))
    if (armorSlot === null) return false
    const displaced = Option.getOrNull(yield* services.equipmentService.getEquippedItem(armorSlot))
    yield* services.inventoryService
      .removeBlock(item, 1, slotIndex)
      .pipe(
        Effect.andThen(services.equipmentService.equip(stack)),
        Effect.andThen(
          displaced !== null
            ? services.inventoryService.addBlock(displaced.itemType, 1).pipe(Effect.asVoid)
            : Effect.void,
        ),
        Effect.catchAll(() => Effect.void),
      )
    return true
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

// ─── Food consumption ─────────────────────────────────────────────────────────

export const handleFoodConsumption = (
  services: Pick<FrameHandlerServices, 'hotbarService' | 'hungerService' | 'inventoryService' | 'equipmentService' | 'fishingService' | 'xpService' | 'healthService'>,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const [selected, selectedSlot] = yield* Effect.all(
      [services.hotbarService.getSelectedBlockType(), services.hotbarService.getSelectedSlot()],
      { concurrency: 'unbounded' },
    )
    const item = Option.getOrNull(selected)
    if (item === null) return false
    if (!Schema.is(ItemTypeSchema)(item)) return false

    if (item === 'FISHING_ROD') return yield* handleFishingRodActivation(services, selectedSlot)
    if (isArmorItem(item)) return yield* handleArmorEquipFromHotbar(services, selectedSlot, item)

    const food = Option.getOrNull(getFoodProperties(item))
    if (food === null) return false
    const hunger = yield* services.hungerService.getHunger()
    if (hunger.foodLevel >= MAX_FOOD_LEVEL) return false

    yield* services.inventoryService
      .removeBlock(item, 1, SlotIndex.make(HOTBAR_START + selectedSlot))
      .pipe(
        Effect.andThen(services.hungerService.eat(food.foodLevel, food.saturationModifier)),
        Effect.andThen(
          item === 'GOLDEN_APPLE'
            ? services.healthService.heal(4)
            : Effect.void,
        ),
        Effect.catchAll(() => Effect.void),
      )
    return true
  })

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
    if (!Option.exists(selected, (s) => s === 'SHEARS')) return false

    const entities = yield* services.entityManager.getEntities()
    const targetIdVal = Option.getOrNull(findAttackableEntity(entities, deps.camera, Option.none()))
    if (targetIdVal === null) return false

    // shearEntity is gated (sheep + woolly); only harvest on Some(count).
    const woolCount = Option.getOrNull(yield* services.entityManager.shearEntity(targetIdVal))
    if (woolCount === null) return false

    const entityPos = Option.getOrNull(yield* services.entityManager.getEntity(targetIdVal))?.position
    yield* services.inventoryService.addBlock('WOOL', woolCount).pipe(Effect.catchAll(() => Effect.void))
    if (entityPos !== undefined) {
      yield* services.soundManager.playEffect('blockBreak', { position: entityPos }).pipe(Effect.catchAll(() => Effect.void))
    }
    return true
  })

export const handleUnequipArmor = (
  services: Pick<FrameHandlerServices, 'equipmentService' | 'inventoryService'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const slots = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'] as const
    for (const slot of slots) {
      const removed = Option.getOrNull(yield* services.equipmentService.unequipSlot(slot))
      if (removed !== null) {
        yield* services.inventoryService
          .addBlock(removed.itemType, 1)
          .pipe(Effect.catchAll(() => services.equipmentService.equip(removed).pipe(Effect.asVoid)))
        return
      }
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
    const heldItem = Option.getOrNull(selected)
    if (heldItem === null) return false

    const entities = yield* services.entityManager.getEntities()
    const targetIdVal = Option.getOrNull(findAttackableEntity(entities, deps.camera, Option.none()))
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
      .removeBlock(heldItem, 1, SlotIndex.make(HOTBAR_START + selectedSlot))
      .pipe(Effect.catchAll(() => Effect.void))
    yield* services.soundManager.playEffect('blockPlace', { position: target.position }).pipe(Effect.catchAll(() => Effect.void))
    return true
  })
