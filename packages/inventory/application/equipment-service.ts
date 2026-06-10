import { Array as Arr, Effect, Option, Ref, identity } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import { isArmorItem, getArmorSlot, computeTotalArmorPoints, type ArmorSlot } from '../domain/armor'
import { type ItemStack, createStack, damageStack } from '../domain/item-stack'
import { getProtectionDamageReduction } from '../domain/enchantment'

type EquipmentSlots = {
  readonly HELMET: Option.Option<ItemStack>
  readonly CHESTPLATE: Option.Option<ItemStack>
  readonly LEGGINGS: Option.Option<ItemStack>
  readonly BOOTS: Option.Option<ItemStack>
}

const emptySlots = (): EquipmentSlots => ({
  HELMET: Option.none(),
  CHESTPLATE: Option.none(),
  LEGGINGS: Option.none(),
  BOOTS: Option.none(),
})

export class EquipmentService extends Effect.Service<EquipmentService>()(
  '@minecraft/application/EquipmentService',
  {
    effect: Ref.make(emptySlots()).pipe(Effect.map((slotsRef) => ({
      // Returns true if the item was armor and was equipped; false otherwise.
      equip: (stack: ItemStack): Effect.Effect<boolean, never> =>
        Option.match(getArmorSlot(stack.itemType), {
          onNone: () => Effect.succeed(false),
          onSome: (slot) =>
            Ref.update(slotsRef, (slots): EquipmentSlots => ({ ...slots, [slot]: Option.some(stack) })).pipe(
              Effect.as(true),
            ),
        }),

      // Removes and returns the stack in the given slot (none if already empty).
      unequipSlot: (slot: ArmorSlot): Effect.Effect<Option.Option<ItemStack>, never> =>
        Ref.modify(slotsRef, (slots): [Option.Option<ItemStack>, EquipmentSlots] => [
          slots[slot],
          { ...slots, [slot]: Option.none<ItemStack>() },
        ]),

      getEquippedItem: (slot: ArmorSlot): Effect.Effect<Option.Option<ItemStack>, never> =>
        Ref.get(slotsRef).pipe(Effect.map((slots) => slots[slot])),

      getAll: (): Effect.Effect<EquipmentSlots, never> =>
        Ref.get(slotsRef),

      // Total armor defense points — used by combat damage formula.
      getTotalArmorPoints: (): Effect.Effect<number, never> =>
        Ref.get(slotsRef).pipe(
          Effect.map((slots) => {
            const worn = Arr.filterMap(
              [slots.HELMET, slots.CHESTPLATE, slots.LEGGINGS, slots.BOOTS],
              identity,
            )
            return computeTotalArmorPoints(worn.map((s) => s.itemType))
          }),
        ),

      // Total damage reduction from Protection enchantments across all worn armor pieces.
      // Additive per piece, capped at 64% total (vanilla-like simplification).
      getTotalProtectionReduction: (): Effect.Effect<number, never> =>
        Ref.get(slotsRef).pipe(
          Effect.map((slots) => {
            const worn = Arr.filterMap(
              [slots.HELMET, slots.CHESTPLATE, slots.LEGGINGS, slots.BOOTS],
              identity,
            )
            const total = worn.reduce((acc, stack) => {
              const protection = (stack.enchantments ?? []).find((e) => e.type === 'PROTECTION')
              return acc + (protection ? getProtectionDamageReduction(protection.level) : 0)
            }, 0)
            return Math.min(total, 0.64)
          }),
        ),

      // Damage one armor piece by `amount` durability. If broken, unequips it.
      damageArmorSlot: (slot: ArmorSlot, amount = 1): Effect.Effect<void, never> =>
        Ref.modify(slotsRef, (slots): [Option.Option<ItemStack>, EquipmentSlots] => {
          const current = slots[slot]
          if (!Option.isSome(current)) return [Option.none(), slots]
          const next = damageStack(current.value, amount)
          return [current, { ...slots, [slot]: next }]
        }).pipe(Effect.asVoid),

      serialize: (): Effect.Effect<Partial<Record<ArmorSlot, InventoryItem>>, never> =>
        Ref.get(slotsRef).pipe(
          Effect.map((slots): Partial<Record<ArmorSlot, InventoryItem>> => {
            const entries = Object.entries(slots) as Array<[ArmorSlot, Option.Option<ItemStack>]>
            return entries.reduce<Partial<Record<ArmorSlot, InventoryItem>>>((result, [slot, stackOpt]) =>
              Option.match(stackOpt, {
                onNone: () => result,
                onSome: (s) => ({ ...result, [slot]: s.itemType }),
              }),
              {},
            )
          }),
        ),

      deserialize: (saved: Partial<Record<ArmorSlot, InventoryItem>>): Effect.Effect<void, never> =>
        Ref.update(slotsRef, (slots): EquipmentSlots => ({
          ...slots,
          ...Object.fromEntries(
            Object.entries(saved).map(([slot, item]) => [
              slot,
              Option.map(
                Option.fromNullable(item as InventoryItem),
                (i) => createStack(i, 1),
              ),
            ]),
          ),
        })),

      reset: (): Effect.Effect<void, never> =>
        Ref.set(slotsRef, emptySlots()),
    }))),
  },
) {}

export const EquipmentServiceLive = EquipmentService.Default

// Type guard: returns true if the item is armor (caller can skip food/place logic).
export { isArmorItem }
