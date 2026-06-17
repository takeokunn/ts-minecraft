import { describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect } from 'vitest'
import { EquipmentService } from '../application/equipment-service'
import { ItemStack, createStack } from '../domain/item-stack'
import type { InventoryItem } from '@ts-minecraft/core'

const testLayer = EquipmentService.Default

// Helper: build a plain ItemStack for test use.
const mk = (itemType: InventoryItem) => createStack(itemType, 1)

describe('application/equipment-service', () => {
  it.effect('starts with all slots empty', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const all = yield* svc.getAll()
      expect(Option.isNone(all.HELMET)).toBe(true)
      expect(Option.isNone(all.CHESTPLATE)).toBe(true)
      expect(Option.isNone(all.LEGGINGS)).toBe(true)
      expect(Option.isNone(all.BOOTS)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('getTotalArmorPoints returns 0 when no armor is equipped', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const points = yield* svc.getTotalArmorPoints()
      expect(points).toBe(0)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('equip places a helmet in the HELMET slot and returns true', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const equipped = yield* svc.equip(mk('IRON_HELMET'))
      expect(equipped).toBe(true)
      const item = yield* svc.getEquippedItem('HELMET')
      expect(Option.getOrThrow(item).itemType).toBe('IRON_HELMET')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('equip returns false for non-armor items', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const equipped = yield* svc.equip(mk('IRON_SWORD'))
      expect(equipped).toBe(false)
      const item = yield* svc.getEquippedItem('HELMET')
      expect(Option.isNone(item)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('equip places each armor type in the correct slot', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip(mk('DIAMOND_HELMET'))
      yield* svc.equip(mk('IRON_CHESTPLATE'))
      yield* svc.equip(mk('LEATHER_LEGGINGS'))
      yield* svc.equip(mk('LEATHER_BOOTS'))
      const all = yield* svc.getAll()
      expect(Option.getOrThrow(all.HELMET).itemType).toBe('DIAMOND_HELMET')
      expect(Option.getOrThrow(all.CHESTPLATE).itemType).toBe('IRON_CHESTPLATE')
      expect(Option.getOrThrow(all.LEGGINGS).itemType).toBe('LEATHER_LEGGINGS')
      expect(Option.getOrThrow(all.BOOTS).itemType).toBe('LEATHER_BOOTS')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('getTotalArmorPoints reflects full iron armor (15 points)', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip(mk('IRON_HELMET'))
      yield* svc.equip(mk('IRON_CHESTPLATE'))
      yield* svc.equip(mk('IRON_LEGGINGS'))
      yield* svc.equip(mk('IRON_BOOTS'))
      const points = yield* svc.getTotalArmorPoints()
      expect(points).toBe(15)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('getTotalArmorPoints reflects full diamond armor (20 points)', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip(mk('DIAMOND_HELMET'))
      yield* svc.equip(mk('DIAMOND_CHESTPLATE'))
      yield* svc.equip(mk('DIAMOND_LEGGINGS'))
      yield* svc.equip(mk('DIAMOND_BOOTS'))
      const points = yield* svc.getTotalArmorPoints()
      expect(points).toBe(20)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('getTotalProtectionReduction reflects enchanted armor', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      // Protection IV on chestplate: 0.04 × 4 = 0.16 reduction
      const chestplate = { ...mk('IRON_CHESTPLATE'), enchantments: [{ type: 'PROTECTION' as const, level: 4 as const }] }
      yield* svc.equip(chestplate)
      const reduction = yield* svc.getTotalProtectionReduction()
      expect(reduction).toBeCloseTo(0.16)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('getTotalProtectionReduction ignores armor without matching enchantments', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip(mk('IRON_HELMET'))
      yield* svc.equip({
        ...mk('IRON_CHESTPLATE'),
        enchantments: [{ type: 'BLAST_PROTECTION' as const, level: 1 as const }],
      })

      const reduction = yield* svc.getTotalProtectionReduction()

      expect(reduction).toBe(0)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('getTotalProtectionReduction is capped at 0.64', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const prot4 = (item: InventoryItem) => ({
        ...mk(item),
        enchantments: [{ type: 'PROTECTION' as const, level: 4 as const }],
      })
      yield* svc.equip(prot4('DIAMOND_HELMET'))
      yield* svc.equip(prot4('DIAMOND_CHESTPLATE'))
      yield* svc.equip(prot4('DIAMOND_LEGGINGS'))
      yield* svc.equip(prot4('DIAMOND_BOOTS'))
      const reduction = yield* svc.getTotalProtectionReduction()
      // 4 pieces × 0.16 = 0.64, capped at 0.64
      expect(reduction).toBeCloseTo(0.64)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('getTotalProjectileProtectionReduction reflects enchanted armor', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const helmet = { ...mk('IRON_HELMET'), enchantments: [{ type: 'PROJECTILE_PROTECTION' as const, level: 4 as const }] }
      yield* svc.equip(helmet)
      const reduction = yield* svc.getTotalProjectileProtectionReduction()
      expect(reduction).toBeCloseTo(0.32)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('getTotalBlastProtectionReduction reflects enchanted armor and caps at 0.64', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const blast4 = (item: InventoryItem) => ({
        ...mk(item),
        enchantments: [{ type: 'BLAST_PROTECTION' as const, level: 4 as const }],
      })
      yield* svc.equip(blast4('DIAMOND_HELMET'))
      yield* svc.equip(blast4('DIAMOND_CHESTPLATE'))
      yield* svc.equip(blast4('DIAMOND_LEGGINGS'))
      yield* svc.equip(blast4('DIAMOND_BOOTS'))
      const reduction = yield* svc.getTotalBlastProtectionReduction()
      expect(reduction).toBeCloseTo(0.64)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('repairs MENDING armor with XP', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const helmet = new ItemStack({
        itemType: 'IRON_HELMET',
        count: 1,
        durability: 160,
        enchantments: [{ type: 'MENDING', level: 1 }],
      })
      yield* svc.equip(helmet)

      const remaining = yield* svc.repairMendingItemsWithXP(3)
      const repaired = Option.getOrThrow(yield* svc.getEquippedItem('HELMET'))

      expect(remaining).toBe(0)
      expect(repaired.durability).toBe(165)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('keeps an empty armor slot unchanged when durability damage is applied', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.damageArmorSlot('HELMET')

      const helmet = yield* svc.getEquippedItem('HELMET')
      expect(Option.isNone(helmet)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('reduces armor durability when an equipped item is damaged', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const helmet = new ItemStack({ itemType: 'IRON_HELMET', count: 1, durability: 10 })
      yield* svc.equip(helmet)

      yield* svc.damageArmorSlot('HELMET', 3)

      const damaged = Option.getOrThrow(yield* svc.getEquippedItem('HELMET'))
      expect(damaged.durability).toBe(7)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('unequips armor when durability damage breaks it', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const helmet = new ItemStack({ itemType: 'IRON_HELMET', count: 1, durability: 1 })
      yield* svc.equip(helmet)

      yield* svc.damageArmorSlot('HELMET', 1)

      const broken = yield* svc.getEquippedItem('HELMET')
      expect(Option.isNone(broken)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('returns non-positive XP unchanged when repairing MENDING armor', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService

      expect(yield* svc.repairMendingItemsWithXP(0)).toBe(0)
      expect(yield* svc.repairMendingItemsWithXP(-1)).toBe(-1)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('preserves fractional XP when no equipped armor can use MENDING repair', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const fullHelmet = mk('IRON_HELMET')
      yield* svc.equip(fullHelmet)

      const remaining = yield* svc.repairMendingItemsWithXP(2.5)
      const helmet = Option.getOrThrow(yield* svc.getEquippedItem('HELMET'))

      expect(remaining).toBe(2.5)
      expect(helmet.durability).toBe(fullHelmet.durability)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('skips empty slots and stops MENDING repair after XP is exhausted', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const chestplate = new ItemStack({
        itemType: 'IRON_CHESTPLATE',
        count: 1,
        durability: 237,
        enchantments: [{ type: 'MENDING', level: 1 }],
      })
      const boots = new ItemStack({
        itemType: 'IRON_BOOTS',
        count: 1,
        durability: 193,
        enchantments: [{ type: 'MENDING', level: 1 }],
      })
      yield* svc.equip(chestplate)
      yield* svc.equip(boots)

      const remaining = yield* svc.repairMendingItemsWithXP(1.5)

      const repairedChestplate = Option.getOrThrow(yield* svc.getEquippedItem('CHESTPLATE'))
      const untouchedBoots = Option.getOrThrow(yield* svc.getEquippedItem('BOOTS'))
      expect(remaining).toBe(0.5)
      expect(repairedChestplate.durability).toBe(239)
      expect(untouchedBoots.durability).toBe(193)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('unequipSlot removes and returns the item in a slot', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip(mk('IRON_CHESTPLATE'))
      const removed = yield* svc.unequipSlot('CHESTPLATE')
      expect(Option.getOrThrow(removed).itemType).toBe('IRON_CHESTPLATE')
      const after = yield* svc.getEquippedItem('CHESTPLATE')
      expect(Option.isNone(after)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('unequipSlot returns none when slot is already empty', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const removed = yield* svc.unequipSlot('HELMET')
      expect(Option.isNone(removed)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('serialize returns explicit nulls for empty equipment slots', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip(mk('IRON_HELMET'))
      yield* svc.equip(mk('DIAMOND_CHESTPLATE'))
      const saved = yield* svc.serialize()
      expect(saved).toEqual({
        HELMET: 'IRON_HELMET',
        CHESTPLATE: 'DIAMOND_CHESTPLATE',
        LEGGINGS: null,
        BOOTS: null,
      })
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('deserialize restores equipment from saved state', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.deserialize({
        HELMET: 'LEATHER_HELMET',
        CHESTPLATE: null,
        LEGGINGS: null,
        BOOTS: 'IRON_BOOTS',
      })
      const helmet = yield* svc.getEquippedItem('HELMET')
      const boots = yield* svc.getEquippedItem('BOOTS')
      const chestplate = yield* svc.getEquippedItem('CHESTPLATE')
      expect(Option.getOrThrow(helmet).itemType).toBe('LEATHER_HELMET')
      expect(Option.getOrThrow(boots).itemType).toBe('IRON_BOOTS')
      expect(Option.isNone(chestplate)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('deserialize clears slots when saved state uses nulls', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip(mk('DIAMOND_HELMET'))
      yield* svc.equip(mk('IRON_CHESTPLATE'))

      yield* svc.deserialize({
        HELMET: null,
        CHESTPLATE: null,
        LEGGINGS: null,
        BOOTS: 'IRON_BOOTS',
      })

      const all = yield* svc.getAll()
      expect(Option.isNone(all.HELMET)).toBe(true)
      expect(Option.isNone(all.CHESTPLATE)).toBe(true)
      expect(Option.isNone(all.LEGGINGS)).toBe(true)
      expect(Option.getOrThrow(all.BOOTS).itemType).toBe('IRON_BOOTS')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('round-trips equipment through serialize → deserialize', () =>
    Effect.gen(function* () {
      const original = yield* EquipmentService
      yield* original.equip(mk('DIAMOND_HELMET'))
      yield* original.equip(mk('IRON_CHESTPLATE'))
      yield* original.equip(mk('LEATHER_BOOTS'))
      const saved = yield* original.serialize()
      const originalPoints = yield* original.getTotalArmorPoints()
      expect(saved).toEqual({
        HELMET: 'DIAMOND_HELMET',
        CHESTPLATE: 'IRON_CHESTPLATE',
        LEGGINGS: null,
        BOOTS: 'LEATHER_BOOTS',
      })

      const restored = yield* Effect.provide(
        Effect.gen(function* () {
          const svc = yield* EquipmentService
          yield* svc.deserialize(saved)
          return {
            all: yield* svc.getAll(),
            points: yield* svc.getTotalArmorPoints(),
          }
        }),
        EquipmentService.Default,
      )

      expect(Option.getOrThrow(restored.all.HELMET).itemType).toBe('DIAMOND_HELMET')
      expect(Option.getOrThrow(restored.all.CHESTPLATE).itemType).toBe('IRON_CHESTPLATE')
      expect(Option.getOrThrow(restored.all.BOOTS).itemType).toBe('LEATHER_BOOTS')
      expect(Option.isNone(restored.all.LEGGINGS)).toBe(true)
      expect(restored.points).toBe(originalPoints)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('reset clears all slots', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip(mk('DIAMOND_HELMET'))
      yield* svc.equip(mk('DIAMOND_CHESTPLATE'))
      yield* svc.reset()
      const points = yield* svc.getTotalArmorPoints()
      expect(points).toBe(0)
      const all = yield* svc.getAll()
      expect(Option.isNone(all.HELMET)).toBe(true)
      expect(Option.isNone(all.CHESTPLATE)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )
})
