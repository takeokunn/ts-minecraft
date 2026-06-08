import { describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect } from 'vitest'
import { EquipmentService, EquipmentServiceLive } from '../application/equipment-service'
import { createStack } from '../domain/item-stack'
import type { InventoryItem } from '@ts-minecraft/core'

const testLayer = EquipmentServiceLive

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

  it.effect('serialize returns only equipped items', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip(mk('IRON_HELMET'))
      yield* svc.equip(mk('DIAMOND_CHESTPLATE'))
      const saved = yield* svc.serialize()
      expect(saved).toMatchObject({ HELMET: 'IRON_HELMET', CHESTPLATE: 'DIAMOND_CHESTPLATE' })
      expect('LEGGINGS' in saved).toBe(false)
      expect('BOOTS' in saved).toBe(false)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('deserialize restores equipment from saved state', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.deserialize({ HELMET: 'LEATHER_HELMET', BOOTS: 'IRON_BOOTS' })
      const helmet = yield* svc.getEquippedItem('HELMET')
      const boots = yield* svc.getEquippedItem('BOOTS')
      const chestplate = yield* svc.getEquippedItem('CHESTPLATE')
      expect(Option.getOrThrow(helmet).itemType).toBe('LEATHER_HELMET')
      expect(Option.getOrThrow(boots).itemType).toBe('IRON_BOOTS')
      expect(Option.isNone(chestplate)).toBe(true)
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

      const restored = yield* Effect.provide(
        Effect.gen(function* () {
          const svc = yield* EquipmentService
          yield* svc.deserialize(saved)
          return {
            all: yield* svc.getAll(),
            points: yield* svc.getTotalArmorPoints(),
          }
        }),
        EquipmentServiceLive,
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
