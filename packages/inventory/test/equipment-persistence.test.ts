import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  emptyEquipmentSlots,
  serializeEquipmentSlots,
  deserializeEquipmentSlots,
} from '@ts-minecraft/inventory/application/equipment-persistence'
import type { EquipmentSaveData } from '@ts-minecraft/inventory/application/equipment-persistence'
import { createStack } from '@ts-minecraft/inventory/domain/item-stack'

// ─── emptyEquipmentSlots ─────────────────────────────────────────────────────
describe('emptyEquipmentSlots', () => {
  it('returns Option.none() for HELMET', () => {
    expect(Option.isNone(emptyEquipmentSlots().HELMET)).toBe(true)
  })

  it('returns Option.none() for CHESTPLATE', () => {
    expect(Option.isNone(emptyEquipmentSlots().CHESTPLATE)).toBe(true)
  })

  it('returns Option.none() for LEGGINGS', () => {
    expect(Option.isNone(emptyEquipmentSlots().LEGGINGS)).toBe(true)
  })

  it('returns Option.none() for BOOTS', () => {
    expect(Option.isNone(emptyEquipmentSlots().BOOTS)).toBe(true)
  })

  it('returns a fresh object on each call (no shared state)', () => {
    const a = emptyEquipmentSlots()
    const b = emptyEquipmentSlots()
    expect(a).not.toBe(b)
  })
})

// ─── serializeEquipmentSlots ──────────────────────────────────────────────────
describe('serializeEquipmentSlots', () => {
  it('serializes all-empty slots to all-null EquipmentSaveData', () => {
    const data = serializeEquipmentSlots(emptyEquipmentSlots())
    expect(data.HELMET).toBeNull()
    expect(data.CHESTPLATE).toBeNull()
    expect(data.LEGGINGS).toBeNull()
    expect(data.BOOTS).toBeNull()
  })

  it('serializes a filled HELMET slot to its itemType string', () => {
    const slots = {
      ...emptyEquipmentSlots(),
      HELMET: Option.some(createStack('IRON_HELMET', 1)),
    }
    const data = serializeEquipmentSlots(slots)
    expect(data.HELMET).toBe('IRON_HELMET')
  })

  it('serializes a filled BOOTS slot while other slots remain null', () => {
    const slots = {
      ...emptyEquipmentSlots(),
      BOOTS: Option.some(createStack('DIAMOND_BOOTS', 1)),
    }
    const data = serializeEquipmentSlots(slots)
    expect(data.BOOTS).toBe('DIAMOND_BOOTS')
    expect(data.HELMET).toBeNull()
    expect(data.CHESTPLATE).toBeNull()
    expect(data.LEGGINGS).toBeNull()
  })

  it('serializes a fully equipped player to all non-null fields', () => {
    const slots = {
      HELMET: Option.some(createStack('LEATHER_HELMET', 1)),
      CHESTPLATE: Option.some(createStack('LEATHER_CHESTPLATE', 1)),
      LEGGINGS: Option.some(createStack('LEATHER_LEGGINGS', 1)),
      BOOTS: Option.some(createStack('LEATHER_BOOTS', 1)),
    }
    const data = serializeEquipmentSlots(slots)
    expect(data.HELMET).toBe('LEATHER_HELMET')
    expect(data.CHESTPLATE).toBe('LEATHER_CHESTPLATE')
    expect(data.LEGGINGS).toBe('LEATHER_LEGGINGS')
    expect(data.BOOTS).toBe('LEATHER_BOOTS')
  })
})

// ─── deserializeEquipmentSlots ───────────────────────────────────────────────
describe('deserializeEquipmentSlots', () => {
  it('returns empty slots from all-null save data', () => {
    const saved: EquipmentSaveData = {
      HELMET: null,
      CHESTPLATE: null,
      LEGGINGS: null,
      BOOTS: null,
    }
    const slots = deserializeEquipmentSlots(saved)
    expect(Option.isNone(slots.HELMET)).toBe(true)
    expect(Option.isNone(slots.CHESTPLATE)).toBe(true)
    expect(Option.isNone(slots.LEGGINGS)).toBe(true)
    expect(Option.isNone(slots.BOOTS)).toBe(true)
  })

  it('restores a HELMET ItemStack with count=1', () => {
    const saved: EquipmentSaveData = {
      HELMET: 'IRON_HELMET',
      CHESTPLATE: null,
      LEGGINGS: null,
      BOOTS: null,
    }
    const slots = deserializeEquipmentSlots(saved)
    expect(Option.isSome(slots.HELMET)).toBe(true)
    if (Option.isSome(slots.HELMET)) {
      expect(slots.HELMET.value.itemType).toBe('IRON_HELMET')
      expect(slots.HELMET.value.count).toBe(1)
    }
  })

  it('round-trips serialize → deserialize faithfully', () => {
    const original = {
      HELMET: Option.some(createStack('DIAMOND_HELMET', 1)),
      CHESTPLATE: Option.none(),
      LEGGINGS: Option.some(createStack('IRON_LEGGINGS', 1)),
      BOOTS: Option.none(),
    }
    const saved = serializeEquipmentSlots(original)
    const recovered = deserializeEquipmentSlots(saved)
    expect(Option.isSome(recovered.HELMET)).toBe(true)
    if (Option.isSome(recovered.HELMET)) {
      expect(recovered.HELMET.value.itemType).toBe('DIAMOND_HELMET')
    }
    expect(Option.isNone(recovered.CHESTPLATE)).toBe(true)
    expect(Option.isSome(recovered.LEGGINGS)).toBe(true)
    if (Option.isSome(recovered.LEGGINGS)) {
      expect(recovered.LEGGINGS.value.itemType).toBe('IRON_LEGGINGS')
    }
    expect(Option.isNone(recovered.BOOTS)).toBe(true)
  })
})
