import { describe, it, expect } from 'vitest'
import { Effect, Option, Duration, Layer } from 'effect'
import { Tool, BlockId, ItemId } from '../types/MaterialTypes'
import { MaterialService } from '../services/MaterialService'
import { MaterialServiceLive } from '../services/MaterialServiceLive'

// Test layer
const TestLayer = MaterialServiceLive

describe('MaterialService', () => {
  it('should get material by block id', async () => {
    const result = await Effect.gen(function* () {
      const service = yield* MaterialService
      const stone = yield* service.getMaterial('stone' as BlockId)
      expect(stone.category).toBe('stone')
      expect(stone.hardness).toBe(1.5)
      expect(stone.requiresTool).toBe(true)
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  it('should calculate mining time for stone with diamond pickaxe', async () => {
    await Effect.gen(function* () {
      const service = yield* MaterialService
      const stone = yield* service.getMaterial('stone' as BlockId)
      const diamondPickaxe: Tool = {
        type: 'pickaxe',
        material: 'diamond',
        enchantments: [],
      }
      const time = yield* service.calculateMiningTime(stone, Option.some(diamondPickaxe))
      const seconds = Duration.toSeconds(time)
      // 1.5 hardness * 1.5 base / 8 speed = 0.28125 seconds
      expect(seconds).toBeCloseTo(0.28125, 2)
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  it('should calculate mining time with efficiency enchantment', async () => {
    await Effect.gen(function* () {
      const service = yield* MaterialService
      const stone = yield* service.getMaterial('stone' as BlockId)
      const enchantedPickaxe: Tool = {
        type: 'pickaxe',
        material: 'diamond',
        enchantments: [{ type: 'efficiency', level: 3 }],
      }
      const time = yield* service.calculateMiningTime(stone, Option.some(enchantedPickaxe))
      const seconds = Duration.toSeconds(time)
      // With Efficiency III: 1.5 * 1.5 / (8 * 1.9) ≈ 0.148 seconds
      expect(seconds).toBeLessThan(0.2)
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  it('should return infinite time for obsidian without proper tool', async () => {
    await Effect.gen(function* () {
      const service = yield* MaterialService
      const obsidian = yield* service.getMaterial('obsidian' as BlockId)
      const time = yield* service.calculateMiningTime(obsidian, Option.none())
      // Duration.infinityが返されることを確認（非常に大きな値）
      expect(Duration.toSeconds(time)).toBeGreaterThan(Number.MAX_SAFE_INTEGER)
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  it('should check harvest level restrictions', async () => {
    await Effect.gen(function* () {
      const service = yield* MaterialService

      // Diamond ore requires iron pickaxe (level 2)
      const diamondOre = yield* service.getMaterial('diamond_ore' as BlockId)

      // Wood pickaxe cannot harvest
      const woodPickaxe: Tool = {
        type: 'pickaxe',
        material: 'wood',
        enchantments: [],
      }
      const canHarvestWood = yield* service.canHarvest(diamondOre, Option.some(woodPickaxe))
      expect(canHarvestWood).toBe(false)

      // Iron pickaxe can harvest
      const ironPickaxe: Tool = {
        type: 'pickaxe',
        material: 'iron',
        enchantments: [],
      }
      const canHarvestIron = yield* service.canHarvest(diamondOre, Option.some(ironPickaxe))
      expect(canHarvestIron).toBe(true)

      // Obsidian requires diamond pickaxe (level 3)
      const obsidian = yield* service.getMaterial('obsidian' as BlockId)
      const canHarvestObsidianIron = yield* service.canHarvest(obsidian, Option.some(ironPickaxe))
      expect(canHarvestObsidianIron).toBe(false)

      const diamondPickaxe: Tool = {
        type: 'pickaxe',
        material: 'diamond',
        enchantments: [],
      }
      const canHarvestObsidianDiamond = yield* service.canHarvest(obsidian, Option.some(diamondPickaxe))
      expect(canHarvestObsidianDiamond).toBe(true)
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  it('should get drops with silk touch', async () => {
    await Effect.gen(function* () {
      const service = yield* MaterialService
      const stone = yield* service.getMaterial('stone' as BlockId)

      // Normal drops (cobblestone)
      const normalPickaxe: Tool = {
        type: 'pickaxe',
        material: 'iron',
        enchantments: [],
      }
      const normalDrops = yield* service.getDrops(stone, Option.some(normalPickaxe), 0)
      expect(normalDrops).toHaveLength(1)
      expect(normalDrops[0]?.itemId).toBe('cobblestone')

      // Silk touch drops (stone itself)
      const silkTouchPickaxe: Tool = {
        type: 'pickaxe',
        material: 'iron',
        enchantments: [{ type: 'silk_touch', level: 1 }],
      }
      const silkDrops = yield* service.getDrops(stone, Option.some(silkTouchPickaxe), 0)
      expect(silkDrops).toHaveLength(1)
      expect(silkDrops[0]?.itemId).toBe('stone')
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  it('should return no drops without proper tool', async () => {
    await Effect.gen(function* () {
      const service = yield* MaterialService
      const diamondOre = yield* service.getMaterial('diamond_ore' as BlockId)

      // Wrong tool type
      const axe: Tool = {
        type: 'axe',
        material: 'diamond',
        enchantments: [],
      }
      const drops = yield* service.getDrops(diamondOre, Option.some(axe), 0)
      expect(drops).toHaveLength(0)
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  it('should get burn time for flammable materials', async () => {
    await Effect.gen(function* () {
      const service = yield* MaterialService

      // Wood has burn time
      const woodBurnTime = yield* service.getBurnTime('wood' as ItemId)
      expect(Option.isSome(woodBurnTime)).toBe(true)
      if (Option.isSome(woodBurnTime)) {
        expect(woodBurnTime.value).toBe(300)
      }

      // Stone has no burn time
      const stoneBurnTime = yield* service.getBurnTime('stone' as ItemId)
      expect(Option.isNone(stoneBurnTime)).toBe(true)
    }).pipe(Effect.provide(TestLayer), Effect.runPromise)
  })

  // Property-based tests can be added later with proper @effect/vitest integration
})
