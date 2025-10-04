import { it, expect } from '@effect/vitest'
import { Duration, Effect, Option } from 'effect'
import * as Arbitrary from '@effect/schema/Arbitrary'
import { materialCatalog } from '../catalog'
import { MaterialService } from '../service'
import { MaterialServiceLayer } from '../live'
import type { Tool } from '../types'
import { FortuneLevel, parseItemId } from '../types'

const diamondPickaxe: Tool = { type: 'pickaxe', material: 'diamond', enchantments: [] }
const woodenShovel: Tool = { type: 'shovel', material: 'wood', enchantments: [] }
const fortuneArb = Arbitrary.make(FortuneLevel)

it.effect('getMaterial resolves known materials', () =>
  Effect.gen(function* () {
    const service = yield* MaterialService
    const sample = materialCatalog[0]
    const material = yield* service.getMaterial(sample.blockId)
    expect(material.id).toBe(sample.id)
  }).pipe(Effect.provide(MaterialServiceLayer))
)

it.effect('canHarvest differentiates compatible tools', () =>
  Effect.gen(function* () {
    const service = yield* MaterialService
    const stone = materialCatalog.find((material) => material.id === 'stone')!
    const withPickaxe = yield* service.canHarvest(stone, Option.some(diamondPickaxe))
    expect(withPickaxe).toBe(true)
    const withShovel = yield* service.canHarvest(stone, Option.some(woodenShovel))
    expect(withShovel).toBe(false)
  }).pipe(Effect.provide(MaterialServiceLayer))
)

it.effect('miningTime yields finite duration for valid tools and infinity otherwise', () =>
  Effect.gen(function* () {
    const service = yield* MaterialService
    const obsidian = materialCatalog.find((material) => material.id === 'obsidian')!
    const fast = yield* service.miningTime(obsidian, Option.some(diamondPickaxe))
    expect(Duration.toMillis(fast)).toBeGreaterThan(0)
    const slow = yield* service.miningTime(obsidian, Option.some(woodenShovel))
    expect(Number.isFinite(Duration.toMillis(slow))).toBe(false)
  }).pipe(Effect.provide(MaterialServiceLayer))
)

it.effect('drops respect silk touch and fortune', () =>
  Effect.gen(function* () {
    const service = yield* MaterialService
    const ore = materialCatalog.find((material) => material.id === 'diamond_ore')!
    const baseDrops = yield* service.drops(ore, Option.some(diamondPickaxe), 0)
    expect(baseDrops.length).toBeGreaterThan(0)
    const silkTouchTool: Tool = { type: 'pickaxe', material: 'diamond', enchantments: [{ type: 'silk_touch', level: 1 }] }
    const silkDrops = yield* service.drops(ore, Option.some(silkTouchTool), 0)
    expect(silkDrops[0]?.itemId).toBe(ore.defaultItemId)
    const fortuneDrops = yield* service.drops(ore, Option.some(diamondPickaxe), 3)
    const fortuneAmount = fortuneDrops.reduce((total, drop) => total + drop.amount, 0)
    const baseAmount = baseDrops.reduce((total, drop) => total + drop.amount, 0)
    expect(fortuneAmount).toBeGreaterThanOrEqual(baseAmount)
  }).pipe(Effect.provide(MaterialServiceLayer))
)

it.effect('burnTime returns Option based on catalog', () =>
  Effect.gen(function* () {
    const service = yield* MaterialService
    const wood = materialCatalog.find((material) => material.id === 'oak_log')!
    const burnTime = yield* service.burnTime(wood.defaultItemId)
    expect(Option.isSome(burnTime)).toBe(true)
    const nonexistentFuel = parseItemId('minecraft:nonexistent_fuel')
    const none = yield* service.burnTime(nonexistentFuel)
    expect(Option.isNone(none)).toBe(true)
  }).pipe(Effect.provide(MaterialServiceLayer))
)

it.effect('harvest emits events with timestamps', () =>
  Effect.gen(function* () {
    const service = yield* MaterialService
    const ore = materialCatalog.find((material) => material.id === 'diamond_ore')!
    const event = yield* service.harvest(ore.blockId, Option.some(diamondPickaxe), 1)
    expect(event._tag).toBe('Harvested')
    expect(event.timestampMillis).toBeGreaterThanOrEqual(0)
    expect(event.drops.length).toBeGreaterThan(0)
  }).pipe(Effect.provide(MaterialServiceLayer))
)

it.prop('fortune never yields empty drops for ores when using valid tools', [fortuneArb], ([fortune]) => {
  const effect = Effect.gen(function* () {
    const service = yield* MaterialService
    const ore = materialCatalog.find((material) => material.id === 'diamond_ore')!
    const drops = yield* service.drops(ore, Option.some(diamondPickaxe), fortune)
    expect(drops.length).toBeGreaterThan(0)
  }).pipe(Effect.provide(MaterialServiceLayer))
  return Effect.runSync(effect)
})
