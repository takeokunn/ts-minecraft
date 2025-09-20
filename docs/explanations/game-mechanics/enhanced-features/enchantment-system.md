---
title: '06 Enchantment System'
description: '06 Enchantment Systemに関する詳細な説明とガイド。'
category: 'specification'
difficulty: 'intermediate'
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: '30分'
---

# Enchantment System - エンチャントシステム

## 概要

Enchantment Systemは、Minecraftの装備強化とアイテムカスタマイズの核となる高度なシステムです。エンチャントテーブル、金床、本とクイルシステムを通じて、プレイヤーが武器・防具・ツールに魔法効果を付与できる包括的な強化システムを提供します。Inventory SystemとCrafting Systemの上に構築され、経験値システムと密接に統合されています。

## システム設計原理

### Enchantment Core Engine

エンチャント効果の定義、確率計算、レベル管理を統括する高性能エンジンです。

```typescript
import { Effect, Layer, Context, Schema, Match, pipe, Option, Either, Random } from 'effect'
import { Brand } from 'effect'

// Domain Types
export type EnchantmentId = Brand.Brand<string, 'EnchantmentId'>
export const EnchantmentId = Schema.String.pipe(Schema.brand('EnchantmentId'))

export type EnchantmentLevel = Brand.Brand<number, 'EnchantmentLevel'>
export const EnchantmentLevel = pipe(
  Schema.Number,
  Schema.int(),
  Schema.between(1, 10),
  Schema.brand('EnchantmentLevel')
)

export type ExperiencePoints = Brand.Brand<number, 'ExperiencePoints'>
export const ExperiencePoints = pipe(
  Schema.Number,
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('ExperiencePoints')
)

export type EnchantmentPower = Brand.Brand<number, 'EnchantmentPower'>
export const EnchantmentPower = pipe(
  Schema.Number,
  Schema.int(),
  Schema.between(1, 50),
  Schema.brand('EnchantmentPower')
)

// Enchantment Definition
export const EnchantmentType = Schema.Union(
  Schema.Literal('protection'),
  Schema.Literal('fire_protection'),
  Schema.Literal('blast_protection'),
  Schema.Literal('projectile_protection'),
  Schema.Literal('respiration'),
  Schema.Literal('aqua_affinity'),
  Schema.Literal('thorns'),
  Schema.Literal('depth_strider'),
  Schema.Literal('frost_walker'),
  Schema.Literal('binding_curse'),
  Schema.Literal('sharpness'),
  Schema.Literal('smite'),
  Schema.Literal('bane_of_arthropods'),
  Schema.Literal('knockback'),
  Schema.Literal('fire_aspect'),
  Schema.Literal('looting'),
  Schema.Literal('sweeping'),
  Schema.Literal('efficiency'),
  Schema.Literal('silk_touch'),
  Schema.Literal('unbreaking'),
  Schema.Literal('fortune'),
  Schema.Literal('power'),
  Schema.Literal('punch'),
  Schema.Literal('flame'),
  Schema.Literal('infinity'),
  Schema.Literal('luck_of_the_sea'),
  Schema.Literal('lure'),
  Schema.Literal('loyalty'),
  Schema.Literal('impaling'),
  Schema.Literal('riptide'),
  Schema.Literal('channeling'),
  Schema.Literal('multishot'),
  Schema.Literal('quick_charge'),
  Schema.Literal('piercing'),
  Schema.Literal('mending'),
  Schema.Literal('vanishing_curse')
)

export type EnchantmentType = Schema.Schema.Type<typeof EnchantmentType>

export const EnchantmentCategory = Schema.Union(
  Schema.Literal('armor'),
  Schema.Literal('armor_feet'),
  Schema.Literal('armor_legs'),
  Schema.Literal('armor_torso'),
  Schema.Literal('armor_head'),
  Schema.Literal('weapon'),
  Schema.Literal('tool'),
  Schema.Literal('bow'),
  Schema.Literal('fishing_rod'),
  Schema.Literal('trident'),
  Schema.Literal('crossbow'),
  Schema.Literal('wearable'),
  Schema.Literal('vanishable')
)

export type EnchantmentCategory = Schema.Schema.Type<typeof EnchantmentCategory>
```

## エンチャント定義システム

### Enchantment Definition Structure

```typescript
// Value Objects
export const EnchantmentDefinition = Schema.Struct({
  enchantmentId: EnchantmentId,
  type: EnchantmentType,
  name: Schema.String,
  description: Schema.String,
  category: EnchantmentCategory,
  maxLevel: EnchantmentLevel,
  weight: pipe(Schema.Number, Schema.int(), Schema.between(1, 10)), // レア度
  minEnchantability: pipe(Schema.Number, Schema.int(), Schema.positive()),
  maxEnchantability: pipe(Schema.Number, Schema.int(), Schema.positive()),
  applicableItems: Schema.Array(ItemId),
  incompatibleEnchantments: Schema.Array(EnchantmentId),
  isTreasure: Schema.Boolean, // 宝物エンチャント（テーブルでは出現しない）
  isCursed: Schema.Boolean,
  tradeable: Schema.Boolean,
  discoverable: Schema.Boolean,
  bookEnchantable: Schema.Boolean,
})

export type EnchantmentDefinition = Schema.Schema.Type<typeof EnchantmentDefinition>

// Applied Enchantment on Item
export const AppliedEnchantment = Schema.Struct({
  enchantmentId: EnchantmentId,
  level: EnchantmentLevel,
  appliedAt: Schema.DateTimeUtc,
  source: Schema.Union(
    Schema.Literal('enchanting_table'),
    Schema.Literal('anvil'),
    Schema.Literal('book'),
    Schema.Literal('villager_trade'),
    Schema.Literal('loot'),
    Schema.Literal('fishing')
  ),
})

export type AppliedEnchantment = Schema.Schema.Type<typeof AppliedEnchantment>

// Enchantment Conflicts and Compatibility
export const EnchantmentCompatibility = Schema.Struct({
  enchantmentId: EnchantmentId,
  compatibleWith: Schema.Array(EnchantmentId),
  incompatibleWith: Schema.Array(EnchantmentId),
  mutuallyExclusive: Schema.Array(EnchantmentId), // 互いに排斥する
})

export type EnchantmentCompatibility = Schema.Schema.Type<typeof EnchantmentCompatibility>
```

### Enchantment Registry Service

```typescript
// Enchantment Registry Interface
interface EnchantmentRegistryInterface {
  readonly registerEnchantment: (definition: EnchantmentDefinition) => Effect.Effect<void, RegistryError>
  readonly getEnchantment: (id: EnchantmentId) => Effect.Effect<EnchantmentDefinition, NotFoundError>
  readonly getEnchantmentsByCategory: (category: EnchantmentCategory) => Effect.Effect<EnchantmentDefinition[], never>
  readonly getCompatibleEnchantments: (itemId: ItemId) => Effect.Effect<EnchantmentDefinition[], never>
  readonly checkCompatibility: (enchantments: AppliedEnchantment[]) => Effect.Effect<boolean, CompatibilityError>
  readonly getMaxCombinedLevel: (enchantmentId: EnchantmentId) => Effect.Effect<EnchantmentLevel, NotFoundError>
}

const EnchantmentRegistry = Context.GenericTag<EnchantmentRegistryInterface>('@minecraft/EnchantmentRegistry')

// Registry Implementation
const makeEnchantmentRegistryLive = Effect.gen(function* () {
  const enchantmentStorage = yield* StorageService
  const definitionsRef = yield* Ref.make(new Map<EnchantmentId, EnchantmentDefinition>())

  return EnchantmentRegistry.of({
    registerEnchantment: (definition) =>
      Effect.gen(function* () {
        // バリデーション: レベル範囲、アイテム互換性
        yield* validateEnchantmentDefinition(definition)

        yield* Ref.update(definitionsRef, (map) => map.set(definition.enchantmentId, definition))
        yield* enchantmentStorage.store(`enchantment:${definition.enchantmentId}`, definition)
      }),

    getEnchantment: (id) =>
      Effect.gen(function* () {
        const definitions = yield* Ref.get(definitionsRef)
        return yield* Match.value(definitions.get(id)).pipe(
          Match.when(Option.some, identity),
          Match.when(Option.none, () => Effect.fail(new NotFoundError({ enchantmentId: id }))),
          Match.exhaustive
        )
      }),

    getEnchantmentsByCategory: (category) =>
      Effect.gen(function* () {
        const definitions = yield* Ref.get(definitionsRef)
        return Array.from(definitions.values()).filter((def) => def.category === category)
      }),

    checkCompatibility: (enchantments) =>
      Effect.gen(function* () {
        for (const enchantment of enchantments) {
          const definition = yield* EnchantmentRegistry.getEnchantment(enchantment.enchantmentId)

          // 互換性チェック
          for (const other of enchantments) {
            if (enchantment.enchantmentId !== other.enchantmentId) {
              if (definition.incompatibleEnchantments.includes(other.enchantmentId)) {
                return false
              }
            }
          }
        }
        return true
      }),
  })
})

const EnchantmentRegistryLive = Layer.effect(EnchantmentRegistry, makeEnchantmentRegistryLive)
```

## エンチャントテーブル・金床システム

### Enchanting Table Mechanics

```typescript
// Enchanting Table State
export const EnchantingTable = Schema.Struct({
  position: BlockPosition,
  bookshelfPower: EnchantmentPower, // 周囲の本棚から計算
  availableEnchantments: Schema.Array(
    Schema.Struct({
      enchantmentId: EnchantmentId,
      level: EnchantmentLevel,
      cost: ExperiencePoints,
      probability: pipe(Schema.Number, Schema.between(0, 1)),
    })
  ),
  seed: pipe(Schema.Number, Schema.int(), Schema.positive()), // エンチャント確率用シード
  lastUsed: Schema.DateTimeUtc,
})

export type EnchantingTable = Schema.Schema.Type<typeof EnchantingTable>

// Enchanting Service Interface
interface EnchantingServiceInterface {
  readonly calculateBookshelfPower: (position: BlockPosition) => Effect.Effect<EnchantmentPower, never>
  readonly generateEnchantmentOptions: (
    item: ItemStack,
    bookshelfPower: EnchantmentPower,
    playerLevel: ExperiencePoints
  ) => Effect.Effect<EnchantmentOption[], never>
  readonly applyEnchantment: (
    item: ItemStack,
    option: EnchantmentOption,
    playerLevel: ExperiencePoints
  ) => Effect.Effect<{ item: ItemStack; newLevel: ExperiencePoints }, EnchantingError>
  readonly calculateEnchantmentCost: (
    item: ItemStack,
    enchantment: AppliedEnchantment
  ) => Effect.Effect<ExperiencePoints, never>
}

const EnchantingService = Context.GenericTag<EnchantingServiceInterface>('@minecraft/EnchantingService')

// Enchanting Implementation
const makeEnchantingServiceLive = Effect.gen(function* () {
  const registry = yield* EnchantmentRegistry
  const worldService = yield* WorldService
  const randomService = yield* RandomService

  return EnchantingService.of({
    calculateBookshelfPower: (position) =>
      Effect.gen(function* () {
        const surroundingBlocks = yield* worldService.getBlocksInRadius(position, 2)
        const bookshelfCount = surroundingBlocks.filter((block) => block.blockType === 'bookshelf').length

        // 最大15の本棚パワー（本棚の配置によって決定）
        return Math.min(bookshelfCount, 15) as EnchantmentPower
      }),

    generateEnchantmentOptions: (item, bookshelfPower, playerLevel) =>
      Effect.gen(function* () {
        const compatibleEnchantments = yield* registry.getCompatibleEnchantments(item.itemId)
        const seed = yield* randomService.generateSeed()

        return pipe(
          compatibleEnchantments,
          Array.map((enchantment) => ({
            enchantmentId: enchantment.enchantmentId,
            level: calculateEnchantmentLevel(enchantment, bookshelfPower, seed),
            cost: calculateEnchantmentCost(enchantment, bookshelfPower),
            probability: calculateEnchantmentProbability(enchantment, bookshelfPower, playerLevel),
          })),
          Array.filter((option) => option.cost <= playerLevel),
          Array.take(3) // 最大3つのオプション
        )
      }),

    applyEnchantment: (item, option, playerLevel) =>
      Effect.gen(function* () {
        // 経験値コスト確認
        if (playerLevel < option.cost) {
          return yield* Effect.fail(new InsufficientExperienceError())
        }

        // エンチャント互換性確認
        const currentEnchantments = item.enchantments ?? []
        const newEnchantment: AppliedEnchantment = {
          enchantmentId: option.enchantmentId,
          level: option.level,
          appliedAt: new Date().toISOString() as any,
          source: 'enchanting_table',
        }

        const isCompatible = yield* registry.checkCompatibility([...currentEnchantments, newEnchantment])
        if (!isCompatible) {
          return yield* Effect.fail(new IncompatibleEnchantmentError())
        }

        // エンチャント適用
        const enchantedItem: ItemStack = {
          ...item,
          enchantments: [...currentEnchantments, newEnchantment],
        }

        return {
          item: enchantedItem,
          newLevel: (playerLevel - option.cost) as ExperiencePoints,
        }
      }),
  })
})

const EnchantingServiceLive = Layer.effect(EnchantingService, makeEnchantingServiceLive)
```

### Anvil System

```typescript
// Anvil Operations
export const AnvilOperation = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Repair'),
    targetItem: ItemStack,
    materialItem: ItemStack,
    repairAmount: pipe(Schema.Number, Schema.int(), Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Combine'),
    targetItem: ItemStack,
    sacrificeItem: ItemStack,
    mergeEnchantments: Schema.Boolean,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Rename'),
    targetItem: ItemStack,
    newName: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('EnchantWithBook'),
    targetItem: ItemStack,
    enchantedBook: ItemStack,
  })
)

export type AnvilOperation = Schema.Schema.Type<typeof AnvilOperation>

// Anvil Service
interface AnvilServiceInterface {
  readonly calculateAnvilCost: (operation: AnvilOperation) => Effect.Effect<ExperiencePoints, AnvilError>
  readonly performAnvilOperation: (
    operation: AnvilOperation,
    playerLevel: ExperiencePoints
  ) => Effect.Effect<{ result: ItemStack; newLevel: ExperiencePoints }, AnvilError>
  readonly canPerformOperation: (operation: AnvilOperation) => Effect.Effect<boolean, never>
  readonly calculateRepairCost: (item: ItemStack, material: ItemStack) => Effect.Effect<ExperiencePoints, never>
}

const AnvilService = Context.GenericTag<AnvilServiceInterface>('@minecraft/AnvilService')

const makeAnvilServiceLive = Effect.gen(function* () {
  const registry = yield* EnchantmentRegistry

  return AnvilService.of({
    calculateAnvilCost: (operation) =>
      Effect.gen(function* () {
        return yield* Match.value(operation).pipe(
          Match.tag('Repair', ({ targetItem, materialItem }) => calculateRepairCost(targetItem, materialItem)),
          Match.tag('Combine', ({ targetItem, sacrificeItem }) => calculateCombineCost(targetItem, sacrificeItem)),
          Match.tag('Rename', ({ targetItem }) => Effect.succeed(1 as ExperiencePoints)),
          Match.tag('EnchantWithBook', ({ targetItem, enchantedBook }) =>
            calculateBookEnchantCost(targetItem, enchantedBook)
          ),
          Match.exhaustive
        )
      }),

    performAnvilOperation: (operation, playerLevel) =>
      Effect.gen(function* () {
        const cost = yield* AnvilService.calculateAnvilCost(operation)

        if (playerLevel < cost) {
          return yield* Effect.fail(new InsufficientExperienceError())
        }

        const result = yield* Match.value(operation).pipe(
          Match.tag('Combine', ({ targetItem, sacrificeItem, mergeEnchantments }) =>
            Effect.gen(function* () {
              if (!mergeEnchantments) return targetItem

              const targetEnchantments = targetItem.enchantments ?? []
              const sacrificeEnchantments = sacrificeItem.enchantments ?? []

              // エンチャント合成ロジック
              const mergedEnchantments = yield* mergeEnchantmentLists(targetEnchantments, sacrificeEnchantments)

              return {
                ...targetItem,
                enchantments: mergedEnchantments,
                durability: Math.min((targetItem.durability ?? 0) + (sacrificeItem.durability ?? 0), 1000),
              }
            })
          ),
          Match.tag('EnchantWithBook', ({ targetItem, enchantedBook }) =>
            Effect.gen(function* () {
              const bookEnchantments = enchantedBook.enchantments ?? []
              const targetEnchantments = targetItem.enchantments ?? []

              // 本からのエンチャント移転
              for (const enchantment of bookEnchantments) {
                const isCompatible = yield* registry.checkCompatibility([...targetEnchantments, enchantment])

                if (!isCompatible) {
                  return yield* Effect.fail(new IncompatibleEnchantmentError())
                }
              }

              return {
                ...targetItem,
                enchantments: [...targetEnchantments, ...bookEnchantments],
              }
            })
          ),
          Match.orElse(() => Effect.succeed(operation.targetItem))
        )

        return {
          result,
          newLevel: (playerLevel - cost) as ExperiencePoints,
        }
      }),
  })
})

const AnvilServiceLive = Layer.effect(AnvilService, makeAnvilServiceLive)
```

## 経験値システム統合

### Experience Management

```typescript
// Experience System Integration
export const ExperienceLevel = Schema.Struct({
  level: pipe(Schema.Number, Schema.int(), Schema.nonNegative()),
  experience: ExperiencePoints,
  experienceToNext: ExperiencePoints,
  totalExperience: ExperiencePoints,
})

export type ExperienceLevel = Schema.Schema.Type<typeof ExperienceLevel>

// Experience Service
interface ExperienceServiceInterface {
  readonly getPlayerExperience: (playerId: PlayerId) => Effect.Effect<ExperienceLevel, PlayerError>
  readonly addExperience: (playerId: PlayerId, amount: ExperiencePoints) => Effect.Effect<ExperienceLevel, PlayerError>
  readonly consumeExperience: (
    playerId: PlayerId,
    amount: ExperiencePoints
  ) => Effect.Effect<ExperienceLevel, InsufficientExperienceError>
  readonly calculateRequiredExperience: (level: number) => ExperiencePoints
  readonly calculateExperienceFromLevel: (level: ExperienceLevel) => ExperiencePoints
  readonly canAffordEnchantment: (playerId: PlayerId, cost: ExperiencePoints) => Effect.Effect<boolean, never>
}

const ExperienceService = Context.GenericTag<ExperienceServiceInterface>('@minecraft/ExperienceService')

const makeExperienceServiceLive = Effect.gen(function* () {
  const playerStorage = yield* PlayerStorageService

  return ExperienceService.of({
    getPlayerExperience: (playerId) =>
      Effect.gen(function* () {
        const player = yield* playerStorage.getPlayer(playerId)
        return calculateExperienceLevel(player.totalExperience)
      }),

    addExperience: (playerId, amount) =>
      Effect.gen(function* () {
        const currentLevel = yield* ExperienceService.getPlayerExperience(playerId)
        const newTotalExperience = (currentLevel.totalExperience + amount) as ExperiencePoints

        yield* playerStorage.updatePlayerExperience(playerId, newTotalExperience)
        return calculateExperienceLevel(newTotalExperience)
      }),

    consumeExperience: (playerId, amount) =>
      Effect.gen(function* () {
        const currentLevel = yield* ExperienceService.getPlayerExperience(playerId)

        if (currentLevel.totalExperience < amount) {
          return yield* Effect.fail(new InsufficientExperienceError())
        }

        const newTotalExperience = (currentLevel.totalExperience - amount) as ExperiencePoints
        yield* playerStorage.updatePlayerExperience(playerId, newTotalExperience)
        return calculateExperienceLevel(newTotalExperience)
      }),

    calculateRequiredExperience: (level) => {
      // Minecraft経験値計算式
      if (level <= 15) return (2 * level + 7) as ExperiencePoints
      if (level <= 30) return (5 * level - 38) as ExperiencePoints
      return (9 * level - 158) as ExperiencePoints
    },

    canAffordEnchantment: (playerId, cost) =>
      Effect.gen(function* () {
        const level = yield* ExperienceService.getPlayerExperience(playerId)
        return level.totalExperience >= cost
      }),
  })
})

const ExperienceServiceLive = Layer.effect(ExperienceService, makeExperienceServiceLive)
```

## エンチャント確率計算

### Probability and Randomness System

```typescript
// Randomness Service for Enchantments
interface EnchantmentRandomServiceInterface {
  readonly generateEnchantmentSeed: (
    playerName: string,
    itemStack: ItemStack,
    timestamp: number
  ) => Effect.Effect<number, never>
  readonly calculateEnchantmentProbability: (
    enchantment: EnchantmentDefinition,
    bookshelfPower: EnchantmentPower,
    itemEnchantability: number
  ) => Effect.Effect<number, never>
  readonly selectRandomEnchantments: (
    availableEnchantments: EnchantmentDefinition[],
    bookshelfPower: EnchantmentPower,
    seed: number
  ) => Effect.Effect<AppliedEnchantment[], never>
  readonly calculateEnchantmentLevel: (
    enchantment: EnchantmentDefinition,
    bookshelfPower: EnchantmentPower,
    seed: number
  ) => Effect.Effect<EnchantmentLevel, never>
}

const EnchantmentRandomService = Context.GenericTag<EnchantmentRandomServiceInterface>(
  '@minecraft/EnchantmentRandomService'
)

const makeEnchantmentRandomServiceLive = Effect.gen(function* () {
  const random = yield* Random.Random

  return EnchantmentRandomService.of({
    generateEnchantmentSeed: (playerName, itemStack, timestamp) =>
      Effect.gen(function* () {
        // 決定的なシード生成（プレイヤー名、アイテム、タイムスタンプから）
        const seedString = `${playerName}:${itemStack.itemId}:${timestamp}`
        let hash = 0
        for (let i = 0; i < seedString.length; i++) {
          hash = ((hash << 5) - hash + seedString.charCodeAt(i)) & 0xffffffff
        }
        return Math.abs(hash)
      }),

    calculateEnchantmentProbability: (enchantment, bookshelfPower, itemEnchantability) =>
      Effect.gen(function* () {
        // Minecraftのエンチャント確率計算アルゴリズム
        const modifiedEnchantability =
          itemEnchantability + 1 + Math.floor(bookshelfPower / 4) + Math.floor(bookshelfPower / 4)

        const k = Math.max(1, modifiedEnchantability / 4)
        const probability = (enchantment.weight * k) / (enchantment.minEnchantability + enchantment.maxEnchantability)

        return Math.min(1, Math.max(0, probability))
      }),

    selectRandomEnchantments: (availableEnchantments, bookshelfPower, seed) =>
      Effect.gen(function* () {
        // シードベースのランダム生成
        const rng = seedRandom(seed)
        const selectedEnchantments: AppliedEnchantment[] = []

        // 第一エンチャント（必ず選択）
        const weightedEnchantments = availableEnchantments.map((enchantment) => ({
          enchantment,
          weight: enchantment.weight,
        }))

        const firstEnchantment = weightedRandom(weightedEnchantments, rng)
        if (firstEnchantment) {
          const level = yield* EnchantmentRandomService.calculateEnchantmentLevel(
            firstEnchantment,
            bookshelfPower,
            seed
          )

          selectedEnchantments.push({
            enchantmentId: firstEnchantment.enchantmentId,
            level,
            appliedAt: new Date().toISOString() as any,
            source: 'enchanting_table',
          })
        }

        // 追加エンチャント（確率的）
        const bonusEnchantChance = (bookshelfPower + 1) / 50
        if (rng() < bonusEnchantChance) {
          const remainingEnchantments = availableEnchantments.filter(
            (e) =>
              !selectedEnchantments.some((s) => s.enchantmentId === e.enchantmentId) &&
              !e.incompatibleEnchantments.some((incomp) => selectedEnchantments.some((s) => s.enchantmentId === incomp))
          )

          if (remainingEnchantments.length > 0) {
            const bonusEnchantment = weightedRandom(
              remainingEnchantments.map((e) => ({ enchantment: e, weight: e.weight })),
              rng
            )

            if (bonusEnchantment) {
              const level = yield* EnchantmentRandomService.calculateEnchantmentLevel(
                bonusEnchantment,
                bookshelfPower,
                seed + 1
              )

              selectedEnchantments.push({
                enchantmentId: bonusEnchantment.enchantmentId,
                level,
                appliedAt: new Date().toISOString() as any,
                source: 'enchanting_table',
              })
            }
          }
        }

        return selectedEnchantments
      }),

    calculateEnchantmentLevel: (enchantment, bookshelfPower, seed) =>
      Effect.gen(function* () {
        const rng = seedRandom(seed)
        const baseLevel = Math.floor(bookshelfPower / 3) + 1
        const maxLevel = Math.min(enchantment.maxLevel, baseLevel + rng() * 3)
        return Math.max(1, Math.floor(maxLevel)) as EnchantmentLevel
      }),
  })
})

// Seeded Random Number Generator
const seedRandom = (seed: number) => {
  let current = seed
  return () => {
    current = (current * 9301 + 49297) % 233280
    return current / 233280
  }
}

// Weighted Random Selection
const weightedRandom = <T>(items: Array<{ enchantment: T; weight: number }>, rng: () => number): T | null => {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight === 0) return null

  let randomValue = rng() * totalWeight
  for (const item of items) {
    randomValue -= item.weight
    if (randomValue <= 0) return item.enchantment
  }
  return items[items.length - 1]?.enchantment ?? null
}

const EnchantmentRandomServiceLive = Layer.effect(EnchantmentRandomService, makeEnchantmentRandomServiceLive)
```

## エンチャント効果適用システム

### Effect Application Engine

```typescript
// Enchantment Effects
export const EnchantmentEffect = Schema.Union(
  // Damage Modifiers
  Schema.Struct({
    _tag: Schema.Literal('DamageMultiplier'),
    multiplier: pipe(Schema.Number, Schema.positive()),
    damageType: Schema.Optional(
      Schema.Union(Schema.Literal('melee'), Schema.Literal('ranged'), Schema.Literal('magic'))
    ),
  }),

  // Protection Effects
  Schema.Struct({
    _tag: Schema.Literal('DamageReduction'),
    reduction: pipe(Schema.Number, Schema.between(0, 1)),
    damageType: Schema.Union(
      Schema.Literal('all'),
      Schema.Literal('fire'),
      Schema.Literal('explosion'),
      Schema.Literal('projectile'),
      Schema.Literal('fall')
    ),
  }),

  // Special Effects
  Schema.Struct({
    _tag: Schema.Literal('SpecialEffect'),
    effectType: Schema.Union(
      Schema.Literal('silk_touch'),
      Schema.Literal('fortune'),
      Schema.Literal('looting'),
      Schema.Literal('fire_aspect'),
      Schema.Literal('knockback'),
      Schema.Literal('thorns')
    ),
    intensity: pipe(Schema.Number, Schema.positive()),
  }),

  // Durability Effects
  Schema.Struct({
    _tag: Schema.Literal('DurabilityModifier'),
    modifier: pipe(Schema.Number, Schema.positive()), // 耐久度減少の倍率
    repairChance: Schema.Optional(pipe(Schema.Number, Schema.between(0, 1))), // 修繕確率
  })
)

export type EnchantmentEffect = Schema.Schema.Type<typeof EnchantmentEffect>

// Effect Application Service
interface EnchantmentEffectServiceInterface {
  readonly calculateDamageModification: (
    baseDamage: number,
    attackerEnchantments: AppliedEnchantment[],
    defenderEnchantments: AppliedEnchantment[]
  ) => Effect.Effect<number, never>

  readonly applyMiningEffects: (
    block: Block,
    tool: ItemStack,
    player: Player
  ) => Effect.Effect<
    {
      drops: ItemStack[]
      experience: ExperiencePoints
      durabilityDamage: number
    },
    never
  >

  readonly applyEnchantmentEffects: (item: ItemStack, context: EffectContext) => Effect.Effect<EffectResult, never>

  readonly calculateEnchantmentPower: (
    enchantments: AppliedEnchantment[]
  ) => Effect.Effect<Map<EnchantmentType, number>, never>
}

const EnchantmentEffectService = Context.GenericTag<EnchantmentEffectServiceInterface>(
  '@minecraft/EnchantmentEffectService'
)

const makeEnchantmentEffectServiceLive = Effect.gen(function* () {
  const registry = yield* EnchantmentRegistry

  return EnchantmentEffectService.of({
    calculateDamageModification: (baseDamage, attackerEnchantments, defenderEnchantments) =>
      Effect.gen(function* () {
        let modifiedDamage = baseDamage

        // 攻撃者のエンチャント適用
        for (const enchantment of attackerEnchantments) {
          const definition = yield* registry.getEnchantment(enchantment.enchantmentId)

          modifiedDamage = yield* Match.value(definition.type).pipe(
            Match.when('sharpness', () => Effect.succeed(modifiedDamage + enchantment.level * 1.25)),
            Match.when(
              'smite',
              () => Effect.succeed(modifiedDamage + enchantment.level * 2.5) // 対アンデッド
            ),
            Match.when(
              'bane_of_arthropods',
              () => Effect.succeed(modifiedDamage + enchantment.level * 2.5) // 対節足動物
            ),
            Match.orElse(() => Effect.succeed(modifiedDamage))
          )
        }

        // 防御者のエンチャント適用
        for (const enchantment of defenderEnchantments) {
          const definition = yield* registry.getEnchantment(enchantment.enchantmentId)

          modifiedDamage = yield* Match.value(definition.type).pipe(
            Match.when('protection', () => Effect.succeed(modifiedDamage * (1 - enchantment.level * 0.04))),
            Match.when(
              'fire_protection',
              () => Effect.succeed(modifiedDamage * (1 - enchantment.level * 0.08)) // 火ダメージ専用
            ),
            Match.when(
              'blast_protection',
              () => Effect.succeed(modifiedDamage * (1 - enchantment.level * 0.08)) // 爆発ダメージ専用
            ),
            Match.when(
              'projectile_protection',
              () => Effect.succeed(modifiedDamage * (1 - enchantment.level * 0.08)) // 飛び道具専用
            ),
            Match.orElse(() => Effect.succeed(modifiedDamage))
          )
        }

        return Math.max(0, modifiedDamage)
      }),

    applyMiningEffects: (block, tool, player) =>
      Effect.gen(function* () {
        const toolEnchantments = tool.enchantments ?? []
        let drops: ItemStack[] = [
          {
            itemId: block.blockType as ItemId,
            count: 1 as ItemCount,
            timestamp: new Date().toISOString() as any,
          },
        ]
        let experience = 0 as ExperiencePoints
        let durabilityDamage = 1

        for (const enchantment of toolEnchantments) {
          const definition = yield* registry.getEnchantment(enchantment.enchantmentId)

          yield* Match.value(definition.type).pipe(
            Match.when('silk_touch', () =>
              Effect.gen(function* () {
                // シルクタッチ: ブロックそのものをドロップ
                drops = [
                  {
                    itemId: block.blockType as ItemId,
                    count: 1 as ItemCount,
                    timestamp: new Date().toISOString() as any,
                  },
                ]
              })
            ),

            Match.when('fortune', () =>
              Effect.gen(function* () {
                // 幸運: ドロップ数増加
                const fortuneMultiplier = 1 + enchantment.level * 0.5
                if (drops[0]) {
                  drops[0] = {
                    ...drops[0],
                    count: Math.floor(drops[0].count * fortuneMultiplier) as ItemCount,
                  }
                }
              })
            ),

            Match.when('efficiency', () =>
              Effect.gen(function* () {
                // 効率強化: 採掘速度向上（ここでは経験値ボーナスとして表現）
                experience = (experience + enchantment.level) as ExperiencePoints
              })
            ),

            Match.when('unbreaking', () =>
              Effect.gen(function* () {
                // 耐久力: 耐久度減少確率低下
                const unbreakingChance = 1 / (enchantment.level + 1)
                if (Math.random() > unbreakingChance) {
                  durabilityDamage = 0
                }
              })
            ),

            Match.orElse(() => Effect.succeed(undefined))
          )
        }

        return { drops, experience, durabilityDamage }
      }),
  })
})

const EnchantmentEffectServiceLive = Layer.effect(EnchantmentEffectService, makeEnchantmentEffectServiceLive)
```

## 本とクイルシステム

### Enchanted Books System

```typescript
// Enchanted Book Definition
export const EnchantedBook = Schema.Struct({
  itemId: Schema.Literal('enchanted_book').pipe(Schema.brand('ItemId')),
  enchantments: Schema.Array(AppliedEnchantment),
  storedExperience: Schema.Optional(ExperiencePoints),
  author: Schema.Optional(Schema.String),
  title: Schema.Optional(Schema.String),
  description: Schema.Optional(Schema.String),
  rarity: Schema.Union(
    Schema.Literal('common'),
    Schema.Literal('uncommon'),
    Schema.Literal('rare'),
    Schema.Literal('epic'),
    Schema.Literal('legendary')
  ),
  tradeable: Schema.Boolean,
  cursed: Schema.Boolean,
  createdAt: Schema.DateTimeUtc,
})

export type EnchantedBook = Schema.Schema.Type<typeof EnchantedBook>

// Book Creation and Management
interface EnchantedBookServiceInterface {
  readonly createEnchantedBook: (
    enchantments: AppliedEnchantment[],
    options?: Partial<EnchantedBook>
  ) => Effect.Effect<EnchantedBook, BookCreationError>

  readonly combineBooks: (
    book1: EnchantedBook,
    book2: EnchantedBook
  ) => Effect.Effect<EnchantedBook, BookCombinationError>

  readonly extractEnchantment: (
    book: EnchantedBook,
    enchantmentId: EnchantmentId
  ) => Effect.Effect<{ book: EnchantedBook; enchantment: AppliedEnchantment }, ExtractionError>

  readonly validateBookEnchantments: (book: EnchantedBook) => Effect.Effect<boolean, never>

  readonly calculateBookValue: (book: EnchantedBook) => Effect.Effect<ExperiencePoints, never>
}

const EnchantedBookService = Context.GenericTag<EnchantedBookServiceInterface>('@minecraft/EnchantedBookService')

const makeEnchantedBookServiceLive = Effect.gen(function* () {
  const registry = yield* EnchantmentRegistry

  return EnchantedBookService.of({
    createEnchantedBook: (enchantments, options = {}) =>
      Effect.gen(function* () {
        // エンチャント互換性チェック
        const isCompatible = yield* registry.checkCompatibility(enchantments)
        if (!isCompatible) {
          return yield* Effect.fail(new IncompatibleEnchantmentsError())
        }

        // 希少度計算
        const rarity = calculateBookRarity(enchantments)

        const book: EnchantedBook = {
          itemId: 'enchanted_book' as ItemId,
          enchantments,
          rarity,
          tradeable: true,
          cursed: enchantments.some((e) => e.enchantmentId.includes('curse')),
          createdAt: new Date().toISOString() as any,
          ...options,
        }

        return book
      }),

    combineBooks: (book1, book2) =>
      Effect.gen(function* () {
        const allEnchantments = [...book1.enchantments, ...book2.enchantments]

        // 重複エンチャントのマージ
        const mergedEnchantments = mergeEnchantmentLists(book1.enchantments, book2.enchantments)

        const isCompatible = yield* registry.checkCompatibility(mergedEnchantments)
        if (!isCompatible) {
          return yield* Effect.fail(new BookCombinationError())
        }

        return yield* EnchantedBookService.createEnchantedBook(mergedEnchantments, {
          author: book1.author || book2.author,
          storedExperience: ((book1.storedExperience ?? 0) + (book2.storedExperience ?? 0)) as ExperiencePoints,
        })
      }),

    calculateBookValue: (book) =>
      Effect.gen(function* () {
        let totalValue = 0

        for (const enchantment of book.enchantments) {
          const definition = yield* registry.getEnchantment(enchantment.enchantmentId)
          const baseValue = definition.weight * 10
          const levelMultiplier = enchantment.level * 2
          totalValue += baseValue * levelMultiplier
        }

        return totalValue as ExperiencePoints
      }),
  })
})

const EnchantedBookServiceLive = Layer.effect(EnchantedBookService, makeEnchantedBookServiceLive)

// Utility Functions
const calculateBookRarity = (
  enchantments: AppliedEnchantment[]
): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' => {
  const totalLevels = enchantments.reduce((sum, e) => sum + e.level, 0)
  const enchantmentCount = enchantments.length

  if (totalLevels >= 20 || enchantmentCount >= 4) return 'legendary'
  if (totalLevels >= 15 || enchantmentCount >= 3) return 'epic'
  if (totalLevels >= 10 || enchantmentCount >= 2) return 'rare'
  if (totalLevels >= 5) return 'uncommon'
  return 'common'
}

const mergeEnchantmentLists = (list1: AppliedEnchantment[], list2: AppliedEnchantment[]): AppliedEnchantment[] => {
  const merged = new Map<EnchantmentId, AppliedEnchantment>()

  // 最初のリストを追加
  for (const enchantment of list1) {
    merged.set(enchantment.enchantmentId, enchantment)
  }

  // 2番目のリストをマージ（重複の場合はレベル合計）
  for (const enchantment of list2) {
    const existing = merged.get(enchantment.enchantmentId)
    if (existing) {
      merged.set(enchantment.enchantmentId, {
        ...existing,
        level: Math.min(10, existing.level + enchantment.level) as EnchantmentLevel,
      })
    } else {
      merged.set(enchantment.enchantmentId, enchantment)
    }
  }

  return Array.from(merged.values())
}
```

## エンチャント継承・分離システム

### Inheritance and Separation Mechanics

```typescript
// Enchantment Transfer Operations
export const TransferOperation = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Inherit'),
    sourceItem: ItemStack,
    targetItem: ItemStack,
    enchantmentsToTransfer: Schema.Array(EnchantmentId),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Separate'),
    sourceItem: ItemStack,
    enchantmentToExtract: EnchantmentId,
    preserveSource: Schema.Boolean,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Split'),
    sourceItem: ItemStack,
    splitRatio: pipe(Schema.Number, Schema.between(0, 1)), // どの割合で分割するか
  })
)

export type TransferOperation = Schema.Schema.Type<typeof TransferOperation>

// Transfer Service Interface
interface EnchantmentTransferServiceInterface {
  readonly transferEnchantments: (
    operation: TransferOperation,
    playerLevel: ExperiencePoints
  ) => Effect.Effect<TransferResult, TransferError>

  readonly calculateTransferCost: (operation: TransferOperation) => Effect.Effect<ExperiencePoints, never>

  readonly canPerformTransfer: (operation: TransferOperation) => Effect.Effect<boolean, never>

  readonly validateTransferCompatibility: (
    sourceEnchantments: AppliedEnchantment[],
    targetItem: ItemStack
  ) => Effect.Effect<AppliedEnchantment[], CompatibilityError>
}

export const TransferResult = Schema.Struct({
  resultItems: Schema.Array(ItemStack),
  extractedBooks: Schema.Array(EnchantedBook),
  experienceCost: ExperiencePoints,
  success: Schema.Boolean,
  warnings: Schema.Array(Schema.String),
})

export type TransferResult = Schema.Schema.Type<typeof TransferResult>

const EnchantmentTransferService = Context.GenericTag<EnchantmentTransferServiceInterface>(
  '@minecraft/EnchantmentTransferService'
)

const makeEnchantmentTransferServiceLive = Effect.gen(function* () {
  const registry = yield* EnchantmentRegistry
  const bookService = yield* EnchantedBookService

  return EnchantmentTransferService.of({
    transferEnchantments: (operation, playerLevel) =>
      Effect.gen(function* () {
        const cost = yield* EnchantmentTransferService.calculateTransferCost(operation)

        if (playerLevel < cost) {
          return {
            resultItems: [],
            extractedBooks: [],
            experienceCost: cost,
            success: false,
            warnings: ['Insufficient experience'],
          }
        }

        return yield* Match.value(operation).pipe(
          Match.tag('Inherit', ({ sourceItem, targetItem, enchantmentsToTransfer }) =>
            Effect.gen(function* () {
              const sourceEnchantments = sourceItem.enchantments ?? []
              const targetEnchantments = targetItem.enchantments ?? []

              const enchantmentsToMove = sourceEnchantments.filter((e) =>
                enchantmentsToTransfer.includes(e.enchantmentId)
              )

              // 互換性チェック
              const isCompatible = yield* registry.checkCompatibility([...targetEnchantments, ...enchantmentsToMove])

              if (!isCompatible) {
                return {
                  resultItems: [sourceItem, targetItem],
                  extractedBooks: [],
                  experienceCost: cost,
                  success: false,
                  warnings: ['Enchantments are incompatible with target item'],
                }
              }

              // エンチャント移動
              const newSourceEnchantments = sourceEnchantments.filter(
                (e) => !enchantmentsToTransfer.includes(e.enchantmentId)
              )

              const newTargetEnchantments = [...targetEnchantments, ...enchantmentsToMove]

              const updatedSourceItem = {
                ...sourceItem,
                enchantments: newSourceEnchantments.length > 0 ? newSourceEnchantments : undefined,
              }

              const updatedTargetItem = {
                ...targetItem,
                enchantments: newTargetEnchantments,
              }

              return {
                resultItems: [updatedSourceItem, updatedTargetItem],
                extractedBooks: [],
                experienceCost: cost,
                success: true,
                warnings: [],
              }
            })
          ),

          Match.tag('Separate', ({ sourceItem, enchantmentToExtract, preserveSource }) =>
            Effect.gen(function* () {
              const sourceEnchantments = sourceItem.enchantments ?? []
              const enchantmentToSeparate = sourceEnchantments.find((e) => e.enchantmentId === enchantmentToExtract)

              if (!enchantmentToSeparate) {
                return {
                  resultItems: [sourceItem],
                  extractedBooks: [],
                  experienceCost: 0 as ExperiencePoints,
                  success: false,
                  warnings: ['Enchantment not found on source item'],
                }
              }

              // エンチャントブック作成
              const extractedBook = yield* bookService.createEnchantedBook([enchantmentToSeparate])

              const remainingEnchantments = sourceEnchantments.filter((e) => e.enchantmentId !== enchantmentToExtract)

              const updatedSourceItem = preserveSource
                ? {
                    ...sourceItem,
                    enchantments: remainingEnchantments.length > 0 ? remainingEnchantments : undefined,
                  }
                : null

              return {
                resultItems: updatedSourceItem ? [updatedSourceItem] : [],
                extractedBooks: [extractedBook],
                experienceCost: cost,
                success: true,
                warnings: [],
              }
            })
          ),

          Match.tag('Split', ({ sourceItem, splitRatio }) =>
            Effect.gen(function* () {
              const sourceEnchantments = sourceItem.enchantments ?? []
              if (sourceEnchantments.length < 2) {
                return {
                  resultItems: [sourceItem],
                  extractedBooks: [],
                  experienceCost: 0 as ExperiencePoints,
                  success: false,
                  warnings: ['Need at least 2 enchantments to split'],
                }
              }

              const splitIndex = Math.floor(sourceEnchantments.length * splitRatio)
              const firstHalf = sourceEnchantments.slice(0, splitIndex)
              const secondHalf = sourceEnchantments.slice(splitIndex)

              // 2つのエンチャントブック作成
              const firstBook = firstHalf.length > 0 ? yield* bookService.createEnchantedBook(firstHalf) : null
              const secondBook = secondHalf.length > 0 ? yield* bookService.createEnchantedBook(secondHalf) : null

              const extractedBooks = [firstBook, secondBook].filter(Boolean) as EnchantedBook[]

              return {
                resultItems: [],
                extractedBooks,
                experienceCost: cost,
                success: true,
                warnings: [],
              }
            })
          ),

          Match.exhaustive
        )
      }),

    calculateTransferCost: (operation) =>
      Effect.gen(function* () {
        return yield* Match.value(operation).pipe(
          Match.tag('Inherit', ({ enchantmentsToTransfer }) =>
            Effect.succeed((enchantmentsToTransfer.length * 10) as ExperiencePoints)
          ),
          Match.tag('Separate', ({ sourceItem }) => {
            const enchantmentCount = sourceItem.enchantments?.length ?? 0
            return Effect.succeed((enchantmentCount * 5) as ExperiencePoints)
          }),
          Match.tag('Split', ({ sourceItem }) => {
            const enchantmentCount = sourceItem.enchantments?.length ?? 0
            return Effect.succeed((enchantmentCount * 15) as ExperiencePoints)
          }),
          Match.exhaustive
        )
      }),

    canPerformTransfer: (operation) =>
      Effect.gen(function* () {
        return yield* Match.value(operation).pipe(
          Match.tag('Inherit', ({ sourceItem, targetItem }) => {
            const hasEnchantments = (sourceItem.enchantments?.length ?? 0) > 0
            return Effect.succeed(hasEnchantments)
          }),
          Match.tag('Separate', ({ sourceItem }) => {
            return Effect.succeed((sourceItem.enchantments?.length ?? 0) > 0)
          }),
          Match.tag('Split', ({ sourceItem }) => {
            return Effect.succeed((sourceItem.enchantments?.length ?? 0) >= 2)
          }),
          Match.exhaustive
        )
      }),
  })
})

const EnchantmentTransferServiceLive = Layer.effect(EnchantmentTransferService, makeEnchantmentTransferServiceLive)
```

## パフォーマンス最適化とキャッシュ

### Performance Optimization System

```typescript
// Enchantment Cache System
interface EnchantmentCacheServiceInterface {
  readonly cacheEnchantmentCalculation: (
    key: string,
    calculation: Effect.Effect<any, any>,
    ttl?: number
  ) => Effect.Effect<any, any>

  readonly invalidateCache: (pattern: string) => Effect.Effect<void, never>

  readonly preloadEnchantmentDefinitions: () => Effect.Effect<void, never>

  readonly optimizeEnchantmentQueries: (query: EnchantmentQuery) => Effect.Effect<EnchantmentDefinition[], never>
}

const EnchantmentCacheService = Context.GenericTag<EnchantmentCacheServiceInterface>(
  '@minecraft/EnchantmentCacheService'
)

const makeEnchantmentCacheServiceLive = Effect.gen(function* () {
  const cache = yield* Ref.make(new Map<string, { data: any; expiry: number }>())
  const registry = yield* EnchantmentRegistry

  return EnchantmentCacheService.of({
    cacheEnchantmentCalculation: (key, calculation, ttl = 300000) =>
      Effect.gen(function* () {
        const cacheMap = yield* Ref.get(cache)
        const cached = cacheMap.get(key)

        if (cached && cached.expiry > Date.now()) {
          return cached.data
        }

        const result = yield* calculation
        const expiry = Date.now() + ttl

        yield* Ref.update(cache, (map) => map.set(key, { data: result, expiry }))
        return result
      }),

    invalidateCache: (pattern) =>
      Effect.gen(function* () {
        const cacheMap = yield* Ref.get(cache)
        const keysToDelete = Array.from(cacheMap.keys()).filter((key) => key.includes(pattern))

        yield* Ref.update(cache, (map) => {
          keysToDelete.forEach((key) => map.delete(key))
          return map
        })
      }),

    preloadEnchantmentDefinitions: () =>
      Effect.gen(function* () {
        // 全エンチャント定義を事前ロード
        const commonEnchantments = [
          'sharpness',
          'protection',
          'efficiency',
          'unbreaking',
          'fortune',
          'silk_touch',
          'power',
          'flame',
        ]

        for (const enchantmentId of commonEnchantments) {
          yield* EnchantmentCacheService.cacheEnchantmentCalculation(
            `enchantment:${enchantmentId}`,
            registry.getEnchantment(enchantmentId as EnchantmentId),
            3600000 // 1時間
          )
        }
      }),

    optimizeEnchantmentQueries: (query) =>
      Effect.gen(function* () {
        const cacheKey = `query:${JSON.stringify(query)}`

        return yield* EnchantmentCacheService.cacheEnchantmentCalculation(
          cacheKey,
          Effect.gen(function* () {
            // 最適化されたクエリ実行
            if (query.category) {
              return yield* registry.getEnchantmentsByCategory(query.category)
            }

            if (query.itemId) {
              return yield* registry.getCompatibleEnchantments(query.itemId)
            }

            return []
          }),
          600000 // 10分
        )
      }),
  })
})

// Batch Processing for Enchantments
interface EnchantmentBatchServiceInterface {
  readonly batchApplyEnchantments: (
    operations: Array<{ item: ItemStack; enchantments: AppliedEnchantment[] }>
  ) => Effect.Effect<ItemStack[], BatchError>

  readonly batchCalculateDamage: (
    combats: Array<{ attacker: ItemStack[]; defender: ItemStack[]; baseDamage: number }>
  ) => Effect.Effect<number[], never>

  readonly batchUpdateItemEnchantments: (
    updates: Array<{ itemId: string; enchantments: AppliedEnchantment[] }>
  ) => Effect.Effect<void, BatchError>
}

const EnchantmentBatchService = Context.GenericTag<EnchantmentBatchServiceInterface>(
  '@minecraft/EnchantmentBatchService'
)

const makeEnchantmentBatchServiceLive = Effect.gen(function* () {
  const effectService = yield* EnchantmentEffectService

  return EnchantmentBatchService.of({
    batchApplyEnchantments: (operations) =>
      Effect.gen(function* () {
        // 並列処理でエンチャント適用
        const results = yield* Effect.all(
          operations.map(({ item, enchantments }) =>
            Effect.gen(function* () {
              const updatedItem = { ...item, enchantments }
              return updatedItem
            })
          ),
          { concurrency: 10 } // 最大10並列
        )

        return results
      }),

    batchCalculateDamage: (combats) =>
      Effect.gen(function* () {
        const results = yield* Effect.all(
          combats.map(({ attacker, defender, baseDamage }) =>
            effectService.calculateDamageModification(
              baseDamage,
              attacker.flatMap((item) => item.enchantments ?? []),
              defender.flatMap((item) => item.enchantments ?? [])
            )
          ),
          { concurrency: 20 } // 高速化のため高並列度
        )

        return results
      }),
  })
})

const EnchantmentCacheServiceLive = Layer.effect(EnchantmentCacheService, makeEnchantmentCacheServiceLive)
const EnchantmentBatchServiceLive = Layer.effect(EnchantmentBatchService, makeEnchantmentBatchServiceLive)
```

## 実装例とコード例

### Complete Enchantment System Integration

```typescript
// Main Enchantment System Layer
export const EnchantmentSystemLayer = Layer.mergeAll(
  EnchantmentRegistryLive,
  EnchantingServiceLive,
  AnvilServiceLive,
  ExperienceServiceLive,
  EnchantmentRandomServiceLive,
  EnchantmentEffectServiceLive,
  EnchantedBookServiceLive,
  EnchantmentTransferServiceLive,
  EnchantmentCacheServiceLive,
  EnchantmentBatchServiceLive
).pipe(
  Layer.provide(StorageServiceLayer),
  Layer.provide(WorldServiceLayer),
  Layer.provide(RandomServiceLayer)
)

// Example: Complete Enchanting Workflow
export const enchantItemWorkflow = (
  playerId: PlayerId,
  item: ItemStack,
  tablePosition: BlockPosition,
  selectedOption: number
) => Effect.gen(function* () {
  // サービス取得
  const enchantingService = yield* EnchantingService
  const experienceService = yield* ExperienceService
  const inventoryService = yield* InventoryService

  // 本棚パワー計算
  const bookshelfPower = yield* enchantingService.calculateBookshelfPower(tablePosition)

  // プレイヤー経験値取得
  const playerExperience = yield* experienceService.getPlayerExperience(playerId)

  // エンチャントオプション生成
  const options = yield* enchantingService.generateEnchantmentOptions(
    item,
    bookshelfPower,
    playerExperience.totalExperience
  )

  // オプション選択バリデーション
  if (selectedOption < 0 || selectedOption >= options.length) {
    return yield* Effect.fail(new InvalidOptionError())
  }

  const chosenOption = options[selectedOption]

  // エンチャント適用
  const { item: enchantedItem, newLevel } = yield* enchantingService.applyEnchantment(
    item,
    chosenOption,
    playerExperience.totalExperience
  )

  // インベントリ更新
  yield* inventoryService.updatePlayerItem(playerId, enchantedItem)
  yield* experienceService.consumeExperience(playerId, chosenOption.cost)

  return {
    enchantedItem,
    remainingExperience: newLevel,
    appliedEnchantments: chosenOption.enchantments
  }
})

// Example: Anvil Repair and Enchant Workflow
export const anvilCombineWorkflow = (
  playerId: PlayerId,
  targetItem: ItemStack,
  sacrificeItem: ItemStack
) => Effect.gen(function* () {
  const anvilService = yield* AnvilService
  const experienceService = yield* ExperienceService

  // 操作定義
  const operation: AnvilOperation = {
    _tag: "Combine",
    targetItem,
    sacrificeItem,
    mergeEnchantments: true
  }

  // コスト計算
  const cost = yield* anvilService.calculateAnvilCost(operation)

  // プレイヤー経験値確認
  const canAfford = yield* experienceService.canAffordEnchantment(playerId, cost)
  if (!canAfford) {
    return yield* Effect.fail(new InsufficientExperienceError())
  }

  // 金床操作実行
  const playerLevel = yield* experienceService.getPlayerExperience(playerId)
  const { result, newLevel } = yield* anvilService.performAnvilOperation(
    operation,
    playerLevel.totalExperience
  )

  return {
    combinedItem: result,
    experienceUsed: cost,
    remainingExperience: newLevel
  }
})

// Example: Enchantment Effect Application
export const combatWithEnchantments = (
  attacker: Player,
  defender: Player,
  baseDamage: number
) => Effect.gen(function* () {
  const effectService = yield* EnchantmentEffectService
  const inventoryService = yield* InventoryService

  // 装備取得
  const attackerWeapon = yield* inventoryService.getEquippedWeapon(attacker.playerId)
  const defenderArmor = yield* inventoryService.getEquippedArmor(defender.playerId)

  // エンチャント効果計算
  const modifiedDamage = yield* effectService.calculateDamageModification(
    baseDamage,
    attackerWeapon.enchantments ?? [],
    defenderArmor.flatMap(armor => armor.enchantments ?? [])
  )

  // 特殊効果処理
  const attackerEnchantments = attackerWeapon.enchantments ?? []
  const specialEffects: string[] = []

  for (const enchantment of attackerEnchantments) {
    yield* Match.value(enchantment.enchantmentId).pipe(
      Match.when("fire_aspect", () => Effect.gen(function* () {
        specialEffects.push(`Fire damage for ${enchantment.level * 4} ticks`)
        // 火属性ダメージ適用ロジック
      })),
      Match.when("knockback", () => Effect.gen(function* () {
        specialEffects.push(`Knockback level ${enchantment.level}`)
        // ノックバック適用ロジック
      })),
      Match.when("looting", () => Effect.gen(function* () {
        specialEffects.push(`Increased drops (${enchantment.level * 33}% chance)`)
        // ドロップ増加ロジック
      })),
      Match.orElse(() => Effect.succeed(undefined))
    )
  }

  return {
    finalDamage: modifiedDamage,
    specialEffects,
    attackerWeapon,
    defenderArmor
  }
})

// Example: Initialization and Setup
export const initializeEnchantmentSystem = Effect.gen(function* () {
  const registry = yield* EnchantmentRegistry
  const cacheService = yield* EnchantmentCacheService

  // デフォルトエンチャント登録
  const defaultEnchantments: EnchantmentDefinition[] = [
    {
      enchantmentId: "sharpness" as EnchantmentId,
      type: "sharpness",
      name: "Sharpness",
      description: "Increases weapon damage",
      category: "weapon",
      maxLevel: 5 as EnchantmentLevel,
      weight: 10,
      minEnchantability: 1,
      maxEnchantability: 51,
      applicableItems: ["sword" as ItemId, "axe" as ItemId],
      incompatibleEnchantments: ["smite" as EnchantmentId, "bane_of_arthropods" as EnchantmentId],
      isTreasure: false,
      isCursed: false,
      tradeable: true,
      discoverable: true,
      bookEnchantable: true
    }
    // ... 他のエンチャント定義
  ]

  // エンチャント登録
  for (const enchantment of defaultEnchantments) {
    yield* registry.registerEnchantment(enchantment)
  }

  // キャッシュ事前ロード
  yield* cacheService.preloadEnchantmentDefinitions()

  console.log("Enchantment System initialized successfully")
})

// Error Types
export const EnchantingError = Schema.TaggedError("EnchantingError")({
  message: Schema.String
}) {}

export const InsufficientExperienceError = Schema.TaggedError("InsufficientExperienceError")({
  required: ExperiencePoints,
  available: ExperiencePoints
}) {}

export const IncompatibleEnchantmentError = Schema.TaggedError("IncompatibleEnchantmentError")({
  conflictingEnchantments: Schema.Array(EnchantmentId)
}) {}

export const AnvilError = Schema.TaggedError("AnvilError")({
  operation: Schema.String,
  reason: Schema.String
}) {}
```

## 結論

このEnchantment Systemは、Effect-TSの関数型プログラミングパターンを活用し、Minecraftの複雑なエンチャントメカニクスを型安全かつ拡張可能な方法で実装しています。

### 主要特徴

1. **型安全性**: Schema.Structによる厳密なデータ定義
2. **関数型設計**: Match.valueパターンによる条件分岐の型安全化
3. **高性能**: キャッシュとバッチ処理による最適化
4. **拡張性**: 新しいエンチャントの簡単な追加
5. **信頼性**: Effect-TSのエラーハンドリング機能の活用

### 実装のポイント

- **エンチャント定義**: レジストリパターンによる中央管理
- **確率システム**: シードベースの決定的ランダム性
- **効果適用**: 並列処理による高速化
- **互換性管理**: 型レベルでの制約チェック
- **パフォーマンス**: メモリ効率的なキャッシュシステム

このシステムにより、プレイヤーは豊富なエンチャントオプションを通じて、装備をカスタマイズし、戦略的なゲームプレイを楽しむことができます。
