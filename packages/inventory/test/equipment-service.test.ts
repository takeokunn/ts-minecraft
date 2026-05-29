import { describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect } from 'vitest'
import { EquipmentService, EquipmentServiceLive } from '../application/equipment-service'

const testLayer = EquipmentServiceLive

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
      const equipped = yield* svc.equip('IRON_HELMET')
      expect(equipped).toBe(true)
      const item = yield* svc.getEquippedItem('HELMET')
      expect(Option.getOrThrow(item)).toBe('IRON_HELMET')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('equip returns false for non-armor items', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      const equipped = yield* svc.equip('IRON_SWORD')
      expect(equipped).toBe(false)
      const item = yield* svc.getEquippedItem('HELMET')
      expect(Option.isNone(item)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('equip places each armor type in the correct slot', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip('DIAMOND_HELMET')
      yield* svc.equip('IRON_CHESTPLATE')
      yield* svc.equip('LEATHER_LEGGINGS')
      yield* svc.equip('LEATHER_BOOTS')
      const all = yield* svc.getAll()
      expect(Option.getOrThrow(all.HELMET)).toBe('DIAMOND_HELMET')
      expect(Option.getOrThrow(all.CHESTPLATE)).toBe('IRON_CHESTPLATE')
      expect(Option.getOrThrow(all.LEGGINGS)).toBe('LEATHER_LEGGINGS')
      expect(Option.getOrThrow(all.BOOTS)).toBe('LEATHER_BOOTS')
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('getTotalArmorPoints reflects full iron armor (15 points)', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip('IRON_HELMET')
      yield* svc.equip('IRON_CHESTPLATE')
      yield* svc.equip('IRON_LEGGINGS')
      yield* svc.equip('IRON_BOOTS')
      const points = yield* svc.getTotalArmorPoints()
      expect(points).toBe(15)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('getTotalArmorPoints reflects full diamond armor (20 points)', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip('DIAMOND_HELMET')
      yield* svc.equip('DIAMOND_CHESTPLATE')
      yield* svc.equip('DIAMOND_LEGGINGS')
      yield* svc.equip('DIAMOND_BOOTS')
      const points = yield* svc.getTotalArmorPoints()
      expect(points).toBe(20)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('unequipSlot removes and returns the item in a slot', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip('IRON_CHESTPLATE')
      const removed = yield* svc.unequipSlot('CHESTPLATE')
      expect(Option.getOrThrow(removed)).toBe('IRON_CHESTPLATE')
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
      yield* svc.equip('IRON_HELMET')
      yield* svc.equip('DIAMOND_CHESTPLATE')
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
      expect(Option.getOrThrow(helmet)).toBe('LEATHER_HELMET')
      expect(Option.getOrThrow(boots)).toBe('IRON_BOOTS')
      expect(Option.isNone(chestplate)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  // Persistence contract: serialize()'s output, fed straight back into
  // deserialize(), must reproduce the exact equipment state. This guards the
  // save/restore path (session-save.ts) against serialize↔deserialize drift —
  // e.g. a key-casing or omitted-empty-slot mismatch the separate tests miss.
  it.effect('round-trips equipment through serialize → deserialize', () =>
    Effect.gen(function* () {
      const original = yield* EquipmentService
      yield* original.equip('DIAMOND_HELMET')
      yield* original.equip('IRON_CHESTPLATE')
      yield* original.equip('LEATHER_BOOTS')
      const saved = yield* original.serialize()
      const originalPoints = yield* original.getTotalArmorPoints()

      // A fresh service deserialized from the snapshot must match exactly.
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

      expect(Option.getOrThrow(restored.all.HELMET)).toBe('DIAMOND_HELMET')
      expect(Option.getOrThrow(restored.all.CHESTPLATE)).toBe('IRON_CHESTPLATE')
      expect(Option.getOrThrow(restored.all.BOOTS)).toBe('LEATHER_BOOTS')
      expect(Option.isNone(restored.all.LEGGINGS)).toBe(true)
      expect(restored.points).toBe(originalPoints)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect('reset clears all slots', () =>
    Effect.gen(function* () {
      const svc = yield* EquipmentService
      yield* svc.equip('DIAMOND_HELMET')
      yield* svc.equip('DIAMOND_CHESTPLATE')
      yield* svc.reset()
      const points = yield* svc.getTotalArmorPoints()
      expect(points).toBe(0)
      const all = yield* svc.getAll()
      expect(Option.isNone(all.HELMET)).toBe(true)
      expect(Option.isNone(all.CHESTPLATE)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )
})
