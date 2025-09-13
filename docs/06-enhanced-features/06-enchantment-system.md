# Enchantment System - エンチャントシステム

## 概要

Enchantment Systemは、Minecraftのアイテムに魔法的な効果を付与するシステムです。エンチャント効果計算、レベルベース強化システム、アイテム耐久度への影響、特殊エンチャント効果を実装します。Effect-TSの関数型プログラミングとSchema検証を活用し、一貫性のある魔法システムを提供します。

## システム設計原理

### Enchantment Core Types

エンチャントシステムの基本型定義です。

```typescript
import { Effect, Layer, Context, Schema, pipe, Ref } from "effect"
import { Brand } from "effect"

// Domain Types
export type EnchantmentLevel = Brand.Brand<number, "EnchantmentLevel"> // 1-5 (通常), 1-10 (特殊)
export const EnchantmentLevel = pipe(
  Schema.Number,
  Schema.int(),
  Schema.between(1, 10),
  Schema.brand("EnchantmentLevel")
)

export type ExperiencePoints = Brand.Brand<number, "ExperiencePoints">
export const ExperiencePoints = pipe(
  Schema.Number,
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand("ExperiencePoints")
)

export type LapisLazuli = Brand.Brand<number, "LapisLazuli">
export const LapisLazuli = pipe(
  Schema.Number,
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand("LapisLazuli")
)

export type EnchantabilityScore = Brand.Brand<number, "EnchantabilityScore">
export const EnchantabilityScore = pipe(
  Schema.Number,
  Schema.int(),
  Schema.positive(),
  Schema.brand("EnchantabilityScore")
)

// Enchantment Types
export const EnchantmentType = Schema.Literal(
  // Weapon Enchantments
  "sharpness",        // 鋭さ
  "smite",           // アンデッド特効
  "bane_of_arthropods", // 虫特効
  "knockback",       // ノックバック
  "fire_aspect",     // 火属性
  "looting",         // ドロップ増加
  "sweeping_edge",   // 範囲攻撃

  // Tool Enchantments
  "efficiency",      // 効率
  "unbreaking",      // 耐久力
  "fortune",         // 幸運
  "silk_touch",      // シルクタッチ

  // Armor Enchantments
  "protection",      // ダメージ軽減
  "fire_protection", // 火炎耐性
  "blast_protection", // 爆発耐性
  "projectile_protection", // 飛び道具耐性
  "respiration",     // 水中呼吸
  "aqua_affinity",   // 水中作業
  "thorns",          // 棘
  "depth_strider",   // 水中歩行
  "frost_walker",    // 氷上歩行

  // Bow Enchantments
  "power",           // 射撃ダメージ増加
  "punch",           // パンチ
  "flame",           // フレイム
  "infinity",        // 無限

  // Fishing Rod Enchantments
  "luck_of_the_sea", // 海の幸
  "lure",            // 誘釣

  // Trident Enchantments
  "loyalty",         // 忠誠心
  "impaling",        // 串刺し
  "riptide",         // 激流
  "channeling",      // 召雷

  // Crossbow Enchantments
  "quick_charge",    // 高速装填
  "piercing",        // 貫通
  "multishot",       // 拡散

  // Universal Enchantments
  "mending",         // 修繕
  "curse_of_vanishing", // 消失の呪い
  "curse_of_binding"    // 束縛の呪い
)

export type EnchantmentType = Schema.Schema.Type<typeof EnchantmentType>

// Enchantment Definition
export const Enchantment = Schema.Struct({
  type: EnchantmentType,
  level: EnchantmentLevel,
  id: Schema.String,
  displayName: Schema.String,
  description: Schema.String,
  maxLevel: EnchantmentLevel,
  rarity: Schema.Literal("common", "uncommon", "rare", "very_rare", "curse"),
  applicableItems: Schema.Array(Schema.String), // Item types this can be applied to
  conflictsWith: Schema.Array(EnchantmentType), // Mutually exclusive enchantments
  treasureOnly: Schema.Boolean, // Can only be found, not enchanted
  tradeable: Schema.Boolean,     // Can villagers trade this
  experienceCost: Schema.Number, // Base XP cost per level
  lapisCost: LapisLazuli,       // Lapis lazuli cost per level
  weight: Schema.Number,         // Probability weight for random selection
  isCurse: Schema.Boolean
})

export type Enchantment = Schema.Schema.Type<typeof Enchantment>

// Enchanted Item
export const EnchantedItem = Schema.Struct({
  baseItem: ItemStack,
  enchantments: Schema.Map(EnchantmentType, EnchantmentLevel),
  totalEnchantmentCost: ExperiencePoints,
  enchantability: EnchantabilityScore,
  repairCost: ExperiencePoints, // Anvil work penalty
  customName: Schema.optional(Schema.String),
  lore: Schema.Array(Schema.String),
  hideEnchantments: Schema.Boolean,
  glowing: Schema.Boolean, // Visual glow effect
  lastEnchanted: Schema.DateTimeUtc,
  enchantmentHistory: Schema.Array(Schema.Struct({
    enchantmentType: EnchantmentType,
    level: EnchantmentLevel,
    method: Schema.Literal("enchanting_table", "anvil", "book", "command", "loot"),
    timestamp: Schema.DateTimeUtc,
    cost: ExperiencePoints
  }))
})

export type EnchantedItem = Schema.Schema.Type<typeof EnchantedItem>

// Enchanting Context
export const EnchantingContext = Schema.Struct({
  playerLevel: Schema.Number,
  availableExperience: ExperiencePoints,
  availableLapis: LapisLazuli,
  bookshelfCount: Schema.Number.pipe(Schema.between(0, 15)),
  randomSeed: Schema.Number,
  enchantingTablePosition: BlockPosition,
  nearbyBlocks: Schema.Array(Schema.String), // Affects enchantment probabilities
  playerLuck: Schema.Number, // From luck potions or other effects
  fullMoonBonus: Schema.Boolean // Enchantments are better during full moon
})

export type EnchantingContext = Schema.Schema.Type<typeof EnchantingContext>

// Enchantment Recipe/Template
export const EnchantmentRecipe = Schema.Struct({
  targetItem: Schema.String,
  requiredLevel: Schema.Number.pipe(Schema.between(1, 30)),
  possibleEnchantments: Schema.Array(Schema.Struct({
    enchantment: EnchantmentType,
    minLevel: EnchantmentLevel,
    maxLevel: EnchantmentLevel,
    probability: Schema.Number.pipe(Schema.between(0, 1))
  })),
  experienceCost: ExperiencePoints,
  lapisRequired: LapisLazuli
})

export type EnchantmentRecipe = Schema.Schema.Type<typeof EnchantmentRecipe>
```

### Enchantment Engine

エンチャントエンジンの実装です。

```typescript
// Enchantment Engine
export class EnchantmentEngine extends Context.Tag("@app/EnchantmentEngine")<
  EnchantmentEngine,
  {
    readonly generateEnchantmentOptions: (
      item: ItemStack,
      context: EnchantingContext
    ) => Effect.Effect<ReadonlyArray<EnchantmentOption>, EnchantmentError>

    readonly applyEnchantment: (
      item: ItemStack,
      enchantment: EnchantmentType,
      level: EnchantmentLevel,
      method: EnchantmentMethod
    ) => Effect.Effect<EnchantedItem, EnchantmentError>

    readonly removeEnchantment: (
      item: EnchantedItem,
      enchantmentType: EnchantmentType
    ) => Effect.Effect<EnchantedItem, EnchantmentError>

    readonly combineEnchantments: (
      item1: EnchantedItem,
      item2: EnchantedItem,
      anvilCost: ExperiencePoints
    ) => Effect.Effect<EnchantedItem, EnchantmentError>

    readonly calculateEnchantmentPower: (
      enchantment: EnchantmentType,
      level: EnchantmentLevel,
      context: GameContext
    ) => Effect.Effect<EnchantmentPower, never>

    readonly validateEnchantmentCombination: (
      baseEnchantments: ReadonlyArray<EnchantmentType>,
      newEnchantment: EnchantmentType
    ) => Effect.Effect<boolean, never>

    readonly upgradeEnchantment: (
      item: EnchantedItem,
      enchantmentType: EnchantmentType,
      targetLevel: EnchantmentLevel
    ) => Effect.Effect<EnchantedItem, EnchantmentError>

    readonly disenchantItem: (
      item: EnchantedItem
    ) => Effect.Effect<
      { baseItem: ItemStack; experience: ExperiencePoints; books: ReadonlyArray<EnchantmentBook> },
      EnchantmentError
    >
  }
>() {}

export const EnchantmentEngineLive = Layer.effect(
  EnchantmentEngine,
  Effect.gen(function* () {
    const enchantmentRegistry = yield* Ref.make<Map<EnchantmentType, Enchantment>>(new Map())
    const enchantabilityTable = yield* Ref.make<Map<string, EnchantabilityScore>>(new Map())

    // Initialize enchantments
    yield* initializeEnchantments()

    const generateEnchantmentOptions = (
      item: ItemStack,
      context: EnchantingContext
    ) => Effect.gen(function* () {
      const registry = yield* Ref.get(enchantmentRegistry)
      const enchantabilityMap = yield* Ref.get(enchantabilityTable)

      const itemEnchantability = enchantabilityMap.get(item.itemType) || 1 as EnchantabilityScore
      const bookshelfPower = Math.min(context.bookshelfCount, 15)

      const options: EnchantmentOption[] = []

      // Generate 3 options for different levels (like Minecraft)
      for (let slot = 0; slot < 3; slot++) {
        const requiredLevel = Math.max(1, slot * 5 + Math.floor(Math.random() * 8) + 1)

        if (context.playerLevel < requiredLevel) {
          continue
        }

        const enchantmentPower = calculateModifiedEnchantmentPower(
          requiredLevel,
          itemEnchantability,
          bookshelfPower,
          context.randomSeed + slot
        )

        const availableEnchantments = Array.from(registry.values()).filter(enchantment =>
          enchantment.applicableItems.includes(item.itemType) &&
          !enchantment.treasureOnly &&
          requiredLevel >= enchantment.experienceCost
        )

        if (availableEnchantments.length === 0) {
          continue
        }

        const selectedEnchantments = yield* selectEnchantmentsForPower(
          availableEnchantments,
          enchantmentPower,
          context.randomSeed + slot + 1000
        )

        const experienceCost = Math.max(1, Math.floor(requiredLevel * 0.75)) as ExperiencePoints
        const lapisCost = Math.max(1, Math.min(3, Math.floor(requiredLevel / 3))) as LapisLazuli

        options.push({
          slot,
          requiredLevel,
          enchantments: selectedEnchantments,
          experienceCost,
          lapisCost,
          hint: selectedEnchantments[0]?.type || "unknown" // Show first enchantment as hint
        })
      }

      return options
    })

    const applyEnchantment = (
      item: ItemStack,
      enchantment: EnchantmentType,
      level: EnchantmentLevel,
      method: EnchantmentMethod
    ) => Effect.gen(function* () {
      const registry = yield* Ref.get(enchantmentRegistry)
      const enchantmentDef = registry.get(enchantment)

      if (!enchantmentDef) {
        return yield* Effect.fail(new EnchantmentError(`Unknown enchantment: ${enchantment}`))
      }

      if (level > enchantmentDef.maxLevel) {
        return yield* Effect.fail(new EnchantmentError(
          `Level ${level} exceeds maximum for ${enchantment} (${enchantmentDef.maxLevel})`
        ))
      }

      if (!enchantmentDef.applicableItems.includes(item.itemType)) {
        return yield* Effect.fail(new EnchantmentError(
          `${enchantment} cannot be applied to ${item.itemType}`
        ))
      }

      // Check for existing item enchantments
      const existingEnchantments = item.enchantments || new Map()

      // Validate conflicts
      const isValid = yield* validateEnchantmentCombination(
        Array.from(existingEnchantments.keys()),
        enchantment
      )

      if (!isValid) {
        return yield* Effect.fail(new EnchantmentError(
          `${enchantment} conflicts with existing enchantments`
        ))
      }

      // Create enchanted item
      const newEnchantments = new Map(existingEnchantments)

      // If enchantment already exists, combine levels (for anvil) or replace (for table)
      if (newEnchantments.has(enchantment)) {
        if (method === "anvil") {
          const existingLevel = newEnchantments.get(enchantment)!
          const combinedLevel = Math.min(
            enchantmentDef.maxLevel,
            Math.max(existingLevel, level) + (existingLevel === level ? 1 : 0)
          ) as EnchantmentLevel
          newEnchantments.set(enchantment, combinedLevel)
        } else {
          newEnchantments.set(enchantment, level)
        }
      } else {
        newEnchantments.set(enchantment, level)
      }

      const experienceCost = calculateEnchantmentCost(enchantmentDef, level, method)

      const enchantedItem: EnchantedItem = {
        baseItem: { ...item, enchantments: newEnchantments },
        enchantments: newEnchantments,
        totalEnchantmentCost: (item.totalEnchantmentCost || 0) + experienceCost as ExperiencePoints,
        enchantability: getItemEnchantability(item.itemType),
        repairCost: calculateRepairCost(item, method) as ExperiencePoints,
        customName: item.customName,
        lore: item.lore || [],
        hideEnchantments: false,
        glowing: newEnchantments.size > 0,
        lastEnchanted: new Date(),
        enchantmentHistory: [
          ...(item.enchantmentHistory || []),
          {
            enchantmentType: enchantment,
            level,
            method,
            timestamp: new Date(),
            cost: experienceCost
          }
        ]
      }

      return enchantedItem
    })

    const combineEnchantments = (
      item1: EnchantedItem,
      item2: EnchantedItem,
      anvilCost: ExperiencePoints
    ) => Effect.gen(function* () {
      if (item1.baseItem.itemType !== item2.baseItem.itemType) {
        return yield* Effect.fail(new EnchantmentError("Items must be of the same type"))
      }

      const combinedEnchantments = new Map(item1.enchantments)
      const registry = yield* Ref.get(enchantmentRegistry)

      // Combine enchantments from item2
      for (const [enchantType, level2] of item2.enchantments) {
        const enchantmentDef = registry.get(enchantType)
        if (!enchantmentDef) continue

        const level1 = combinedEnchantments.get(enchantType) || 0 as EnchantmentLevel

        // Calculate combined level
        let combinedLevel: EnchantmentLevel
        if (level1 === level2 && level1 < enchantmentDef.maxLevel) {
          combinedLevel = (level1 + 1) as EnchantmentLevel
        } else {
          combinedLevel = Math.max(level1, level2) as EnchantmentLevel
        }

        // Validate conflicts
        const isValid = yield* validateEnchantmentCombination(
          Array.from(combinedEnchantments.keys()).filter(e => e !== enchantType),
          enchantType
        )

        if (isValid) {
          combinedEnchantments.set(enchantType, combinedLevel)
        }
      }

      // Calculate durability combination
      const maxDurability = getMaxDurability(item1.baseItem.itemType)
      const newDurability = Math.min(
        maxDurability,
        (item1.baseItem.durability || maxDurability) + (item2.baseItem.durability || 0)
      )

      const totalCost = item1.totalEnchantmentCost + item2.totalEnchantmentCost + anvilCost as ExperiencePoints
      const newRepairCost = Math.min(63, Math.max(item1.repairCost, item2.repairCost) * 2 + 1) as ExperiencePoints

      const combinedItem: EnchantedItem = {
        ...item1,
        baseItem: {
          ...item1.baseItem,
          durability: newDurability,
          enchantments: combinedEnchantments
        },
        enchantments: combinedEnchantments,
        totalEnchantmentCost: totalCost,
        repairCost: newRepairCost,
        lastEnchanted: new Date(),
        enchantmentHistory: [
          ...item1.enchantmentHistory,
          ...item2.enchantmentHistory,
          {
            enchantmentType: "combine" as EnchantmentType,
            level: 0 as EnchantmentLevel,
            method: "anvil",
            timestamp: new Date(),
            cost: anvilCost
          }
        ]
      }

      return combinedItem
    })

    const calculateEnchantmentPower = (
      enchantment: EnchantmentType,
      level: EnchantmentLevel,
      context: GameContext
    ) => Effect.gen(function* () {
      const registry = yield* Ref.get(enchantmentRegistry)
      const enchantmentDef = registry.get(enchantment)

      if (!enchantmentDef) {
        return {
          basePower: 0,
          scaledPower: 0,
          effectiveness: 0,
          duration: 0,
          range: 0
        }
      }

      const basePower = calculateBasePower(enchantment, level)
      const scaledPower = applyContextModifiers(basePower, context)
      const effectiveness = calculateEffectiveness(enchantment, level, context)

      return {
        basePower,
        scaledPower,
        effectiveness,
        duration: calculateEffectDuration(enchantment, level),
        range: calculateEffectRange(enchantment, level)
      }
    })

    const validateEnchantmentCombination = (
      baseEnchantments: ReadonlyArray<EnchantmentType>,
      newEnchantment: EnchantmentType
    ) => Effect.gen(function* () {
      const registry = yield* Ref.get(enchantmentRegistry)
      const newEnchantmentDef = registry.get(newEnchantment)

      if (!newEnchantmentDef) {
        return false
      }

      // Check for conflicts
      for (const existingEnchantment of baseEnchantments) {
        if (newEnchantmentDef.conflictsWith.includes(existingEnchantment)) {
          return false
        }

        const existingDef = registry.get(existingEnchantment)
        if (existingDef?.conflictsWith.includes(newEnchantment)) {
          return false
        }
      }

      return true
    })

    const disenchantItem = (item: EnchantedItem) => Effect.gen(function* () {
      const books: EnchantmentBook[] = []
      let totalExperience = 0 as ExperiencePoints

      for (const [enchantType, level] of item.enchantments) {
        const book: EnchantmentBook = {
          enchantment: enchantType,
          level,
          id: crypto.randomUUID(),
          storedExperience: Math.floor(level * 5) as ExperiencePoints
        }
        books.push(book)
        totalExperience = (totalExperience + book.storedExperience) as ExperiencePoints
      }

      const baseItem: ItemStack = {
        ...item.baseItem,
        enchantments: new Map(),
        customName: undefined,
        lore: []
      }

      return {
        baseItem,
        experience: totalExperience,
        books
      }
    })

    const initializeEnchantments = () => Effect.gen(function* () {
      // Initialize common enchantments
      const sharpness: Enchantment = {
        type: "sharpness",
        level: 1 as EnchantmentLevel,
        id: "sharpness",
        displayName: "Sharpness",
        description: "Increases attack damage",
        maxLevel: 5 as EnchantmentLevel,
        rarity: "common",
        applicableItems: ["sword", "axe"],
        conflictsWith: ["smite", "bane_of_arthropods"],
        treasureOnly: false,
        tradeable: true,
        experienceCost: 1,
        lapisCost: 1 as LapisLazuli,
        weight: 10,
        isCurse: false
      }

      const efficiency: Enchantment = {
        type: "efficiency",
        level: 1 as EnchantmentLevel,
        id: "efficiency",
        displayName: "Efficiency",
        description: "Increases mining speed",
        maxLevel: 5 as EnchantmentLevel,
        rarity: "common",
        applicableItems: ["pickaxe", "shovel", "axe", "hoe"],
        conflictsWith: [],
        treasureOnly: false,
        tradeable: true,
        experienceCost: 1,
        lapisCost: 1 as LapisLazuli,
        weight: 10,
        isCurse: false
      }

      const protection: Enchantment = {
        type: "protection",
        level: 1 as EnchantmentLevel,
        id: "protection",
        displayName: "Protection",
        description: "Reduces damage taken",
        maxLevel: 4 as EnchantmentLevel,
        rarity: "common",
        applicableItems: ["helmet", "chestplate", "leggings", "boots"],
        conflictsWith: ["fire_protection", "blast_protection", "projectile_protection"],
        treasureOnly: false,
        tradeable: true,
        experienceCost: 1,
        lapisCost: 1 as LapisLazuli,
        weight: 10,
        isCurse: false
      }

      const unbreaking: Enchantment = {
        type: "unbreaking",
        level: 1 as EnchantmentLevel,
        id: "unbreaking",
        displayName: "Unbreaking",
        description: "Increases item durability",
        maxLevel: 3 as EnchantmentLevel,
        rarity: "uncommon",
        applicableItems: ["sword", "axe", "pickaxe", "shovel", "hoe", "helmet", "chestplate", "leggings", "boots", "bow"],
        conflictsWith: [],
        treasureOnly: false,
        tradeable: true,
        experienceCost: 5,
        lapisCost: 1 as LapisLazuli,
        weight: 5,
        isCurse: false
      }

      const mending: Enchantment = {
        type: "mending",
        level: 1 as EnchantmentLevel,
        id: "mending",
        displayName: "Mending",
        description: "Repairs item using XP orbs",
        maxLevel: 1 as EnchantmentLevel,
        rarity: "rare",
        applicableItems: ["sword", "axe", "pickaxe", "shovel", "hoe", "helmet", "chestplate", "leggings", "boots", "bow"],
        conflictsWith: ["infinity"],
        treasureOnly: true,
        tradeable: true,
        experienceCost: 25,
        lapisCost: 3 as LapisLazuli,
        weight: 2,
        isCurse: false
      }

      const curseOfVanishing: Enchantment = {
        type: "curse_of_vanishing",
        level: 1 as EnchantmentLevel,
        id: "curse_of_vanishing",
        displayName: "Curse of Vanishing",
        description: "Item disappears when you die",
        maxLevel: 1 as EnchantmentLevel,
        rarity: "curse",
        applicableItems: ["sword", "axe", "pickaxe", "shovel", "hoe", "helmet", "chestplate", "leggings", "boots", "bow"],
        conflictsWith: [],
        treasureOnly: true,
        tradeable: false,
        experienceCost: 25,
        lapisCost: 3 as LapisLazuli,
        weight: 1,
        isCurse: true
      }

      const enchantments = [sharpness, efficiency, protection, unbreaking, mending, curseOfVanishing]

      yield* Ref.set(enchantmentRegistry, new Map(
        enchantments.map(e => [e.type, e])
      ))

      // Initialize item enchantabilities
      const enchantabilities = new Map<string, EnchantabilityScore>([
        ["leather_helmet", 15 as EnchantabilityScore],
        ["leather_chestplate", 15 as EnchantabilityScore],
        ["iron_sword", 14 as EnchantabilityScore],
        ["diamond_sword", 10 as EnchantabilityScore],
        ["golden_sword", 22 as EnchantabilityScore],
        ["bow", 1 as EnchantabilityScore],
        ["fishing_rod", 1 as EnchantabilityScore],
        ["book", 1 as EnchantabilityScore]
      ])

      yield* Ref.set(enchantabilityTable, enchantabilities)
    })

    return {
      generateEnchantmentOptions,
      applyEnchantment,
      removeEnchantment: (item, enchantmentType) => removeEnchantmentImpl(item, enchantmentType),
      combineEnchantments,
      calculateEnchantmentPower,
      validateEnchantmentCombination,
      upgradeEnchantment: (item, enchantmentType, targetLevel) =>
        upgradeEnchantmentImpl(item, enchantmentType, targetLevel),
      disenchantItem
    } as const
  })
)
```

### Enchantment Effects System

エンチャント効果システムの実装です。

```typescript
// Enchantment Effects System
export class EnchantmentEffectsSystem extends Context.Tag("@app/EnchantmentEffectsSystem")<
  EnchantmentEffectsSystem,
  {
    readonly applyWeaponEnchantmentEffects: (
      attacker: Entity,
      target: Entity,
      weapon: EnchantedItem,
      baseDamage: number
    ) => Effect.Effect<CombatResult, never>

    readonly applyToolEnchantmentEffects: (
      player: PlayerEntity,
      tool: EnchantedItem,
      targetBlock: Block,
      baseSpeed: number
    ) => Effect.Effect<ToolResult, never>

    readonly applyArmorEnchantmentEffects: (
      player: PlayerEntity,
      damage: DamageSource,
      armor: ReadonlyArray<EnchantedItem>
    ) => Effect.Effect<DamageResult, never>

    readonly applyUtilityEnchantmentEffects: (
      player: PlayerEntity,
      item: EnchantedItem,
      action: UtilityAction
    ) => Effect.Effect<UtilityResult, never>

    readonly processOngoingEnchantmentEffects: (
      entities: ReadonlyArray<Entity>,
      world: World,
      deltaTime: number
    ) => Effect.Effect<ReadonlyArray<Entity>, never>

    readonly calculateEnchantmentVisualEffects: (
      item: EnchantedItem,
      context: RenderContext
    ) => Effect.Effect<VisualEffects, never>
  }
>() {}

export const EnchantmentEffectsSystemLive = Layer.effect(
  EnchantmentEffectsSystem,
  Effect.gen(function* () {
    const activeEffects = yield* Ref.make<Map<string, ActiveEnchantmentEffect>>(new Map())

    const applyWeaponEnchantmentEffects = (
      attacker: Entity,
      target: Entity,
      weapon: EnchantedItem,
      baseDamage: number
    ) => Effect.gen(function* () {
      let finalDamage = baseDamage
      let knockback = 0
      const statusEffects: StatusEffect[] = []
      const particles: ParticleEffect[] = []

      for (const [enchantType, level] of weapon.enchantments) {
        switch (enchantType) {
          case "sharpness":
            // +0.5 * level damage per level
            finalDamage += 0.5 * level
            particles.push({
              type: "enchantment_critical",
              position: target.position,
              count: level * 2
            })
            break

          case "smite":
            // Extra damage against undead
            if (isUndeadMob(target)) {
              finalDamage += 2.5 * level
              particles.push({
                type: "smite_critical",
                position: target.position,
                count: level * 3
              })
            }
            break

          case "bane_of_arthropods":
            // Extra damage against arthropods
            if (isArthropodMob(target)) {
              finalDamage += 2.5 * level
              statusEffects.push({
                type: "slowness",
                duration: 1000 + (level * 500),
                amplifier: Math.min(level, 4)
              })
            }
            break

          case "knockback":
            knockback += level * 3
            break

          case "fire_aspect":
            statusEffects.push({
              type: "fire",
              duration: level * 4000, // 4 seconds per level
              amplifier: 1
            })
            particles.push({
              type: "flame",
              position: target.position,
              count: level * 5
            })
            break

          case "looting":
            // Affects drop calculation (handled elsewhere)
            break

          case "sweeping_edge":
            // Affects area damage (handled elsewhere)
            break
        }
      }

      return {
        finalDamage,
        knockback,
        statusEffects,
        particles,
        criticalHit: finalDamage > baseDamage * 1.5,
        enchantmentModifiers: new Map(weapon.enchantments)
      }
    })

    const applyToolEnchantmentEffects = (
      player: PlayerEntity,
      tool: EnchantedItem,
      targetBlock: Block,
      baseSpeed: number
    ) => Effect.gen(function* () {
      let finalSpeed = baseSpeed
      let extraDrops = 0
      let dropModifiers: DropModifier[] = []
      const particles: ParticleEffect[] = []

      for (const [enchantType, level] of tool.enchantments) {
        switch (enchantType) {
          case "efficiency":
            // +30% speed per level for proper tools, +5% for improper tools
            if (isCorrectTool(tool.baseItem.itemType, targetBlock.type)) {
              finalSpeed *= (1 + 0.3 * level)
            } else {
              finalSpeed *= (1 + 0.05 * level)
            }
            particles.push({
              type: "efficiency_sparkles",
              position: targetBlock.position,
              count: level * 2
            })
            break

          case "fortune":
            // Affects drop multipliers for ores and crops
            if (isFortuneAffectedBlock(targetBlock.type)) {
              const fortuneBonus = calculateFortuneBonus(level, targetBlock.type)
              extraDrops += fortuneBonus
              dropModifiers.push({
                type: "fortune",
                multiplier: 1 + fortuneBonus,
                enchantmentLevel: level
              })
            }
            break

          case "silk_touch":
            // Allows collecting the block itself instead of drops
            dropModifiers.push({
              type: "silk_touch",
              multiplier: 1,
              enchantmentLevel: level
            })
            particles.push({
              type: "silk_touch_shimmer",
              position: targetBlock.position,
              count: 10
            })
            break

          case "unbreaking":
            // Handled in durability calculation
            break
        }
      }

      return {
        finalSpeed,
        extraDrops,
        dropModifiers,
        particles,
        durabilityDamage: calculateDurabilityDamage(tool, level),
        experienceBonus: calculateExperienceBonus(tool.enchantments, targetBlock.type)
      }
    })

    const applyArmorEnchantmentEffects = (
      player: PlayerEntity,
      damage: DamageSource,
      armor: ReadonlyArray<EnchantedItem>
    ) => Effect.gen(function* () {
      let damageReduction = 0
      let reflectedDamage = 0
      const statusEffects: StatusEffect[] = []
      const particles: ParticleEffect[] = []

      for (const armorPiece of armor) {
        for (const [enchantType, level] of armorPiece.enchantments) {
          switch (enchantType) {
            case "protection":
              // General damage reduction
              damageReduction += level * 0.04 // 4% per level
              break

            case "fire_protection":
              if (damage.type === "fire" || damage.type === "lava") {
                damageReduction += level * 0.08 // 8% per level for fire damage
              }
              break

            case "blast_protection":
              if (damage.type === "explosion") {
                damageReduction += level * 0.08 // 8% per level for explosion damage
              }
              break

            case "projectile_protection":
              if (damage.type === "projectile") {
                damageReduction += level * 0.08 // 8% per level for projectile damage
              }
              break

            case "thorns":
              if (damage.source === "melee" && Math.random() < level * 0.15) {
                reflectedDamage += 1 + Math.floor(Math.random() * 4)
                particles.push({
                  type: "thorns_damage",
                  position: player.position,
                  count: level * 3
                })
              }
              break

            case "respiration":
              if (damage.type === "drowning") {
                damageReduction += level * 0.25 // 25% per level for drowning
              }
              // Also extends underwater breathing (handled elsewhere)
              break

            case "aqua_affinity":
              // Affects mining speed underwater (handled in tool effects)
              break

            case "depth_strider":
              // Affects movement speed in water (handled in movement system)
              break

            case "frost_walker":
              // Creates frosted ice when walking on water (handled in movement system)
              break
          }
        }
      }

      // Cap damage reduction at 80%
      damageReduction = Math.min(0.8, damageReduction)

      const finalDamage = Math.max(0, damage.amount * (1 - damageReduction))

      return {
        originalDamage: damage.amount,
        finalDamage,
        damageReduction,
        reflectedDamage,
        statusEffects,
        particles,
        armorDurabilityDamage: calculateArmorDurabilityDamage(armor, damage)
      }
    })

    const applyUtilityEnchantmentEffects = (
      player: PlayerEntity,
      item: EnchantedItem,
      action: UtilityAction
    ) => Effect.gen(function* () {
      const results: UtilityResult = {
        success: true,
        bonusEffects: [],
        modifiedResults: {},
        experienceGained: 0 as ExperiencePoints
      }

      for (const [enchantType, level] of item.enchantments) {
        switch (enchantType) {
          case "luck_of_the_sea":
            if (action.type === "fishing") {
              // Increase chance of treasure, decrease junk
              results.modifiedResults.treasureChance = (action.treasureChance || 0) + (level * 0.02)
              results.modifiedResults.junkChance = Math.max(0, (action.junkChance || 0.1) - (level * 0.025))
            }
            break

          case "lure":
            if (action.type === "fishing") {
              // Decrease time to catch fish
              results.modifiedResults.waitTime = Math.max(100, (action.waitTime || 5000) - (level * 500))
            }
            break

          case "loyalty":
            if (action.type === "throw_trident") {
              // Trident returns to player
              results.bonusEffects.push({
                type: "return_to_player",
                delay: 1000 + (3 - level) * 500,
                velocity: level * 2
              })
            }
            break

          case "channeling":
            if (action.type === "throw_trident" && action.weatherCondition === "thunderstorm") {
              // Summon lightning where trident lands
              results.bonusEffects.push({
                type: "summon_lightning",
                position: action.targetPosition,
                damage: 5
              })
            }
            break

          case "riptide":
            if (action.type === "throw_trident" && player.inWater) {
              // Launch player with trident
              results.bonusEffects.push({
                type: "launch_player",
                velocity: {
                  x: action.direction.x * level * 3,
                  y: level,
                  z: action.direction.z * level * 3
                }
              })
            }
            break

          case "mending":
            // Convert XP orbs to durability repair
            if (action.type === "collect_experience") {
              const repairAmount = Math.min(
                action.experienceAmount,
                getMaxDurability(item.baseItem.itemType) - (item.baseItem.durability || 0)
              )
              results.modifiedResults.durabilityRepair = repairAmount
              results.modifiedResults.experienceConsumed = repairAmount
            }
            break
        }
      }

      return results
    })

    const processOngoingEnchantmentEffects = (
      entities: ReadonlyArray<Entity>,
      world: World,
      deltaTime: number
    ) => Effect.gen(function* () {
      const updatedEntities: Entity[] = []

      for (const entity of entities) {
        let updatedEntity = entity

        // Process entity equipment enchantments
        if (entity.type === "player") {
          const player = entity as PlayerEntity
          const equipment = [
            ...player.inventory.armor,
            player.inventory.mainHand,
            player.inventory.offHand
          ].filter(item => item && item.enchantments && item.enchantments.size > 0)

          for (const item of equipment) {
            if (!item?.enchantments) continue

            for (const [enchantType, level] of item.enchantments) {
              switch (enchantType) {
                case "thorns":
                  // Apply thorns glow effect
                  if (player.lastDamageTime && Date.now() - player.lastDamageTime < 1000) {
                    updatedEntity = applyVisualEffect(updatedEntity, "thorns_glow")
                  }
                  break

                case "fire_aspect":
                  // Weapon glows with fire
                  if (item === player.inventory.mainHand) {
                    updatedEntity = applyVisualEffect(updatedEntity, "fire_weapon_glow")
                  }
                  break

                case "frost_walker":
                  // Create frost blocks under feet
                  if (player.inWater || isOnWater(player.position, world)) {
                    yield* createFrostBlocks(player.position, level, world)
                  }
                  break

                case "depth_strider":
                  // Modify movement in water
                  if (player.inWater) {
                    const speedBonus = level * 0.33
                    updatedEntity = {
                      ...updatedEntity,
                      velocity: {
                        x: updatedEntity.velocity.x * (1 + speedBonus),
                        y: updatedEntity.velocity.y,
                        z: updatedEntity.velocity.z * (1 + speedBonus)
                      }
                    }
                  }
                  break
              }
            }
          }
        }

        // Process curse effects
        if (entity.type === "player" || entity.type === "mob") {
          const items = getAllEntityItems(entity)

          for (const item of items) {
            if (!item?.enchantments) continue

            for (const [enchantType] of item.enchantments) {
              switch (enchantType) {
                case "curse_of_vanishing":
                  // Item disappears on death (handled in death system)
                  break

                case "curse_of_binding":
                  // Item cannot be removed (handled in inventory system)
                  updatedEntity = applyVisualEffect(updatedEntity, "binding_curse_chains")
                  break
              }
            }
          }
        }

        updatedEntities.push(updatedEntity)
      }

      return updatedEntities
    })

    return {
      applyWeaponEnchantmentEffects,
      applyToolEnchantmentEffects,
      applyArmorEnchantmentEffects,
      applyUtilityEnchantmentEffects,
      processOngoingEnchantmentEffects,
      calculateEnchantmentVisualEffects: (item, context) =>
        calculateEnchantmentVisualEffectsImpl(item, context)
    } as const
  })
)
```

## Layer構成

```typescript
// Enchantment System Layer
export const EnchantmentSystemLayer = Layer.mergeAll(
  EnchantmentEngineLive,
  EnchantmentEffectsSystemLive
).pipe(
  Layer.provide(WorldSystemLayer),
  Layer.provide(EventBusLayer),
  Layer.provide(InventorySystemLayer)
)
```

## 使用例

```typescript
// Enchantment System の使用例
const exampleEnchantmentSystem = Effect.gen(function* () {
  const enchantmentEngine = yield* EnchantmentEngine
  const effectsSystem = yield* EnchantmentEffectsSystem

  // エンチャント対象のアイテム
  const ironSword: ItemStack = {
    itemType: "iron_sword",
    count: 1,
    durability: 250,
    enchantments: new Map()
  }

  // エンチャントテーブルでのエンチャント
  const enchantingContext: EnchantingContext = {
    playerLevel: 20,
    availableExperience: 500 as ExperiencePoints,
    availableLapis: 10 as LapisLazuli,
    bookshelfCount: 15,
    randomSeed: Math.floor(Math.random() * 1000000),
    enchantingTablePosition: { x: 100, y: 64, z: 100 },
    nearbyBlocks: ["bookshelf", "bookshelf", "bookshelf"],
    playerLuck: 0,
    fullMoonBonus: true
  }

  // エンチャントオプションの生成
  const options = yield* enchantmentEngine.generateEnchantmentOptions(
    ironSword,
    enchantingContext
  )

  yield* Effect.log(`Generated ${options.length} enchantment options:`)
  options.forEach((option, i) => {
    yield* Effect.log(`  Option ${i + 1}: Level ${option.requiredLevel}, Cost: ${option.experienceCost} XP, ${option.lapisCost} lapis`)
    yield* Effect.log(`    Hint: ${option.hint}`)
  })

  // 最初のオプションを選択してエンチャント適用
  if (options.length > 0) {
    const selectedOption = options[0]
    const mainEnchantment = selectedOption.enchantments[0]

    const enchantedSword = yield* enchantmentEngine.applyEnchantment(
      ironSword,
      mainEnchantment.type,
      mainEnchantment.level,
      "enchanting_table"
    )

    yield* Effect.log(`Successfully enchanted sword with ${mainEnchantment.type} ${mainEnchantment.level}`)
    yield* Effect.log(`Total enchantment cost: ${enchantedSword.totalEnchantmentCost} XP`)

    // エンチャント効果の計算
    const enchantmentPower = yield* enchantmentEngine.calculateEnchantmentPower(
      mainEnchantment.type,
      mainEnchantment.level,
      {
        timeOfDay: "day",
        weather: "clear",
        playerLevel: 20,
        difficulty: "normal"
      }
    )

    yield* Effect.log(`Enchantment power: Base ${enchantmentPower.basePower}, Scaled ${enchantmentPower.scaledPower}`)

    // 戦闘での効果テスト
    const attacker: Entity = {
      id: "player_001",
      type: "player",
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      health: 20,
      maxHealth: 20
    }

    const target: Entity = {
      id: "zombie_001",
      type: "zombie",
      position: { x: 1, y: 64, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      health: 20,
      maxHealth: 20
    }

    const combatResult = yield* effectsSystem.applyWeaponEnchantmentEffects(
      attacker,
      target,
      enchantedSword,
      6 // Base sword damage
    )

    yield* Effect.log(`Combat result: ${combatResult.finalDamage} damage (was ${6})`)
    yield* Effect.log(`Knockback: ${combatResult.knockback}`)
    yield* Effect.log(`Status effects: ${combatResult.statusEffects.length}`)

    // アンビルでのエンチャント合成テスト
    const enchantmentBook: EnchantedItem = {
      baseItem: {
        itemType: "enchanted_book",
        count: 1,
        enchantments: new Map([["unbreaking", 3 as EnchantmentLevel]])
      },
      enchantments: new Map([["unbreaking", 3 as EnchantmentLevel]]),
      totalEnchantmentCost: 30 as ExperiencePoints,
      enchantability: 1 as EnchantabilityScore,
      repairCost: 0 as ExperiencePoints,
      lore: [],
      hideEnchantments: false,
      glowing: true,
      lastEnchanted: new Date(),
      enchantmentHistory: []
    }

    const combinedItem = yield* enchantmentEngine.combineEnchantments(
      enchantedSword,
      enchantmentBook,
      35 as ExperiencePoints
    )

    yield* Effect.log(`Combined item now has ${combinedItem.enchantments.size} enchantments`)
    yield* Effect.log(`Repair cost: ${combinedItem.repairCost}`)

    return combinedItem
  }

  return ironSword
})

// エンチャントされたアーマーでのダメージ軽減テスト
const testArmorEnchantments = Effect.gen(function* () {
  const effectsSystem = yield* EnchantmentEffectsSystem

  // エンチャントされたアーマーセット
  const enchantedArmor: ReadonlyArray<EnchantedItem> = [
    {
      baseItem: { itemType: "diamond_helmet", count: 1, enchantments: new Map([["protection", 4 as EnchantmentLevel]]) },
      enchantments: new Map([["protection", 4 as EnchantmentLevel]]),
      totalEnchantmentCost: 40 as ExperiencePoints,
      enchantability: 10 as EnchantabilityScore,
      repairCost: 0 as ExperiencePoints,
      lore: [],
      hideEnchantments: false,
      glowing: true,
      lastEnchanted: new Date(),
      enchantmentHistory: []
    },
    {
      baseItem: { itemType: "diamond_chestplate", count: 1, enchantments: new Map([["thorns", 3 as EnchantmentLevel]]) },
      enchantments: new Map([["thorns", 3 as EnchantmentLevel]]),
      totalEnchantmentCost: 50 as ExperiencePoints,
      enchantability: 10 as EnchantabilityScore,
      repairCost: 0 as ExperiencePoints,
      lore: [],
      hideEnchantments: false,
      glowing: true,
      lastEnchanted: new Date(),
      enchantmentHistory: []
    }
  ]

  const player: PlayerEntity = {
    id: "player_001",
    type: "player",
    position: { x: 0, y: 64, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    health: 20,
    maxHealth: 20,
    inventory: {
      slots: [],
      armor: enchantedArmor,
      mainHand: null,
      offHand: null
    }
  }

  const damage: DamageSource = {
    type: "melee",
    amount: 8,
    source: "skeleton",
    position: { x: 1, y: 64, z: 0 }
  }

  const damageResult = yield* effectsSystem.applyArmorEnchantmentEffects(
    player,
    damage,
    enchantedArmor
  )

  yield* Effect.log(`Original damage: ${damageResult.originalDamage}`)
  yield* Effect.log(`Final damage: ${damageResult.finalDamage}`)
  yield* Effect.log(`Damage reduction: ${(damageResult.damageReduction * 100).toFixed(1)}%`)
  yield* Effect.log(`Reflected damage: ${damageResult.reflectedDamage}`)

  return damageResult
})
```

## パフォーマンス最適化

### エンチャント効果キャッシュ

```typescript
// エンチャント効果の計算結果キャッシュ
export const createEnchantmentCache = Effect.gen(function* () {
  const effectCache = yield* Ref.make<Map<string, CachedEnchantmentEffect>>(new Map())

  return {
    getCachedEffect: (itemId: string, enchantmentType: EnchantmentType, level: EnchantmentLevel) =>
      Effect.gen(function* () {
        const cache = yield* Ref.get(effectCache)
        const key = `${itemId}_${enchantmentType}_${level}`
        const cached = cache.get(key)

        if (cached && Date.now() - cached.timestamp < 5000) { // 5秒キャッシュ
          return cached.effect
        }

        return null
      }),

    setCachedEffect: (
      itemId: string,
      enchantmentType: EnchantmentType,
      level: EnchantmentLevel,
      effect: EnchantmentEffect
    ) => Ref.update(effectCache, map =>
      map.set(`${itemId}_${enchantmentType}_${level}`, {
        effect,
        timestamp: Date.now()
      })
    )
  }
})
```

### バッチエンチャント処理

```typescript
// 複数アイテムのエンチャント効果を一括処理
export const batchProcessEnchantments = (
  items: ReadonlyArray<EnchantedItem>,
  processor: (item: EnchantedItem) => Effect.Effect<ProcessResult, never>
) => Effect.gen(function* () {
  const batches = chunkArray(items, 20) // 20個ずつ処理

  const results = yield* Effect.forEach(
    batches,
    batch => Effect.forEach(
      batch,
      processor,
      { concurrency: 4 }
    ),
    { concurrency: 1 } // バッチは順次処理
  )

  return results.flat()
})
```

## テスト戦略

```typescript
describe("Enchantment System", () => {
  const TestEnchantmentLayer = Layer.mergeAll(
    EnchantmentSystemLayer,
    TestWorldLayer,
    TestInventoryLayer
  )

  it("should generate appropriate enchantment options", () =>
    Effect.gen(function* () {
      const enchantmentEngine = yield* EnchantmentEngine

      const testItem: ItemStack = {
        itemType: "iron_sword",
        count: 1,
        durability: 250,
        enchantments: new Map()
      }

      const context: EnchantingContext = {
        playerLevel: 15,
        availableExperience: 200 as ExperiencePoints,
        availableLapis: 5 as LapisLazuli,
        bookshelfCount: 10,
        randomSeed: 12345,
        enchantingTablePosition: { x: 0, y: 64, z: 0 },
        nearbyBlocks: ["bookshelf"],
        playerLuck: 0,
        fullMoonBonus: false
      }

      const options = yield* enchantmentEngine.generateEnchantmentOptions(testItem, context)

      expect(options.length).toBeGreaterThan(0)
      expect(options[0].requiredLevel).toBeLessThanOrEqual(context.playerLevel)
      expect(options[0].enchantments.length).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(TestEnchantmentLayer),
      Effect.runPromise
    ))

  it("should apply enchantments correctly", () =>
    Effect.gen(function* () {
      const enchantmentEngine = yield* EnchantmentEngine

      const testItem: ItemStack = {
        itemType: "diamond_sword",
        count: 1,
        durability: 1561,
        enchantments: new Map()
      }

      const enchantedItem = yield* enchantmentEngine.applyEnchantment(
        testItem,
        "sharpness",
        3 as EnchantmentLevel,
        "enchanting_table"
      )

      expect(enchantedItem.enchantments.has("sharpness")).toBe(true)
      expect(enchantedItem.enchantments.get("sharpness")).toBe(3)
      expect(enchantedItem.glowing).toBe(true)
    }).pipe(
      Effect.provide(TestEnchantmentLayer),
      Effect.runPromise
    ))

  it("should calculate weapon enchantment effects", () =>
    Effect.gen(function* () {
      const effectsSystem = yield* EnchantmentEffectsSystem

      const enchantedWeapon: EnchantedItem = createTestEnchantedWeapon([
        ["sharpness", 5 as EnchantmentLevel],
        ["fire_aspect", 2 as EnchantmentLevel]
      ])

      const attacker = createTestEntity("player")
      const target = createTestEntity("zombie")

      const result = yield* effectsSystem.applyWeaponEnchantmentEffects(
        attacker,
        target,
        enchantedWeapon,
        7 // Base damage
      )

      expect(result.finalDamage).toBeGreaterThan(7) // Sharpness bonus
      expect(result.statusEffects.some(e => e.type === "fire")).toBe(true) // Fire aspect
    }).pipe(
      Effect.provide(TestEnchantmentLayer),
      Effect.runPromise
    ))

  it("should validate enchantment conflicts", () =>
    Effect.gen(function* () {
      const enchantmentEngine = yield* EnchantmentEngine

      const validCombination = yield* enchantmentEngine.validateEnchantmentCombination(
        ["sharpness"],
        "unbreaking"
      )
      expect(validCombination).toBe(true)

      const invalidCombination = yield* enchantmentEngine.validateEnchantmentCombination(
        ["sharpness"],
        "smite"
      )
      expect(invalidCombination).toBe(false)
    }).pipe(
      Effect.provide(TestEnchantmentLayer),
      Effect.runPromise
    ))
})
```

このEnchantment Systemは、Minecraftの世界にリッチで多様な魔法的強化を提供します。Effect-TSの関数型プログラミングパターンを活用することで、複雑なエンチャント効果の計算と相互作用を一貫性を保ちながら実装し、プレイヤーに深いカスタマイゼーション体験を提供します。