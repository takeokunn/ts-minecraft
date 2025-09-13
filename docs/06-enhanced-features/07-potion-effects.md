# Potion Effects System - ポーション効果システム

## 概要

Potion Effects Systemは、Minecraftの世界で一時的・永続的なステータス効果を管理するシステムです。効果の持続時間管理、複数効果の相互作用、プレイヤー能力値への影響、視覚効果とパーティクルを実装します。Effect-TSの関数型プログラミングとSTMを活用し、一貫性のある効果システムを提供します。

## システム設計原理

### Potion Effects Core Types

ポーション効果システムの基本型定義です。

```typescript
import { Effect, Layer, Context, Schema, STM, Ref, pipe, Match } from "effect"
import { Brand } from "effect"

// Domain Types
export type EffectDuration = Brand.Brand<number, "EffectDuration"> // milliseconds
export const EffectDuration = pipe(
  Schema.Number,
  Schema.int(),
  Schema.positive(),
  Schema.brand("EffectDuration")
)

export type EffectAmplifier = Brand.Brand<number, "EffectAmplifier"> // 0-255
export const EffectAmplifier = pipe(
  Schema.Number,
  Schema.int(),
  Schema.between(0, 255),
  Schema.brand("EffectAmplifier")
)

export type EffectPotency = Brand.Brand<number, "EffectPotency"> // 0.0-2.0
export const EffectPotency = pipe(
  Schema.Number,
  Schema.between(0, 2),
  Schema.brand("EffectPotency")
)

// Effect Types
export const PotionEffectType = Schema.Literal(
  // Beneficial Effects
  "speed",              // 移動速度上昇
  "slowness",           // 移動速度低下
  "haste",              // 採掘速度上昇
  "mining_fatigue",     // 採掘速度低下
  "strength",           // 攻撃力上昇
  "instant_health",     // 即座回復
  "instant_damage",     // 即座ダメージ
  "jump_boost",         // ジャンプ力上昇
  "nausea",             // 吐き気
  "regeneration",       // 再生
  "resistance",         // ダメージ耐性
  "fire_resistance",    // 火炎耐性
  "water_breathing",    // 水中呼吸
  "invisibility",       // 透明化
  "blindness",          // 盲目
  "night_vision",       // 暗視
  "hunger",             // 空腹
  "weakness",           // 攻撃力低下
  "poison",             // 毒
  "wither",             // ウィザー
  "health_boost",       // 体力増強
  "absorption",         // ダメージ吸収
  "saturation",         // 満腹度回復
  "glowing",            // 発光
  "levitation",         // 浮遊
  "luck",               // 幸運
  "bad_luck",           // 不運
  "slow_falling",       // 低速落下
  "conduit_power",      // コンジットパワー
  "dolphins_grace",     // イルカの好意
  "bad_omen",           // 不吉な予感
  "hero_of_the_village", // 村の英雄
  "darkness"            // 暗闇
)

export type PotionEffectType = Schema.Schema.Type<typeof PotionEffectType>

// Effect Categories
export const EffectCategory = Schema.Literal(
  "beneficial",   // 有益な効果
  "harmful",      // 有害な効果
  "neutral",      // 中立的な効果
  "instant"       // 即座効果
)

export type EffectCategory = Schema.Schema.Type<typeof EffectCategory>

// Potion Effect Definition
export const PotionEffect = Schema.Struct({
  id: Schema.String,
  type: PotionEffectType,
  amplifier: EffectAmplifier,
  duration: EffectDuration,
  remainingDuration: EffectDuration,
  category: EffectCategory,
  isInstant: Schema.Boolean,
  showParticles: Schema.Boolean,
  showIcon: Schema.Boolean,
  isAmbient: Schema.Boolean, // From beacon effects
  source: Schema.Struct({
    type: Schema.Literal("potion", "splash_potion", "lingering_potion", "tipped_arrow", "beacon", "food", "command", "entity"),
    sourceId: Schema.optional(Schema.String),
    caster: Schema.optional(Schema.String) // Entity that caused this effect
  }),
  potency: EffectPotency,
  stackable: Schema.Boolean,
  overridable: Schema.Boolean,
  createdAt: Schema.DateTimeUtc,
  lastTick: Schema.DateTimeUtc,
  tickInterval: Schema.Number, // How often the effect ticks (in milliseconds)
  metadata: Schema.Record(Schema.String, Schema.Unknown)
})

export type PotionEffect = Schema.Schema.Type<typeof PotionEffect>

// Effect Instance (applied to entity)
export const ActiveEffect = Schema.Struct({
  effect: PotionEffect,
  targetEntityId: Schema.String,
  appliedAt: Schema.DateTimeUtc,
  lastUpdate: Schema.DateTimeUtc,
  totalTicksApplied: Schema.Number,
  suspended: Schema.Boolean, // Can be suspended by milk or other effects
  immunityEndTime: Schema.optional(Schema.DateTimeUtc) // Temporary immunity
})

export type ActiveEffect = Schema.Schema.Type<typeof ActiveEffect>

// Effect Modifier
export const EffectModifier = Schema.Struct({
  attribute: Schema.Literal(
    "movement_speed", "attack_damage", "max_health", "armor", "armor_toughness",
    "attack_speed", "luck", "knockback_resistance", "follow_range", "flying_speed"
  ),
  operation: Schema.Literal("add", "multiply_base", "multiply_total"),
  value: Schema.Number,
  uuid: Schema.String
})

export type EffectModifier = Schema.Schema.Type<typeof EffectModifier>

// Effect Definition Template
export const EffectTemplate = Schema.Struct({
  type: PotionEffectType,
  displayName: Schema.String,
  description: Schema.String,
  category: EffectCategory,
  isInstant: Schema.Boolean,
  defaultDuration: EffectDuration,
  maxDuration: EffectDuration,
  maxAmplifier: EffectAmplifier,
  tickInterval: Schema.Number,
  color: Schema.Struct({
    r: Schema.Number.pipe(Schema.between(0, 255)),
    g: Schema.Number.pipe(Schema.between(0, 255)),
    b: Schema.Number.pipe(Schema.between(0, 255))
  }),
  particleType: Schema.String,
  soundEffect: Schema.optional(Schema.String),
  modifiers: Schema.Array(EffectModifier),
  conflictsWith: Schema.Array(PotionEffectType),
  immunityDuration: Schema.Number, // Duration of immunity after effect ends
  canBeAmplified: Schema.Boolean,
  canBeExtended: Schema.Boolean,
  removedByMilk: Schema.Boolean,
  hiddenWhenAmbient: Schema.Boolean
})

export type EffectTemplate = Schema.Schema.Type<typeof EffectTemplate>

// Effect Interaction
export const EffectInteraction = Schema.Struct({
  primaryEffect: PotionEffectType,
  secondaryEffect: PotionEffectType,
  interactionType: Schema.Literal("cancel", "amplify", "reduce", "transform", "combine"),
  resultEffect: Schema.optional(PotionEffectType),
  priority: Schema.Number,
  conditions: Schema.Array(Schema.String)
})

export type EffectInteraction = Schema.Schema.Type<typeof EffectInteraction>
```

### Potion Effects Engine

ポーション効果エンジンの実装です。

```typescript
// Potion Effects Engine
interface PotionEffectsEngine {
  readonly applyEffect: (
    entityId: string,
    effect: PotionEffect,
    world: World
  ) => Effect.Effect<ActiveEffect, EffectError>

  readonly removeEffect: (
    entityId: string,
    effectType: PotionEffectType
  ) => Effect.Effect<void, EffectError>

  readonly updateActiveEffects: (
    entityId: string,
    deltaTime: number
  ) => Effect.Effect<ReadonlyArray<ActiveEffect>, never>

  readonly getActiveEffects: (
    entityId: string
  ) => Effect.Effect<ReadonlyArray<ActiveEffect>, never>

  readonly hasEffect: (
    entityId: string,
    effectType: PotionEffectType
  ) => Effect.Effect<boolean, never>

  readonly processEffectInteractions: (
    entityId: string,
    newEffect: PotionEffect
  ) => Effect.Effect<ReadonlyArray<PotionEffect>, never>

  readonly calculateEffectModifiers: (
    entity: Entity,
    effects: ReadonlyArray<ActiveEffect>
  ) => Effect.Effect<EntityModifiers, never>

  readonly clearAllEffects: (
    entityId: string,
    reason: ClearReason
  ) => Effect.Effect<void, never>

  readonly immunizeToEffect: (
    entityId: string,
    effectType: PotionEffectType,
    duration: number
  ) => Effect.Effect<void, never>
}

export const PotionEffectsEngine = Context.GenericTag<PotionEffectsEngine>("@app/PotionEffectsEngine")

export const PotionEffectsEngineLive = Layer.effect(
  PotionEffectsEngine,
  Effect.gen(function* () {
    const activeEffects = yield* Ref.make<Map<string, ReadonlyArray<ActiveEffect>>>(new Map())
    const effectTemplates = yield* Ref.make<Map<PotionEffectType, EffectTemplate>>(new Map())
    const effectInteractions = yield* Ref.make<ReadonlyArray<EffectInteraction>>([])
    const immunities = yield* Ref.make<Map<string, Map<PotionEffectType, number>>>(new Map())

    // Initialize effect templates
    yield* initializeEffectTemplates()

    const applyEffect = (
      entityId: string,
      effect: PotionEffect,
      world: World
    ) => STM.gen(function* () {
      const currentEffects = yield* STM.fromRef(activeEffects)
      const entityEffects = currentEffects.get(entityId) || []

      // Check immunity
      const immunityMap = yield* STM.fromRef(immunities)
      const entityImmunities = immunityMap.get(entityId)
      if (entityImmunities?.has(effect.type)) {
        const immunityEnd = entityImmunities.get(effect.type)!
        if (Date.now() < immunityEnd) {
          return yield* STM.fail(new EffectError(`Entity ${entityId} is immune to ${effect.type}`))
        }
      }

      // Process interactions with existing effects
      const interactionResults = yield* STM.succeed(
        processEffectInteractionsSync(effect, entityEffects)
      )

      let finalEffect = effect
      let updatedEffects = [...entityEffects]

      // Apply interaction results
      for (const interaction of interactionResults) {
        const interactionResult = Match.value(interaction.type).pipe(
          Match.when("cancel", () => ({
            updatedEffects: updatedEffects.filter(e => e.effect.type !== interaction.targetEffect),
            finalEffect
          })),
          Match.when("amplify", () => ({
            updatedEffects,
            finalEffect: {
              ...finalEffect,
              amplifier: Math.min(255, finalEffect.amplifier + interaction.modifier) as EffectAmplifier
            }
          })),
          Match.when("reduce", () => ({
            updatedEffects,
            finalEffect: {
              ...finalEffect,
              duration: Math.max(1000, finalEffect.duration - interaction.modifier) as EffectDuration
            }
          })),
          Match.when("transform", () => ({
            updatedEffects,
            finalEffect: interaction.resultEffectType ? {
              ...finalEffect,
              type: interaction.resultEffectType
            } : finalEffect
          })),
          Match.orElse(() => ({ updatedEffects, finalEffect }))
        )

        updatedEffects = interactionResult.updatedEffects
        finalEffect = interactionResult.finalEffect
      }

      // Check if effect already exists
      const existingEffectIndex = updatedEffects.findIndex(e => e.effect.type === finalEffect.type)

      if (existingEffectIndex >= 0) {
        const existingEffect = updatedEffects[existingEffectIndex]

        // Determine how to combine
        if (finalEffect.stackable) {
          // Stack amplifier
          const newAmplifier = Math.min(255,
            existingEffect.effect.amplifier + finalEffect.amplifier
          ) as EffectAmplifier

          finalEffect = {
            ...finalEffect,
            amplifier: newAmplifier,
            duration: Math.max(existingEffect.effect.remainingDuration, finalEffect.duration) as EffectDuration
          }
        } else if (finalEffect.overridable) {
          // Use stronger effect
          if (finalEffect.amplifier > existingEffect.effect.amplifier ||
              (finalEffect.amplifier === existingEffect.effect.amplifier &&
               finalEffect.duration > existingEffect.effect.remainingDuration)) {
            // Keep new effect
          } else {
            // Keep existing effect
            return existingEffect
          }
        } else {
          // Cannot override, keep existing
          return existingEffect
        }

        updatedEffects[existingEffectIndex] = {
          ...existingEffect,
          effect: finalEffect,
          appliedAt: new Date(),
          lastUpdate: new Date(),
          totalTicksApplied: 0
        }
      } else {
        // Add new effect
        const activeEffect: ActiveEffect = {
          effect: {
            ...finalEffect,
            remainingDuration: finalEffect.duration
          },
          targetEntityId: entityId,
          appliedAt: new Date(),
          lastUpdate: new Date(),
          totalTicksApplied: 0,
          suspended: false
        }

        updatedEffects.push(activeEffect)
      }

      // Update state
      yield* STM.setRef(activeEffects, currentEffects.set(entityId, updatedEffects))

      // Apply instant effects immediately
      if (finalEffect.isInstant) {
        yield* STM.succeed(Effect.runSync(applyInstantEffect(entityId, finalEffect, world)))
      }

      return updatedEffects[updatedEffects.length - 1]
    })

    const removeEffect = (
      entityId: string,
      effectType: PotionEffectType
    ) => Effect.gen(function* () {
      yield* Ref.update(activeEffects, map => {
        const entityEffects = map.get(entityId) || []
        const updatedEffects = entityEffects.filter(e => e.effect.type !== effectType)
        return map.set(entityId, updatedEffects)
      })

      // Apply removal side effects
      yield* applyEffectRemovalSideEffects(entityId, effectType)
    })

    const updateActiveEffects = (
      entityId: string,
      deltaTime: number
    ) => Effect.gen(function* () {
      const effectsMap = yield* Ref.get(activeEffects)
      const entityEffects = effectsMap.get(entityId) || []

      const updatedEffects: ActiveEffect[] = []
      const expiredEffects: ActiveEffect[] = []

      for (const activeEffect of entityEffects) {
        if (activeEffect.suspended) {
          updatedEffects.push(activeEffect)
          continue
        }

        const newRemainingDuration = Math.max(0,
          activeEffect.effect.remainingDuration - deltaTime
        ) as EffectDuration

        const shouldTick = Date.now() - activeEffect.lastUpdate.getTime() >= activeEffect.effect.tickInterval

        if (newRemainingDuration <= 0 && !activeEffect.effect.isInstant) {
          expiredEffects.push(activeEffect)
          continue
        }

        let updatedEffect = {
          ...activeEffect,
          effect: {
            ...activeEffect.effect,
            remainingDuration: newRemainingDuration
          },
          lastUpdate: shouldTick ? new Date() : activeEffect.lastUpdate,
          totalTicksApplied: shouldTick ? activeEffect.totalTicksApplied + 1 : activeEffect.totalTicksApplied
        }

        // Apply tick effects
        if (shouldTick && !activeEffect.effect.isInstant) {
          yield* applyEffectTick(entityId, updatedEffect.effect)
        }

        updatedEffects.push(updatedEffect)
      }

      // Handle expired effects
      for (const expiredEffect of expiredEffects) {
        yield* applyEffectExpiration(entityId, expiredEffect.effect)
      }

      yield* Ref.update(activeEffects, map => map.set(entityId, updatedEffects))

      return updatedEffects
    })

    const getActiveEffects = (entityId: string) => Effect.gen(function* () {
      const effectsMap = yield* Ref.get(activeEffects)
      return effectsMap.get(entityId) || []
    })

    const hasEffect = (
      entityId: string,
      effectType: PotionEffectType
    ) => Effect.gen(function* () {
      const entityEffects = yield* getActiveEffects(entityId)
      return entityEffects.some(e => e.effect.type === effectType)
    })

    const processEffectInteractions = (
      entityId: string,
      newEffect: PotionEffect
    ) => Effect.gen(function* () {
      const interactions = yield* Ref.get(effectInteractions)
      const entityEffects = yield* getActiveEffects(entityId)

      const resultEffects: PotionEffect[] = [newEffect]

      for (const interaction of interactions) {
        if (interaction.primaryEffect === newEffect.type) {
          const hasSecondary = entityEffects.some(e => e.effect.type === interaction.secondaryEffect)

          if (hasSecondary) {
            const modifiedEffect = yield* applyInteraction(newEffect, interaction)
            resultEffects[0] = modifiedEffect
          }
        }
      }

      return resultEffects
    })

    const calculateEffectModifiers = (
      entity: Entity,
      effects: ReadonlyArray<ActiveEffect>
    ) => Effect.gen(function* () {
      let modifiers: EntityModifiers = {
        movementSpeed: 1.0,
        attackDamage: 1.0,
        maxHealth: entity.maxHealth,
        armor: 0,
        attackSpeed: 1.0,
        luck: 0,
        jumpHeight: 1.0,
        visibility: 1.0,
        regenerationRate: 0
      }

      const templates = yield* Ref.get(effectTemplates)

      for (const activeEffect of effects) {
        const template = templates.get(activeEffect.effect.type)
        if (!template) continue

        const amplifier = activeEffect.effect.amplifier
        const potency = activeEffect.effect.potency

        modifiers = Match.value(activeEffect.effect.type).pipe(
          Match.when("speed", () => ({
            ...modifiers,
            movementSpeed: modifiers.movementSpeed * (1 + (0.2 * (amplifier + 1)) * potency)
          })),
          Match.when("slowness", () => ({
            ...modifiers,
            movementSpeed: modifiers.movementSpeed * Math.max(0.1, 1 - (0.15 * (amplifier + 1)) * potency)
          })),
          Match.when("strength", () => ({
            ...modifiers,
            attackDamage: modifiers.attackDamage + 3 * (amplifier + 1) * potency
          })),
          Match.when("weakness", () => ({
            ...modifiers,
            attackDamage: modifiers.attackDamage - 4 * (amplifier + 1) * potency
          })),
          Match.when("jump_boost", () => ({
            ...modifiers,
            jumpHeight: modifiers.jumpHeight + 0.5 * (amplifier + 1) * potency
          })),
          Match.when("haste", () => ({
            ...modifiers,
            attackSpeed: modifiers.attackSpeed * (1 + (0.1 * (amplifier + 1)) * potency)
          })),
          Match.when("mining_fatigue", () => ({
            ...modifiers,
            attackSpeed: modifiers.attackSpeed * Math.max(0.1, 1 - (0.3 * (amplifier + 1)) * potency)
          })),
          Match.when("resistance", () => ({
            ...modifiers,
            armor: modifiers.armor + 2 * (amplifier + 1) * potency
          })),
          Match.when("absorption", () => ({
            ...modifiers,
            maxHealth: modifiers.maxHealth + 4 * (amplifier + 1) * potency
          })),
          Match.when("health_boost", () => ({
            ...modifiers,
            maxHealth: modifiers.maxHealth + 4 * (amplifier + 1) * potency
          })),
          Match.when("luck", () => ({
            ...modifiers,
            luck: modifiers.luck + (amplifier + 1) * potency
          })),
          Match.when("bad_luck", () => ({
            ...modifiers,
            luck: modifiers.luck - (amplifier + 1) * potency
          })),
          Match.when("invisibility", () => ({
            ...modifiers,
            visibility: 0
          })),
          Match.when("glowing", () => ({
            ...modifiers,
            visibility: 2.0
          })),
          Match.when("regeneration", () => ({
            ...modifiers,
            regenerationRate: modifiers.regenerationRate + (amplifier + 1) * potency
          })),
          Match.orElse(() => modifiers)
        )
      }

      return modifiers
    })

    const clearAllEffects = (
      entityId: string,
      reason: ClearReason
    ) => Effect.gen(function* () {
      const entityEffects = yield* getActiveEffects(entityId)

      for (const activeEffect of entityEffects) {
        const template = yield* Effect.map(
          Ref.get(effectTemplates),
          templates => templates.get(activeEffect.effect.type)
        )

        // Only clear effects that can be cleared by this reason
        const canClear = reason === "milk" ? template?.removedByMilk ?? true :
                        reason === "death" ? true :
                        reason === "command" ? true :
                        false

        if (canClear) {
          yield* applyEffectRemovalSideEffects(entityId, activeEffect.effect.type)
        }
      }

      yield* Ref.update(activeEffects, map => {
        if (reason === "milk") {
          const filteredEffects = (map.get(entityId) || []).filter(e => {
            const template = effectTemplates.get(e.effect.type)
            return template && !template.removedByMilk
          })
          return map.set(entityId, filteredEffects)
        } else {
          return map.set(entityId, [])
        }
      })
    })

    const immunizeToEffect = (
      entityId: string,
      effectType: PotionEffectType,
      duration: number
    ) => Effect.gen(function* () {
      const endTime = Date.now() + duration

      yield* Ref.update(immunities, map => {
        const entityImmunities = map.get(entityId) || new Map()
        entityImmunities.set(effectType, endTime)
        return map.set(entityId, entityImmunities)
      })
    })

    return {
      applyEffect: (entityId, effect, world) => STM.commit(applyEffect(entityId, effect, world)),
      removeEffect,
      updateActiveEffects,
      getActiveEffects,
      hasEffect,
      processEffectInteractions,
      calculateEffectModifiers,
      clearAllEffects,
      immunizeToEffect
    } as const
  })
)
```

### Potion Brewing System

ポーション醸造システムです。

```typescript
// Potion Brewing System
interface PotionBrewingSystem {
  readonly startBrewing: (
    brewingStandId: string,
    ingredients: BrewingIngredients,
    fuelLevel: number
  ) => Effect.Effect<BrewingProcess, BrewingError>

  readonly updateBrewing: (
    processId: string,
    deltaTime: number
  ) => Effect.Effect<BrewingProcess, BrewingError>

  readonly completeBrewing: (
    processId: string
  ) => Effect.Effect<ReadonlyArray<PotionItem>, BrewingError>

  readonly createCustomPotion: (
    basePotion: PotionType,
    modifiers: ReadonlyArray<BrewingModifier>
  ) => Effect.Effect<PotionItem, BrewingError>

  readonly analyzeBrewingRecipe: (
    ingredient: string,
    basePotions: ReadonlyArray<PotionType>
  ) => Effect.Effect<ReadonlyArray<BrewingResult>, never>

  readonly calculateBrewingTime: (
    recipe: BrewingRecipe,
    efficiency: number
  ) => Effect.Effect<number, never>

  readonly validateBrewingCombination: (
    ingredients: BrewingIngredients
  ) => Effect.Effect<boolean, never>
}

export const PotionBrewingSystem = Context.GenericTag<PotionBrewingSystem>("@app/PotionBrewingSystem")

export const PotionBrewingSystemLive = Layer.effect(
  PotionBrewingSystem,
  Effect.gen(function* () {
    const activeBrewingProcesses = yield* Ref.make<Map<string, BrewingProcess>>(new Map())
    const brewingRecipes = yield* Ref.make<Map<string, BrewingRecipe>>(new Map())

    // Initialize brewing recipes
    yield* initializeBrewingRecipes()

    const startBrewing = (
      brewingStandId: string,
      ingredients: BrewingIngredients,
      fuelLevel: number
    ) => Effect.gen(function* () {
      if (fuelLevel <= 0) {
        return yield* Effect.fail(new BrewingError("No fuel in brewing stand"))
      }

      const isValid = yield* validateBrewingCombination(ingredients)
      if (!isValid) {
        return yield* Effect.fail(new BrewingError("Invalid brewing combination"))
      }

      const recipe = yield* findMatchingRecipe(ingredients)
      if (!recipe) {
        return yield* Effect.fail(new BrewingError("No recipe found for ingredients"))
      }

      const brewingTime = yield* calculateBrewingTime(recipe, 1.0)

      const process: BrewingProcess = {
        id: crypto.randomUUID(),
        brewingStandId,
        recipe,
        ingredients,
        startTime: new Date(),
        totalTime: brewingTime,
        remainingTime: brewingTime,
        fuelConsumed: 0,
        stage: "brewing",
        efficiency: 1.0,
        bubbleIntensity: 1.0,
        expectedResults: recipe.results
      }

      yield* Ref.update(activeBrewingProcesses, map => map.set(process.id, process))

      return process
    })

    const updateBrewing = (
      processId: string,
      deltaTime: number
    ) => Effect.gen(function* () {
      const processes = yield* Ref.get(activeBrewingProcesses)
      const process = processes.get(processId)

      if (!process) {
        return yield* Effect.fail(new BrewingError(`Process not found: ${processId}`))
      }

      const newRemainingTime = Math.max(0, process.remainingTime - deltaTime)
      const progress = 1 - (newRemainingTime / process.totalTime)

      // Calculate bubble intensity based on progress
      const bubbleIntensity = Math.sin(progress * Math.PI * 4) * 0.5 + 0.7

      // Calculate fuel consumption
      const fuelRate = 1 / 20000 // 1 fuel per 20 seconds
      const fuelConsumed = process.fuelConsumed + (deltaTime * fuelRate)

      const updatedProcess: BrewingProcess = {
        ...process,
        remainingTime: newRemainingTime,
        fuelConsumed,
        bubbleIntensity,
        stage: newRemainingTime <= 0 ? "complete" : "brewing"
      }

      yield* Ref.update(activeBrewingProcesses, map => map.set(processId, updatedProcess))

      // Generate brewing particles and sounds
      if (updatedProcess.stage === "brewing") {
        yield* generateBrewingEffects(process.brewingStandId, bubbleIntensity)
      }

      return updatedProcess
    })

    const completeBrewing = (processId: string) => Effect.gen(function* () {
      const processes = yield* Ref.get(activeBrewingProcesses)
      const process = processes.get(processId)

      if (!process) {
        return yield* Effect.fail(new BrewingError(`Process not found: ${processId}`))
      }

      if (process.stage !== "complete") {
        return yield* Effect.fail(new BrewingError("Brewing not complete"))
      }

      const results: PotionItem[] = []

      for (const expectedResult of process.expectedResults) {
        const potion = yield* createPotionFromResult(expectedResult, process.ingredients)
        results.push(potion)
      }

      // Remove process
      yield* Ref.update(activeBrewingProcesses, map => {
        map.delete(processId)
        return map
      })

      // Generate completion effects
      yield* generateBrewingCompletionEffects(process.brewingStandId)

      return results
    })

    const createCustomPotion = (
      basePotion: PotionType,
      modifiers: ReadonlyArray<BrewingModifier>
    ) => Effect.gen(function* () {
      let effects = getBasePotionEffects(basePotion)

      // Apply modifiers
      for (const modifier of modifiers) {
        effects = yield* applyModifierToEffects(effects, modifier)
      }

      const potion: PotionItem = {
        id: crypto.randomUUID(),
        type: "custom_potion",
        effects,
        color: calculatePotionColor(effects),
        name: generatePotionName(effects),
        description: generatePotionDescription(effects),
        rarity: calculatePotionRarity(effects),
        brewTime: Date.now(),
        brewer: "custom",
        splash: false,
        lingering: false,
        metadata: {}
      }

      return potion
    })

    const analyzeBrewingRecipe = (
      ingredient: string,
      basePotions: ReadonlyArray<PotionType>
    ) => Effect.gen(function* () {
      const recipes = yield* Ref.get(brewingRecipes)
      const results: BrewingResult[] = []

      for (const [recipeId, recipe] of recipes) {
        if (recipe.ingredient === ingredient) {
          for (const basePotion of basePotions) {
            if (recipe.validBasePotions.includes(basePotion)) {
              const result: BrewingResult = {
                recipeId,
                resultPotion: recipe.results[0]?.type || "water",
                brewingTime: recipe.brewingTime,
                successChance: recipe.successChance,
                bonusEffects: recipe.bonusEffects || []
              }
              results.push(result)
            }
          }
        }
      }

      return results
    })

    const calculateBrewingTime = (
      recipe: BrewingRecipe,
      efficiency: number
    ) => Effect.succeed(Math.max(1000, recipe.brewingTime / efficiency))

    const validateBrewingCombination = (ingredients: BrewingIngredients) => Effect.gen(function* () {
      // Check if ingredient is valid brewing material
      const validIngredients = [
        "nether_wart", "redstone", "glowstone", "gunpowder", "dragon_breath",
        "fermented_spider_eye", "magma_cream", "sugar", "rabbit_foot", "glistering_melon",
        "spider_eye", "golden_carrot", "blaze_powder", "ghast_tear", "turtle_helmet",
        "phantom_membrane", "pufferfish"
      ]

      if (!validIngredients.includes(ingredients.primaryIngredient)) {
        return false
      }

      // Check if base potions are valid
      for (const basePotion of ingredients.basePotions) {
        if (!isValidBasePotion(basePotion)) {
          return false
        }
      }

      return true
    })

    const initializeBrewingRecipes = () => Effect.gen(function* () {
      const recipes = new Map<string, BrewingRecipe>()

      // Basic potion recipes
      recipes.set("awkward_potion", {
        id: "awkward_potion",
        name: "Awkward Potion",
        ingredient: "nether_wart",
        validBasePotions: ["water"],
        results: [{
          type: "awkward",
          probability: 1.0
        }],
        brewingTime: 20000, // 20 seconds
        successChance: 1.0
      })

      recipes.set("healing_potion", {
        id: "healing_potion",
        name: "Potion of Healing",
        ingredient: "glistering_melon",
        validBasePotions: ["awkward"],
        results: [{
          type: "healing",
          probability: 1.0
        }],
        brewingTime: 20000,
        successChance: 1.0
      })

      recipes.set("strength_potion", {
        id: "strength_potion",
        name: "Potion of Strength",
        ingredient: "blaze_powder",
        validBasePotions: ["awkward"],
        results: [{
          type: "strength",
          probability: 1.0
        }],
        brewingTime: 20000,
        successChance: 1.0
      })

      recipes.set("swiftness_potion", {
        id: "swiftness_potion",
        name: "Potion of Swiftness",
        ingredient: "sugar",
        validBasePotions: ["awkward"],
        results: [{
          type: "swiftness",
          probability: 1.0
        }],
        brewingTime: 20000,
        successChance: 1.0
      })

      // Enhancement recipes
      recipes.set("enhanced_healing", {
        id: "enhanced_healing",
        name: "Potion of Healing II",
        ingredient: "glowstone",
        validBasePotions: ["healing"],
        results: [{
          type: "healing_enhanced",
          probability: 1.0
        }],
        brewingTime: 20000,
        successChance: 1.0
      })

      recipes.set("extended_strength", {
        id: "extended_strength",
        name: "Potion of Strength (Extended)",
        ingredient: "redstone",
        validBasePotions: ["strength"],
        results: [{
          type: "strength_extended",
          probability: 1.0
        }],
        brewingTime: 20000,
        successChance: 1.0
      })

      yield* Ref.set(brewingRecipes, recipes)
    })

    return {
      startBrewing,
      updateBrewing,
      completeBrewing,
      createCustomPotion,
      analyzeBrewingRecipe,
      calculateBrewingTime,
      validateBrewingCombination
    } as const
  })
)
```

### Effect Visualization System

エフェクト視覚化システムです。

```typescript
// Effect Visualization System
interface EffectVisualizationSystem {
  readonly renderEffectParticles: (
    entity: Entity,
    effects: ReadonlyArray<ActiveEffect>,
    camera: CameraState
  ) => Effect.Effect<ParticleRenderData, never>

  readonly updateEffectVisuals: (
    entity: Entity,
    effects: ReadonlyArray<ActiveEffect>,
    deltaTime: number
  ) => Effect.Effect<VisualEffectState, never>

  readonly createEffectStatusIcons: (
    effects: ReadonlyArray<ActiveEffect>,
    uiContext: UIContext
  ) => Effect.Effect<ReadonlyArray<StatusIcon>, never>

  readonly generateEffectSounds: (
    entity: Entity,
    effect: ActiveEffect,
    eventType: EffectSoundEvent
  ) => Effect.Effect<ReadonlyArray<AudioEffect>, never>

  readonly calculateEffectScreenOverlay: (
    effects: ReadonlyArray<ActiveEffect>,
    screenSize: { width: number; height: number }
  ) => Effect.Effect<ScreenOverlay, never>

  readonly animateEffectTransition: (
    fromEffects: ReadonlyArray<ActiveEffect>,
    toEffects: ReadonlyArray<ActiveEffect>,
    duration: number
  ) => Effect.Effect<EffectTransitionAnimation, never>
}

export const EffectVisualizationSystem = Context.GenericTag<EffectVisualizationSystem>("@app/EffectVisualizationSystem")

export const EffectVisualizationSystemLive = Layer.effect(
  EffectVisualizationSystem,
  Effect.gen(function* () {
    const particleSystems = yield* Ref.make<Map<string, EffectParticleSystem>>(new Map())
    const visualStates = yield* Ref.make<Map<string, VisualEffectState>>(new Map())

    const renderEffectParticles = (
      entity: Entity,
      effects: ReadonlyArray<ActiveEffect>,
      camera: CameraState
    ) => Effect.gen(function* () {
      const particles: ParticleData[] = []

      for (const activeEffect of effects) {
        if (!activeEffect.effect.showParticles) continue

        const particleConfig = getEffectParticleConfig(activeEffect.effect.type)
        const particleCount = calculateParticleCount(
          activeEffect.effect.amplifier,
          activeEffect.effect.potency,
          camera.distance
        )

        // Generate particles around entity
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2
          const radius = 0.5 + Math.random() * 0.3

          const particle: ParticleData = {
            id: `${activeEffect.effect.id}_${i}`,
            type: particleConfig.type,
            position: {
              x: entity.position.x + Math.cos(angle) * radius,
              y: entity.position.y + Math.random() * 2,
              z: entity.position.z + Math.sin(angle) * radius
            },
            velocity: {
              x: (Math.random() - 0.5) * 0.1,
              y: 0.05 + Math.random() * 0.1,
              z: (Math.random() - 0.5) * 0.1
            },
            color: particleConfig.color,
            size: particleConfig.baseSize * (0.8 + Math.random() * 0.4),
            lifespan: particleConfig.lifespan,
            gravity: particleConfig.gravity,
            opacity: calculateParticleOpacity(activeEffect)
          }

          particles.push(particle)
        }
      }

      return {
        particles,
        entityId: entity.id,
        timestamp: Date.now(),
        screenSpaceEffects: calculateScreenSpaceEffects(effects),
        distortionEffects: calculateDistortionEffects(effects)
      }
    })

    const updateEffectVisuals = (
      entity: Entity,
      effects: ReadonlyArray<ActiveEffect>,
      deltaTime: number
    ) => Effect.gen(function* () {
      const currentState = yield* Effect.map(
        Ref.get(visualStates),
        states => states.get(entity.id) || createDefaultVisualState()
      )

      let updatedState = { ...currentState }

      // Update visual timers
      updatedState.animationTime += deltaTime
      updatedState.pulsePhase = (updatedState.animationTime / 1000) % (Math.PI * 2)

      // Calculate combined visual effects
      let brightness = 1.0
      let saturation = 1.0
      let hue = 0
      let distortion = 0
      const overlayColors: ColorOverlay[] = []

      for (const activeEffect of effects) {
        const template = getEffectTemplate(activeEffect.effect.type)

        const effectResult = Match.value(activeEffect.effect.type).pipe(
          Match.when("night_vision", () => ({
            brightness: Math.max(brightness, 1.5),
            saturation,
            hue,
            distortion,
            updatedState,
            overlayColors: [...overlayColors, {
              color: { r: 0, g: 100, b: 200, a: 0.1 },
              blendMode: "overlay" as const
            }]
          })),
          Match.when("blindness", () => ({
            brightness: Math.min(brightness, 0.1),
            saturation,
            hue,
            distortion,
            updatedState,
            overlayColors: [...overlayColors, {
              color: { r: 0, g: 0, b: 0, a: 0.8 },
              blendMode: "multiply" as const
            }]
          })),
          Match.when("nausea", () => ({
            brightness,
            saturation,
            hue: hue + Math.sin(updatedState.pulsePhase * 3) * 30,
            distortion: Math.max(distortion, 0.5),
            updatedState,
            overlayColors
          })),
          Match.when("invisibility", () => ({
            brightness,
            saturation,
            hue,
            distortion,
            updatedState: {
              ...updatedState,
              transparency: Math.max(updatedState.transparency, 0.8)
            },
            overlayColors
          })),
          Match.when("glowing", () => ({
            brightness,
            saturation,
            hue,
            distortion,
            updatedState: {
              ...updatedState,
              glowIntensity: Math.max(updatedState.glowIntensity, 1.5)
            },
            overlayColors
          })),
          Match.when("darkness", () => ({
            brightness: Math.min(brightness, 0.2),
            saturation,
            hue,
            distortion,
            updatedState,
            overlayColors: [...overlayColors, {
              color: { r: 0, g: 0, b: 20, a: 0.7 },
              blendMode: "multiply" as const
            }]
          })),
          Match.when("poison", () => ({
            brightness,
            saturation: Math.min(saturation, 0.7),
            hue,
            distortion,
            updatedState,
            overlayColors: [...overlayColors, {
              color: { r: 0, g: template?.color.g || 0, b: 0, a: 0.1 },
              blendMode: "overlay" as const
            }]
          })),
          Match.when("wither", () => ({
            brightness,
            saturation: Math.min(saturation, 0.7),
            hue,
            distortion,
            updatedState,
            overlayColors: [...overlayColors, {
              color: { r: 0, g: template?.color.g || 0, b: 0, a: 0.1 },
              blendMode: "overlay" as const
            }]
          })),
          Match.orElse(() => ({
            brightness,
            saturation,
            hue,
            distortion,
            updatedState,
            overlayColors
          }))
        )

        brightness = effectResult.brightness
        saturation = effectResult.saturation
        hue = effectResult.hue
        distortion = effectResult.distortion
        updatedState = effectResult.updatedState
        overlayColors.splice(0, overlayColors.length, ...effectResult.overlayColors)
      }

      updatedState = {
        ...updatedState,
        brightness,
        saturation,
        hue,
        distortion,
        overlayColors,
        lastUpdate: Date.now()
      }

      yield* Ref.update(visualStates, states => states.set(entity.id, updatedState))

      return updatedState
    })

    const createEffectStatusIcons = (
      effects: ReadonlyArray<ActiveEffect>,
      uiContext: UIContext
    ) => Effect.gen(function* () {
      const icons: StatusIcon[] = []

      const sortedEffects = [...effects].sort((a, b) => {
        // Sort by category (beneficial first), then by remaining time
        const categoryOrder = { beneficial: 0, neutral: 1, harmful: 2, instant: 3 }
        const aOrder = categoryOrder[a.effect.category]
        const bOrder = categoryOrder[b.effect.category]

        if (aOrder !== bOrder) return aOrder - bOrder
        return b.effect.remainingDuration - a.effect.remainingDuration
      })

      for (const [index, activeEffect] of sortedEffects.entries()) {
        if (!activeEffect.effect.showIcon) continue

        const template = getEffectTemplate(activeEffect.effect.type)
        if (!template) continue

        const remainingSeconds = Math.ceil(activeEffect.effect.remainingDuration / 1000)
        const amplifierText = activeEffect.effect.amplifier > 0 ?
          ` ${toRomanNumeral(activeEffect.effect.amplifier + 1)}` : ""

        const icon: StatusIcon = {
          id: activeEffect.effect.id,
          texture: `effect_${activeEffect.effect.type}`,
          position: {
            x: uiContext.effectIconStartX + (index % 8) * 24,
            y: uiContext.effectIconStartY + Math.floor(index / 8) * 24
          },
          size: 20,
          color: template.color,
          tooltip: {
            title: `${template.displayName}${amplifierText}`,
            description: template.description,
            duration: activeEffect.effect.isInstant ? "Instant" : formatDuration(remainingSeconds),
            amplifier: activeEffect.effect.amplifier
          },
          blinking: remainingSeconds <= 5 && !activeEffect.effect.isInstant,
          opacity: activeEffect.effect.isAmbient ? 0.6 : 1.0
        }

        icons.push(icon)
      }

      return icons
    })

    const generateEffectSounds = (
      entity: Entity,
      effect: ActiveEffect,
      eventType: EffectSoundEvent
    ) => Effect.gen(function* () {
      const sounds: AudioEffect[] = []

      const soundConfig = getEffectSoundConfig(effect.effect.type)
      if (!soundConfig) return sounds

      const soundsToAdd = Match.value(eventType).pipe(
        Match.when("applied", () => {
          if (soundConfig.applySound) {
            return [{
              id: crypto.randomUUID(),
              soundId: soundConfig.applySound,
              position: entity.position,
              volume: 0.7,
              pitch: 1.0 + (Math.random() - 0.5) * 0.2,
              category: "player" as const
            }]
          }
          return []
        }),
        Match.when("tick", () => {
          if (soundConfig.tickSound && Math.random() < soundConfig.tickChance) {
            return [{
              id: crypto.randomUUID(),
              soundId: soundConfig.tickSound,
              position: entity.position,
              volume: 0.3,
              pitch: 0.8 + (Math.random() * 0.4),
              category: "ambient" as const
            }]
          }
          return []
        }),
        Match.when("expired", () => {
          if (soundConfig.expireSound) {
            return [{
              id: crypto.randomUUID(),
              soundId: soundConfig.expireSound,
              position: entity.position,
              volume: 0.5,
              pitch: 1.0,
              category: "player" as const
            }]
          }
          return []
        }),
        Match.orElse(() => [])
      )

      sounds.push(...soundsToAdd)

      return sounds
    })

    const calculateEffectScreenOverlay = (
      effects: ReadonlyArray<ActiveEffect>,
      screenSize: { width: number; height: number }
    ) => Effect.gen(function* () {
      const overlays: ScreenOverlayLayer[] = []

      for (const activeEffect of effects) {
        const overlayToAdd = Match.value(activeEffect.effect.type).pipe(
          Match.when("fire_resistance", () => ({
            // Fire immunity border effect
            type: "border" as const,
            color: { r: 255, g: 100, b: 0, a: 0.3 },
            thickness: 4,
            animationSpeed: 2000
          })),
          Match.when("water_breathing", () => ({
            // Bubble effect around screen edges
            type: "particles" as const,
            particleType: "bubble",
            density: 0.3,
            area: "edges" as const
          })),
          Match.when("levitation", () => ({
            // Floating particles
            type: "particles" as const,
            particleType: "levitation",
            density: 0.5,
            area: "full" as const,
            direction: "up" as const
          })),
          Match.when("slow_falling", () => ({
            // Feather particles
            type: "particles" as const,
            particleType: "feather",
            density: 0.2,
            area: "full" as const,
            direction: "down_slow" as const
          })),
          Match.orElse(() => null)
        )

        if (overlayToAdd) {
          overlays.push(overlayToAdd)
        }
      }

      return {
        layers: overlays,
        screenSize,
        timestamp: Date.now()
      }
    })

    return {
      renderEffectParticles,
      updateEffectVisuals,
      createEffectStatusIcons,
      generateEffectSounds,
      calculateEffectScreenOverlay,
      animateEffectTransition: (from, to, duration) => animateEffectTransitionImpl(from, to, duration)
    } as const
  })
)
```

## Layer構成

```typescript
// Potion Effects System Layer
export const PotionEffectsSystemLayer = Layer.mergeAll(
  PotionEffectsEngineLive,
  PotionBrewingSystemLive,
  EffectVisualizationSystemLive
).pipe(
  Layer.provide(WorldSystemLayer),
  Layer.provide(EventBusLayer),
  Layer.provide(InventorySystemLayer),
  Layer.provide(ParticleSystemLayer)
)
```

## 使用例

```typescript
// Potion Effects System の使用例
const examplePotionEffects = Effect.gen(function* () {
  const effectsEngine = yield* PotionEffectsEngine
  const brewingSystem = yield* PotionBrewingSystem
  const visualSystem = yield* EffectVisualizationSystem

  // プレイヤーエンティティ
  const player: Entity = {
    id: "player_001",
    type: "player",
    position: { x: 100, y: 64, z: 100 },
    velocity: { x: 0, y: 0, z: 0 },
    health: 20,
    maxHealth: 20
  }

  // 速度上昇効果の作成と適用
  const speedEffect: PotionEffect = {
    id: crypto.randomUUID(),
    type: "speed",
    amplifier: 1 as EffectAmplifier, // Speed II
    duration: 180000 as EffectDuration, // 3 minutes
    remainingDuration: 180000 as EffectDuration,
    category: "beneficial",
    isInstant: false,
    showParticles: true,
    showIcon: true,
    isAmbient: false,
    source: {
      type: "potion",
      sourceId: "speed_potion_001"
    },
    potency: 1.0 as EffectPotency,
    stackable: false,
    overridable: true,
    createdAt: new Date(),
    lastTick: new Date(),
    tickInterval: 1000,
    metadata: {}
  }

  const world = yield* WorldSystem
  const activeEffect = yield* effectsEngine.applyEffect(player.id, speedEffect, world)

  yield* Effect.log(`Applied Speed II effect to player for ${speedEffect.duration / 1000} seconds`)

  // 効果の確認
  const hasSpeed = yield* effectsEngine.hasEffect(player.id, "speed")
  yield* Effect.log(`Player has speed effect: ${hasSpeed}`)

  // エンティティ修飾子の計算
  const playerEffects = yield* effectsEngine.getActiveEffects(player.id)
  const modifiers = yield* effectsEngine.calculateEffectModifiers(player, playerEffects)

  yield* Effect.log(`Movement speed modifier: ${modifiers.movementSpeed}x`)

  // 複数の効果を適用して相互作用をテスト
  const strengthEffect: PotionEffect = {
    id: crypto.randomUUID(),
    type: "strength",
    amplifier: 0 as EffectAmplifier, // Strength I
    duration: 120000 as EffectDuration,
    remainingDuration: 120000 as EffectDuration,
    category: "beneficial",
    isInstant: false,
    showParticles: true,
    showIcon: true,
    isAmbient: false,
    source: {
      type: "potion",
      sourceId: "strength_potion_001"
    },
    potency: 1.0 as EffectPotency,
    stackable: false,
    overridable: true,
    createdAt: new Date(),
    lastTick: new Date(),
    tickInterval: 1000,
    metadata: {}
  }

  yield* effectsEngine.applyEffect(player.id, strengthEffect, world)
  yield* Effect.log("Applied Strength I effect")

  // 効果の更新（時間経過シミュレーション）
  for (let i = 0; i < 10; i++) {
    yield* effectsEngine.updateActiveEffects(player.id, 1000) // 1秒ずつ
    yield* Effect.sleep(100) // シミュレーション用の短い待機
  }

  const updatedEffects = yield* effectsEngine.getActiveEffects(player.id)
  yield* Effect.log(`Effects after 10 seconds: ${updatedEffects.length} active`)
  updatedEffects.forEach((effect, i) => {
    const remainingSec = Math.ceil(effect.effect.remainingDuration / 1000)
    yield* Effect.log(`  ${i + 1}. ${effect.effect.type}: ${remainingSec}s remaining`)
  })

  // ポーション醸造のテスト
  const brewingIngredients: BrewingIngredients = {
    primaryIngredient: "sugar",
    basePotions: ["awkward"],
    secondaryIngredients: []
  }

  const brewingProcess = yield* brewingSystem.startBrewing(
    "brewing_stand_001",
    brewingIngredients,
    20 // Fuel level
  )

  yield* Effect.log(`Started brewing process: ${brewingProcess.id}`)
  yield* Effect.log(`Expected brewing time: ${brewingProcess.totalTime / 1000} seconds`)

  // 醸造進行のシミュレーション
  let currentProcess = brewingProcess
  while (currentProcess.stage === "brewing") {
    yield* Effect.sleep(1000)
    currentProcess = yield* brewingSystem.updateBrewing(currentProcess.id, 1000)
    const progress = ((currentProcess.totalTime - currentProcess.remainingTime) / currentProcess.totalTime * 100).toFixed(1)
    yield* Effect.log(`Brewing progress: ${progress}%`)
  }

  if (currentProcess.stage === "complete") {
    const results = yield* brewingSystem.completeBrewing(currentProcess.id)
    yield* Effect.log(`Brewing complete! Produced ${results.length} potions`)
    results.forEach((potion, i) => {
      yield* Effect.log(`  ${i + 1}. ${potion.name} (${potion.type})`)
    })
  }

  // 視覚効果のテスト
  const camera: CameraState = {
    position: { x: 100, y: 70, z: 105 },
    rotation: { x: 0, y: 0, z: 0 },
    distance: 5,
    fieldOfView: 70,
    latitude: 0
  }

  const particleData = yield* visualSystem.renderEffectParticles(player, updatedEffects, camera)
  yield* Effect.log(`Generated ${particleData.particles.length} effect particles`)

  // ステータスアイコンの生成
  const uiContext: UIContext = {
    effectIconStartX: 10,
    effectIconStartY: 10,
    screenWidth: 1920,
    screenHeight: 1080
  }

  const statusIcons = yield* visualSystem.createEffectStatusIcons(updatedEffects, uiContext)
  yield* Effect.log(`Created ${statusIcons.length} status icons`)

  // 牛乳で効果をクリア
  yield* effectsEngine.clearAllEffects(player.id, "milk")
  const remainingEffects = yield* effectsEngine.getActiveEffects(player.id)
  yield* Effect.log(`Effects after drinking milk: ${remainingEffects.length}`)

  return updatedEffects
})

// カスタムポーションの作成例
const createCustomPotion = Effect.gen(function* () {
  const brewingSystem = yield* PotionBrewingSystem

  const modifiers: ReadonlyArray<BrewingModifier> = [
    {
      type: "amplify",
      targetEffect: "speed",
      value: 2 // +2 amplifier levels
    },
    {
      type: "extend",
      targetEffect: "speed",
      value: 1.5 // 1.5x duration
    },
    {
      type: "add_effect",
      targetEffect: "jump_boost",
      value: 1 // Jump Boost I
    }
  ]

  const customPotion = yield* brewingSystem.createCustomPotion("speed", modifiers)

  yield* Effect.log(`Created custom potion: ${customPotion.name}`)
  yield* Effect.log(`Effects:`)
  customPotion.effects.forEach(effect => {
    yield* Effect.log(`  - ${effect.type} ${effect.amplifier + 1} (${effect.duration / 1000}s)`)
  })

  return customPotion
})
```

## パフォーマンス最適化

### 効果更新の最適化

```typescript
// 効果更新のバッチ処理
export const batchUpdateEffects = (
  entityIds: ReadonlyArray<string>,
  deltaTime: number
) => Effect.gen(function* () {
  const effectsEngine = yield* PotionEffectsEngine

  const batches = chunkArray(entityIds, 50) // 50エンティティずつ処理

  for (const batch of batches) {
    yield* Effect.forEach(
      batch,
      entityId => effectsEngine.updateActiveEffects(entityId, deltaTime),
      { concurrency: 8 }
    )

    yield* Effect.sleep(1) // 短い待機でCPU使用率を制御
  }
})
```

### パーティクル最適化

```typescript
// 距離ベースのパーティクル品質調整
export const adaptiveParticleRendering = (
  entities: ReadonlyArray<Entity>,
  camera: CameraState,
  performanceBudget: number
) => Effect.gen(function* () {
  const visualSystem = yield* EffectVisualizationSystem

  // 距離でソート
  const entitiesByDistance = entities.sort((a, b) => {
    const distA = calculateDistance(a.position, camera.position)
    const distB = calculateDistance(b.position, camera.position)
    return distA - distB
  })

  let currentCost = 0

  for (const entity of entitiesByDistance) {
    const distance = calculateDistance(entity.position, camera.position)
    const effects = yield* PotionEffectsEngine.pipe(
      Effect.flatMap(engine => engine.getActiveEffects(entity.id))
    )

    if (effects.length === 0) continue

    // 距離に基づく品質調整
    let qualityScale = 1.0
    if (distance > 10) qualityScale = 0.5
    if (distance > 20) qualityScale = 0.2
    if (distance > 50) continue // 遠すぎる場合はスキップ

    const estimatedCost = effects.length * qualityScale
    if (currentCost + estimatedCost > performanceBudget) break

    yield* visualSystem.renderEffectParticles(entity, effects, camera)
    currentCost += estimatedCost
  }
})
```

## テスト戦略

```typescript
describe("Potion Effects System", () => {
  const TestPotionEffectsLayer = Layer.mergeAll(
    PotionEffectsSystemLayer,
    TestWorldLayer,
    TestParticleSystemLayer
  )

  it("should apply and manage effects correctly", () =>
    Effect.gen(function* () {
      const effectsEngine = yield* PotionEffectsEngine

      const testEffect: PotionEffect = {
        id: "test_effect",
        type: "speed",
        amplifier: 1 as EffectAmplifier,
        duration: 60000 as EffectDuration,
        remainingDuration: 60000 as EffectDuration,
        category: "beneficial",
        isInstant: false,
        showParticles: true,
        showIcon: true,
        isAmbient: false,
        source: { type: "potion" },
        potency: 1.0 as EffectPotency,
        stackable: false,
        overridable: true,
        createdAt: new Date(),
        lastTick: new Date(),
        tickInterval: 1000,
        metadata: {}
      }

      const world = createTestWorld()
      const activeEffect = yield* effectsEngine.applyEffect("test_entity", testEffect, world)

      expect(activeEffect.effect.type).toBe("speed")
      expect(activeEffect.targetEntityId).toBe("test_entity")

      const hasEffect = yield* effectsEngine.hasEffect("test_entity", "speed")
      expect(hasEffect).toBe(true)
    }).pipe(
      Effect.provide(TestPotionEffectsLayer),
      Effect.runPromise
    ))

  it("should update effect durations correctly", () =>
    Effect.gen(function* () {
      const effectsEngine = yield* PotionEffectsEngine

      const testEffect = createTestPotionEffect("regeneration", 5000) // 5 seconds
      const world = createTestWorld()

      yield* effectsEngine.applyEffect("test_entity", testEffect, world)

      // Update by 2 seconds
      const updatedEffects = yield* effectsEngine.updateActiveEffects("test_entity", 2000)
      expect(updatedEffects[0].effect.remainingDuration).toBe(3000)

      // Update by another 4 seconds (should expire)
      const finalEffects = yield* effectsEngine.updateActiveEffects("test_entity", 4000)
      expect(finalEffects.length).toBe(0)
    }).pipe(
      Effect.provide(TestPotionEffectsLayer),
      Effect.runPromise
    ))

  it("should calculate effect modifiers correctly", () =>
    Effect.gen(function* () {
      const effectsEngine = yield* PotionEffectsEngine

      const testEntity: Entity = {
        id: "test_entity",
        type: "player",
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        health: 20,
        maxHealth: 20
      }

      const speedEffect = createTestPotionEffect("speed", 60000, 1 as EffectAmplifier)
      const world = createTestWorld()

      yield* effectsEngine.applyEffect("test_entity", speedEffect, world)
      const effects = yield* effectsEngine.getActiveEffects("test_entity")
      const modifiers = yield* effectsEngine.calculateEffectModifiers(testEntity, effects)

      expect(modifiers.movementSpeed).toBeGreaterThan(1.0)
    }).pipe(
      Effect.provide(TestPotionEffectsLayer),
      Effect.runPromise
    ))

  it("should brew potions correctly", () =>
    Effect.gen(function* () {
      const brewingSystem = yield* PotionBrewingSystem

      const ingredients: BrewingIngredients = {
        primaryIngredient: "sugar",
        basePotions: ["awkward"],
        secondaryIngredients: []
      }

      const process = yield* brewingSystem.startBrewing("test_stand", ingredients, 20)
      expect(process.stage).toBe("brewing")

      // Complete the brewing
      const updatedProcess = yield* brewingSystem.updateBrewing(process.id, process.totalTime)
      expect(updatedProcess.stage).toBe("complete")

      const results = yield* brewingSystem.completeBrewing(process.id)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe("swiftness")
    }).pipe(
      Effect.provide(TestPotionEffectsLayer),
      Effect.runPromise
    ))
})
```

このPotion Effects Systemは、Minecraftの世界に多様で複雑なステータス効果システムを提供します。Effect-TSの関数型プログラミングパターンを活用することで、効果の相互作用と視覚化を一貫性を保ちながら実装し、プレイヤーに豊富な戦略的選択肢を提供します。