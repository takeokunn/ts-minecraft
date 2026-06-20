import { Effect, Option, Ref } from 'effect'
import { isArmorItem } from '../domain/armor'
import type { ArmorSlot } from '../domain/armor.config'
import { type ItemStack } from '../domain/item-stack'
import {
  type EquipmentSaveData,
  deserializeEquipmentSlots,
  emptyEquipmentSlots,
  serializeEquipmentSlots,
} from './equipment-persistence'
import {
  computeEquipmentTotalArmorPoints,
  computeEquipmentTotalBlastProtectionReduction,
  computeEquipmentTotalProtectionReduction,
  computeEquipmentTotalProjectileProtectionReduction,
  damageArmorSlot,
  equipArmorItem,
  equipArmorItemIfSlotEmpty,
  repairMendingItemsWithXP,
  unequipArmorSlot,
} from './equipment-service-state'
import type { EquipmentSlots } from './equipment-service-types'
export class EquipmentService extends Effect.Service<EquipmentService>()(
  '@minecraft/application/EquipmentService',
  {
    effect: Effect.gen(function* () {
      const slotsRef = yield* Ref.make(emptyEquipmentSlots())
      return {
        // Returns true if the item was armor and was equipped; false otherwise.
        equip: (stack: ItemStack): Effect.Effect<boolean, never> =>
          Ref.modify(slotsRef, (slots) => equipArmorItem(slots, stack)),

        // Shift-click armor equip: only fills an empty matching armor slot.
        equipIfSlotEmpty: (stack: ItemStack): Effect.Effect<boolean, never> =>
          Ref.modify(slotsRef, (slots) => equipArmorItemIfSlotEmpty(slots, stack)),

        // Removes and returns the stack in the given slot (none if already empty).
        unequipSlot: (slot: ArmorSlot): Effect.Effect<Option.Option<ItemStack>, never> =>
          Ref.modify(slotsRef, (slots) => unequipArmorSlot(slots, slot)),

        getEquippedItem: (slot: ArmorSlot): Effect.Effect<Option.Option<ItemStack>, never> =>
          Effect.gen(function* () {
            const slots = yield* Ref.get(slotsRef)
            return slots[slot]
          }),

        getAll: (): Effect.Effect<EquipmentSlots, never> =>
          Ref.get(slotsRef),

        // Total armor defense points — used by combat damage formula.
        getTotalArmorPoints: (): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const slots = yield* Ref.get(slotsRef)
            return computeEquipmentTotalArmorPoints(slots)
          }),

        // Total damage reduction from Protection enchantments across all worn armor pieces.
        // Additive per piece, capped at 64% total (vanilla-like simplification).
        getTotalProtectionReduction: (): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const slots = yield* Ref.get(slotsRef)
            return computeEquipmentTotalProtectionReduction(slots)
          }),

        // Total projectile damage reduction from Projectile Protection enchantments.
        getTotalProjectileProtectionReduction: (): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const slots = yield* Ref.get(slotsRef)
            return computeEquipmentTotalProjectileProtectionReduction(slots)
          }),

        // Total explosion damage reduction from Blast Protection enchantments.
        getTotalBlastProtectionReduction: (): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const slots = yield* Ref.get(slotsRef)
            return computeEquipmentTotalBlastProtectionReduction(slots)
          }),

        // Damage one armor piece by `amount` durability. If broken, unequips it.
        damageArmorSlot: (slot: ArmorSlot, amount = 1): Effect.Effect<void, never> =>
          Ref.update(slotsRef, (slots) => damageArmorSlot(slots, slot, amount)),

        repairMendingItemsWithXP: (amount: number): Effect.Effect<number, never> =>
          Ref.modify(slotsRef, (slots) => repairMendingItemsWithXP(slots, amount)),

        serialize: (): Effect.Effect<EquipmentSaveData, never> =>
          Effect.gen(function* () {
            const slots = yield* Ref.get(slotsRef)
            return serializeEquipmentSlots(slots)
          }),

        deserialize: (saved: EquipmentSaveData): Effect.Effect<void, never> =>
          Ref.set(slotsRef, deserializeEquipmentSlots(saved)),

        reset: (): Effect.Effect<void, never> =>
          Ref.set(slotsRef, emptyEquipmentSlots()),
      }
    }),
  },
) {}

// Type guard: returns true if the item is armor (caller can skip food/place logic).
export { isArmorItem }
