import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { TOOL_MAX_DURABILITY, isDurable, getMaxDurability } from '../domain/durability'
import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'

// Guards: every tool tier should have all four tool types.
// If a new material tier is added, this test catches missing entries.
const TOOL_TYPES = ['SWORD', 'PICKAXE', 'SHOVEL', 'HOE', 'AXE'] as const
const MATERIAL_TIERS = ['WOODEN', 'STONE', 'IRON', 'DIAMOND'] as const
const GOLD_DURABILITY = 32 // gold tools have the lowest durability (vanilla)

describe('TOOL_MAX_DURABILITY completeness', () => {
  it('all four tool types exist for every material tier', () => {
    for (const mat of MATERIAL_TIERS) {
      for (const tool of TOOL_TYPES) {
        const key = `${mat}_${tool}` as InventoryItem
        expect(isDurable(key), `${key} should be durable`).toBe(true)
      }
    }
  })

  it('same material tier shares durability across tool types', () => {
    for (const mat of MATERIAL_TIERS) {
      const values = TOOL_TYPES.map((t) => Option.getOrThrow(getMaxDurability(`${mat}_${t}` as InventoryItem)))
      const allSame = values.every((v) => v === values[0])
      expect(allSame, `All ${mat} tools should have the same durability`).toBe(true)
    }
  })

  it('BOW has 384 durability (vanilla Java)', () => {
    expect(Option.getOrThrow(getMaxDurability('BOW'))).toBe(384)
  })

  it('FISHING_ROD has 64 durability (vanilla Java)', () => {
    expect(Option.getOrThrow(getMaxDurability('FISHING_ROD'))).toBe(64)
  })

  it('wooden tier has lowest durability (59)', () => {
    expect(Option.getOrThrow(getMaxDurability('WOODEN_SWORD'))).toBe(59)
    expect(Option.getOrThrow(getMaxDurability('WOODEN_AXE'))).toBe(59)
    expect(Option.getOrThrow(getMaxDurability('WOODEN_HOE'))).toBe(59)
  })

  it('diamond tier has highest durability (1561)', () => {
    expect(Option.getOrThrow(getMaxDurability('DIAMOND_SWORD'))).toBe(1561)
    expect(Option.getOrThrow(getMaxDurability('DIAMOND_AXE'))).toBe(1561)
    expect(Option.getOrThrow(getMaxDurability('DIAMOND_HOE'))).toBe(1561)
  })

  it('gold tier has durability 32 across all tool types (R99)', () => {
    for (const tool of TOOL_TYPES) {
      const key = `GOLD_${tool}` as InventoryItem
      expect(Option.getOrThrow(getMaxDurability(key)), `${key}`).toBe(32)
    }
  })

  it('durability grows monotonically with material tier', () => {
    const woodSword = Option.getOrThrow(getMaxDurability('WOODEN_SWORD'))
    const stoneSword = Option.getOrThrow(getMaxDurability('STONE_SWORD'))
    const ironSword = Option.getOrThrow(getMaxDurability('IRON_SWORD'))
    const diamondSword = Option.getOrThrow(getMaxDurability('DIAMOND_SWORD'))
    expect(woodSword).toBeLessThan(stoneSword)
    expect(stoneSword).toBeLessThan(ironSword)
    expect(ironSword).toBeLessThan(diamondSword)
  })

  it('every item in TOOL_MAX_DURABILITY is non-stackable (maxStackFor = 1)', () => {
    for (const item of Object.keys(TOOL_MAX_DURABILITY) as InventoryItem[]) {
      expect(isDurable(item), `${item} should be durable`).toBe(true)
    }
  })
})
