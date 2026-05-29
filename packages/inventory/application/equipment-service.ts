import { Array as Arr, Effect, Option, Ref } from 'effect'
import type { InventoryItem } from '@ts-minecraft/kernel'
import { isArmorItem, getArmorSlot, computeTotalArmorPoints, type ArmorSlot } from '../domain/armor'

type EquipmentSlots = {
  readonly HELMET: Option.Option<InventoryItem>
  readonly CHESTPLATE: Option.Option<InventoryItem>
  readonly LEGGINGS: Option.Option<InventoryItem>
  readonly BOOTS: Option.Option<InventoryItem>
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
      equip: (item: InventoryItem): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const slotOpt = getArmorSlot(item)
          if (Option.isNone(slotOpt)) return false
          const slot = slotOpt.value
          yield* Ref.update(slotsRef, (slots): EquipmentSlots => ({ ...slots, [slot]: Option.some(item) }))
          return true
        }),

      // Removes and returns the item in the given slot (none if already empty).
      unequipSlot: (slot: ArmorSlot): Effect.Effect<Option.Option<InventoryItem>, never> =>
        Ref.modify(slotsRef, (slots): [Option.Option<InventoryItem>, EquipmentSlots] => [
          slots[slot],
          { ...slots, [slot]: Option.none<InventoryItem>() },
        ]),

      getEquippedItem: (slot: ArmorSlot): Effect.Effect<Option.Option<InventoryItem>, never> =>
        Ref.get(slotsRef).pipe(Effect.map((slots) => slots[slot])),

      getAll: (): Effect.Effect<EquipmentSlots, never> =>
        Ref.get(slotsRef),

      // Total armor defense points — used by combat damage formula.
      getTotalArmorPoints: (): Effect.Effect<number, never> =>
        Ref.get(slotsRef).pipe(
          Effect.map((slots) => {
            const worn = Arr.filter(
              [slots.HELMET, slots.CHESTPLATE, slots.LEGGINGS, slots.BOOTS],
              Option.isSome,
            ).map((s) => s.value)
            return computeTotalArmorPoints(worn)
          }),
        ),

      serialize: (): Effect.Effect<Partial<Record<ArmorSlot, InventoryItem>>, never> =>
        Ref.get(slotsRef).pipe(
          Effect.map((slots): Partial<Record<ArmorSlot, InventoryItem>> => {
            const result: Partial<Record<ArmorSlot, InventoryItem>> = {}
            const entries = Object.entries(slots) as Array<[ArmorSlot, Option.Option<InventoryItem>]>
            for (const [slot, item] of entries) {
              if (Option.isSome(item)) result[slot] = item.value
            }
            return result
          }),
        ),

      deserialize: (saved: Partial<Record<ArmorSlot, InventoryItem>>): Effect.Effect<void, never> =>
        Ref.update(slotsRef, (slots): EquipmentSlots => ({
          ...slots,
          ...Object.fromEntries(
            Object.entries(saved).map(([slot, item]) => [slot, Option.fromNullable(item as InventoryItem)]),
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
