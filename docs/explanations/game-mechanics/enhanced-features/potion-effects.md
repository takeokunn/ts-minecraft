---
title: "07 ポーション効果"
description: "07 ポーション効果に関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ["typescript", "minecraft", "effect-ts", "specification"]
prerequisites: ["basic-typescript"]
estimated_reading_time: "30分"
---


# ポーション効果システム

ポーション効果システムは、TypeScript Minecraft cloneにおけるエンティティの一時的および永続的なステータス効果を提供します。Effect-TS 3.17+の関数型アーキテクチャとDDDレイヤー分離で構築され、型安全性と予測可能な動作を維持しながら、複雑な効果相互作用、醸造メカニクス、視覚的フィードバックを管理します。

## システム概要と責任

ポーション効果システムは、プレイヤーシステムとクラフトシステムの上に構築された拡張機能として、以下を提供します：

- **効果定義・管理**: 増幅と持続時間制御を含む包括的な効果タイプ定義
- **醸造メカニクス**: レシピ検証と進行を含む完全な醸造台機能
- **効果適用ロジック**: 型安全な効果重複、上書き、削除メカニズム
- **効果相互作用**: 競合、強化、中和を含む複雑な相互作用パターン
- **視覚統合**: パーティクルシステム、UIオーバーレイ、画面効果
- **ステータス計算**: エンティティ属性（速度、ダメージ、体力）のリアルタイム変更
- **永続化**: 効果のシリアライゼーションとワールドセーブ統合
- **パフォーマンス最適化**: Structure of Arraysパターンを用いたECS統合

### アーキテクチャ概要

```
Domain/
├── PotionEffect/         # 効果の核となる定義と計算
├── BrewingSystem/        # 醸造メカニクスとレシピ
├── EffectInteraction/    # 複雑な相互作用ルールと解決
└── StatusCalculation/    # 属性変更のための純粋関数

Application/
├── EffectManager/        # 効果のライフサイクル管理
├── BrewingProcess/       # 醸造ワークフローの調整
├── EffectApplication/    # 適用戦略と検証
└── EffectPersistence/    # 保存/読み込み調整

Infrastructure/
├── EffectStorage/        # データ永続化実装
├── ParticleRenderer/     # 視覚効果レンダリング
├── EffectTimer/          # 時間ベース効果管理
└── PerformanceCache/     # 最適化とキャッシュ
```

## 効果定義システム

### 核となる効果タイプ

```typescript
// ドメイン層 - 効果タイプ定義
const PotionEffectType = Schema.Literal(
  "Speed", "Slowness", "Haste", "MiningFatigue",
  "Strength", "InstantHealth", "InstantDamage", "JumpBoost",
  "Nausea", "Regeneration", "Resistance", "FireResistance",
  "WaterBreathing", "Invisibility", "Blindness", "NightVision",
  "Hunger", "Weakness", "Poison", "Wither",
  "HealthBoost", "Absorption", "Saturation", "Glowing",
  "Levitation", "Luck", "Unluck", "SlowFalling",
  "ConduitPower", "DolphinsGrace", "BadOmen", "HeroOfTheVillage"
)

type PotionEffectType = Schema.Schema.Type<typeof PotionEffectType>

// 効果インスタンス定義
const PotionEffect = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("EffectId")),
  type: PotionEffectType,
  amplifier: Schema.Number.pipe(
    Schema.clamp(0, 255),
    Schema.brand("EffectAmplifier")
  ),
  duration: Schema.Number.pipe(
    Schema.positive(),
    Schema.brand("EffectDuration") // ティック単位 (1 tick = 50ms)
  ),
  remainingDuration: Schema.Number.pipe(Schema.brand("EffectDuration")),
  showParticles: Schema.Boolean.pipe(Schema.default(true)),
  showIcon: Schema.Boolean.pipe(Schema.default(true)),
  ambient: Schema.Boolean.pipe(Schema.default(false)), // ビーコン効果
  source: Schema.Struct({
    type: Schema.Literal("Potion", "Splash", "Lingering", "Arrow", "Beacon", "Food", "Command", "Natural"),
    sourceId: Schema.optional(Schema.String),
    appliedBy: Schema.optional(Schema.String) // この効果を適用したエンティティID
  }),
  hiddenEffect: Schema.optional(PotionEffectType), // 怪しげなシチュー用
  factorData: Schema.optional(Schema.Record(Schema.String, Schema.Number))
})

type PotionEffect = Schema.Schema.Type<typeof PotionEffect>

// 効果プロパティテンプレート
const EffectProperties = Schema.Struct({
  type: PotionEffectType,
  category: Schema.Literal("Beneficial", "Harmful", "Neutral"),
  instant: Schema.Boolean,
  color: Schema.Struct({
    r: Schema.Number.pipe(Schema.clamp(0, 255)),
    g: Schema.Number.pipe(Schema.clamp(0, 255)),
    b: Schema.Number.pipe(Schema.clamp(0, 255))
  }),
  baseValue: Schema.Number,
  scalingFactor: Schema.Number,
  maxAmplifier: Schema.Number.pipe(Schema.default(3)),
  tickInterval: Schema.Number.pipe(Schema.default(20)), // 適用間隔（ティック）
  conflictsWith: Schema.Array(PotionEffectType),
  enhancesWith: Schema.Array(PotionEffectType),
  neutralizesWith: Schema.Array(PotionEffectType)
})

type EffectProperties = Schema.Schema.Type<typeof EffectProperties>
```

### 純粋効果計算

```typescript
// 効果値計算のための純粋関数
const calculateEffectValue = (
  effect: PotionEffect,
  properties: EffectProperties
): number => {
  const amplifierMultiplier = effect.amplifier + 1
  return properties.baseValue + (properties.scalingFactor * amplifierMultiplier)
}

// 持続時間計算
const calculateRemainingTicks = (
  effect: PotionEffect,
  currentTick: number,
  startTick: number
): number => Math.max(0, effect.duration - (currentTick - startTick))

// 効果強度比較
const compareEffectStrength = (
  effect1: PotionEffect,
  effect2: PotionEffect
): number => {
  if (effect1.type !== effect2.type) return 0

  const amplifierDiff = effect1.amplifier - effect2.amplifier
  if (amplifierDiff !== 0) return amplifierDiff

  return effect1.remainingDuration - effect2.remainingDuration
}

// 効果適用可能性チェック
const canApplyEffect = (
  newEffect: PotionEffect,
  existingEffects: readonly PotionEffect[],
  properties: EffectProperties
): boolean => {
  const conflicting = existingEffects.find(existing =>
    properties.conflictsWith.includes(existing.type)
  )

  if (conflicting) return false

  const sameType = existingEffects.find(existing =>
    existing.type === newEffect.type
  )

  if (!sameType) return true

  return compareEffectStrength(newEffect, sameType) > 0
}
```

## ポーション醸造システム

### 醸造レシピ定義

```typescript
// 醸造材料タイプ
const BrewingIngredient = Schema.Struct({
  type: Schema.Literal(
    "NetherWart", "RedstoneDust", "GlowstoneDust", "Gunpowder", "DragonBreath",
    "FermentedSpiderEye", "MagmaCream", "Sugar", "RabbitFoot", "GlisteringMelon",
    "SpiderEye", "GoldenCarrot", "BlazePowder", "GhastTear", "TurtleHelmet",
    "PhantomMembrane", "Pufferfish", "GoldIngot", "Redstone"
  ),
  count: Schema.Number.pipe(Schema.positive(), Schema.default(1)),
  nbt: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

type BrewingIngredient = Schema.Schema.Type<typeof BrewingIngredient>

// 醸造レシピ構造
const BrewingRecipe = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("RecipeId")),
  name: Schema.String,
  ingredient: BrewingIngredient,
  basePotion: Schema.Literal("Water", "Awkward", "Thick", "Mundane"),
  resultPotion: Schema.Struct({
    type: PotionEffectType,
    amplifier: Schema.Number.pipe(Schema.default(0)),
    duration: Schema.Number.pipe(Schema.default(3600)) // 3分間（ティック単位）
  }),
  brewingTime: Schema.Number.pipe(Schema.default(400)), // 20秒間（ティック単位）
  fuelCost: Schema.Number.pipe(Schema.default(1)),
  successRate: Schema.Number.pipe(Schema.clamp(0, 1), Schema.default(1))
})

type BrewingRecipe = Schema.Schema.Type<typeof BrewingRecipe>

// ポーション変更タイプ
const PotionModification = Schema.Literal("Extended", "Enhanced", "Splash", "Lingering")
type PotionModification = Schema.Schema.Type<typeof PotionModification>

const ModificationRecipe = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("ModificationId")),
  baseEffectType: PotionEffectType,
  modification: PotionModification,
  ingredient: BrewingIngredient,
  durationMultiplier: Schema.Number.pipe(Schema.default(1)),
  amplifierBonus: Schema.Number.pipe(Schema.default(0)),
  splashRadius: Schema.optional(Schema.Number),
  lingeringDuration: Schema.optional(Schema.Number)
})

type ModificationRecipe = Schema.Schema.Type<typeof ModificationRecipe>
```

### 醸造台管理

```typescript
// アプリケーション層 - 醸造プロセス
interface BrewingSystemInterface {
  readonly startBrewing: (
    stationId: string,
    ingredients: BrewingIngredients,
    recipe: BrewingRecipe
  ) => Effect.Effect<BrewingProcess, BrewingError>

  readonly updateBrewing: (
    processId: string,
    deltaTicks: number
  ) => Effect.Effect<BrewingProcess, BrewingError>

  readonly completeBrewing: (
    processId: string
  ) => Effect.Effect<readonly PotionItem[], BrewingError>

  readonly validateRecipe: (
    ingredients: BrewingIngredients
  ) => Effect.Effect<Option.Option<BrewingRecipe>, never>

  readonly calculateBrewingTime: (
    recipe: BrewingRecipe,
    efficiency: number
  ) => Effect.Effect<number, never>
}

const BrewingSystem = Context.GenericTag<BrewingSystemInterface>("@app/BrewingSystem")

// 醸造台状態
const BrewingStation = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("BrewingStationId")),
  position: Position,
  fuel: Schema.Number.pipe(Schema.clamp(0, 20)),
  slots: Schema.Struct({
    ingredient: Schema.NullOr(ItemStack),
    bottles: Schema.Tuple(
      Schema.NullOr(ItemStack),
      Schema.NullOr(ItemStack),
      Schema.NullOr(ItemStack)
    )
  }),
  brewingProgress: Schema.Number.pipe(Schema.clamp(0, 400)),
  isActive: Schema.Boolean,
  efficiency: Schema.Number.pipe(Schema.clamp(0.5, 2.0), Schema.default(1.0))
})

type BrewingStation = Schema.Schema.Type<typeof BrewingStation>

// 醸造プロセス状態
const BrewingProcess = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("ProcessId")),
  stationId: Schema.String.pipe(Schema.brand("BrewingStationId")),
  recipe: BrewingRecipe,
  startTick: Schema.Number,
  totalTicks: Schema.Number,
  remainingTicks: Schema.Number,
  stage: Schema.Literal("Preparing", "Brewing", "Complete", "Failed"),
  bubbleIntensity: Schema.Number.pipe(Schema.clamp(0, 1)),
  fuelConsumed: Schema.Number
})

type BrewingProcess = Schema.Schema.Type<typeof BrewingProcess>
```

## 効果適用・削除メカニズム

### 効果管理サービス

```typescript
// アプリケーション層 - 効果管理
interface EffectManagerInterface {
  readonly applyEffect: (
    entityId: EntityId,
    effect: PotionEffect,
    force?: boolean
  ) => Effect.Effect<ActiveEffect, EffectError>

  readonly removeEffect: (
    entityId: EntityId,
    effectType: PotionEffectType
  ) => Effect.Effect<void, EffectError>

  readonly removeAllEffects: (
    entityId: EntityId,
    category?: EffectCategory
  ) => Effect.Effect<void, EffectError>

  readonly getActiveEffects: (
    entityId: EntityId
  ) => Effect.Effect<readonly ActiveEffect[], never>

  readonly hasEffect: (
    entityId: EntityId,
    effectType: PotionEffectType
  ) => Effect.Effect<boolean, never>

  readonly updateEffects: (
    entityId: EntityId,
    deltaTicks: number
  ) => Effect.Effect<readonly ActiveEffect[], EffectError>

  readonly getEffectAmplifier: (
    entityId: EntityId,
    effectType: PotionEffectType
  ) => Effect.Effect<number, never>
}

const EffectManager = Context.GenericTag<EffectManagerInterface>("@app/EffectManager")

// アクティブ効果状態
const ActiveEffect = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("ActiveEffectId")),
  entityId: EntityId,
  effect: PotionEffect,
  appliedTick: Schema.Number,
  lastTickApplied: Schema.Number,
  ticksActive: Schema.Number,
  suspended: Schema.Boolean.pipe(Schema.default(false)),
  immunityEndTick: Schema.optional(Schema.Number)
})

type ActiveEffect = Schema.Schema.Type<typeof ActiveEffect>
```

### 効果適用ロジック

```typescript
// 相互作用処理を含む効果適用
const applyEffectToEntity = (
  entityId: EntityId,
  effect: PotionEffect,
  currentTick: number,
  force: boolean = false
): Effect.Effect<ActiveEffect, EffectError> =>
  Effect.gen(function* () {
    // 早期リターン: エンティティ検証
    const entity = yield* EntityManager.getEntity(entityId)
    if (!entity) {
      return yield* Effect.fail(createEffectError("エンティティが見つかりません", entityId))
    }

    // 早期リターン: 効果プロパティ検証
    const properties = yield* getEffectProperties(effect.type)
    if (!properties) {
      return yield* Effect.fail(createEffectError("未知の効果タイプ", effect.type))
    }

    // 既存効果を取得
    const existingEffects = yield* EffectStorage.getEntityEffects(entityId)

    // 相互作用を処理
    const interactionResult = yield* processEffectInteraction(effect, existingEffects, properties)

    return yield* Match.value(interactionResult).pipe(
      Match.tag("Apply", () => addNewEffect(entityId, effect, currentTick)),
      Match.tag("Replace", ({ oldEffect }) =>
        Effect.gen(function* () {
          yield* removeEffectFromEntity(entityId, oldEffect.effect.type)
          return yield* addNewEffect(entityId, effect, currentTick)
        })
      ),
      Match.tag("Enhance", ({ existingEffect, newAmplifier, newDuration }) =>
        enhanceExistingEffect(entityId, existingEffect, newAmplifier, newDuration)
      ),
      Match.tag("Stack", ({ existingEffect }) =>
        stackEffectAmplifier(entityId, existingEffect, effect.amplifier)
      ),
      Match.tag("Block", () =>
        Effect.fail(createEffectError("既存の効果により効果適用がブロックされました"))
      ),
      Match.tag("Neutralize", ({ neutralizedEffects }) =>
        Effect.gen(function* () {
          yield* Effect.forEach(neutralizedEffects, neutralized =>
            removeEffectFromEntity(entityId, neutralized.effect.type)
          )
          return yield* addNewEffect(entityId, effect, currentTick)
        })
      ),
      Match.exhaustive
    )
  })

// クリーンアップを含む効果削除
const removeEffectFromEntity = (
  entityId: EntityId,
  effectType: PotionEffectType
): Effect.Effect<void, EffectError> =>
  Effect.gen(function* () {
    const activeEffect = yield* EffectStorage.getEntityEffect(entityId, effectType)

    if (!activeEffect) return

    // 削除の副作用を適用
    yield* applyEffectRemovalSideEffects(entityId, activeEffect)

    // ストレージから削除
    yield* EffectStorage.removeEntityEffect(entityId, effectType)

    // エンティティ属性を更新
    yield* recalculateEntityAttributes(entityId)

    // 削除イベントをトリガー
    yield* EventBus.publish({
      type: "EffectRemoved",
      entityId,
      effectType,
      wasExpired: false,
      timestamp: Date.now()
    })
  })
```

## 効果相互作用システム

### 相互作用パターン

```typescript
// 効果相互作用結果タイプ
type EffectInteractionResult =
  | { readonly _tag: "Apply" }
  | { readonly _tag: "Replace"; readonly oldEffect: ActiveEffect }
  | { readonly _tag: "Enhance"; readonly existingEffect: ActiveEffect; readonly newAmplifier: number; readonly newDuration: number }
  | { readonly _tag: "Stack"; readonly existingEffect: ActiveEffect }
  | { readonly _tag: "Block" }
  | { readonly _tag: "Neutralize"; readonly neutralizedEffects: readonly ActiveEffect[] }

// 相互作用処理
const processEffectInteraction = (
  newEffect: PotionEffect,
  existingEffects: readonly ActiveEffect[],
  properties: EffectProperties
): Effect.Effect<EffectInteractionResult, never> =>
  Effect.gen(function* () {
    // 同じタイプの効果をチェック
    const sameTypeEffect = existingEffects.find(e => e.effect.type === newEffect.type)

    if (sameTypeEffect) {
      return yield* handleSameTypeInteraction(newEffect, sameTypeEffect, properties)
    }

    // 競合する効果をチェック
    const conflictingEffects = existingEffects.filter(e =>
      properties.conflictsWith.includes(e.effect.type)
    )

    if (conflictingEffects.length > 0) {
      // 最も強い競合効果を見つける
      const strongestConflict = conflictingEffects.reduce((strongest, current) =>
        compareEffectStrength(current.effect, strongest.effect) > 0 ? current : strongest
      )

      // 新しい効果がより強い場合は置き換え、そうでなければブロック
      if (compareEffectStrength(newEffect, strongestConflict.effect) > 0) {
        return { _tag: "Replace", oldEffect: strongestConflict } as const
      } else {
        return { _tag: "Block" } as const
      }
    }

    // 中和する効果をチェック
    const neutralizingEffects = existingEffects.filter(e =>
      properties.neutralizesWith.includes(e.effect.type) ||
      isOppositeEffect(newEffect.type, e.effect.type)
    )

    if (neutralizingEffects.length > 0) {
      return { _tag: "Neutralize", neutralizedEffects: neutralizingEffects } as const
    }

    // 強化する効果をチェック
    const enhancingEffects = existingEffects.filter(e =>
      properties.enhancesWith.includes(e.effect.type)
    )

    if (enhancingEffects.length > 0) {
      const enhancer = enhancingEffects[0]
      // 増幅値を1上げる（上限255）
      const enhancedAmplifier = Math.min(255, newEffect.amplifier + 1)
      // 継続時間を1.5倍にする
      const enhancedDuration = Math.floor(newEffect.duration * 1.5)

      return {
        _tag: "Enhance",
        existingEffect: enhancer,
        newAmplifier: enhancedAmplifier,
        newDuration: enhancedDuration
      } as const
    }

    return { _tag: "Apply" } as const
  })

// 効果関係判定のための純粋関数
const isOppositeEffect = (effect1: PotionEffectType, effect2: PotionEffectType): boolean => {
  // 対立する効果のマップ定義
  const opposites: Record<PotionEffectType, PotionEffectType[]> = {
    "Speed": ["Slowness"],
    "Slowness": ["Speed"],
    "Strength": ["Weakness"],
    "Weakness": ["Strength"],
    "JumpBoost": [],
    "Haste": ["MiningFatigue"],
    "MiningFatigue": ["Haste"],
    "Regeneration": ["Poison", "Wither"],
    "Poison": ["Regeneration", "InstantHealth"],
    "InstantHealth": ["InstantDamage", "Poison", "Wither"],
    "InstantDamage": ["InstantHealth"],
    "Resistance": [],
    "FireResistance": [],
    "WaterBreathing": [],
    "Invisibility": ["Glowing"],
    "Glowing": ["Invisibility"],
    "Blindness": ["NightVision"],
    "NightVision": ["Blindness", "Darkness"],
    "Darkness": ["NightVision"],
    "Hunger": ["Saturation"],
    "Saturation": ["Hunger"],
    "Wither": ["Regeneration", "InstantHealth"],
    "HealthBoost": [],
    "Absorption": [],
    "Levitation": ["SlowFalling"],
    "SlowFalling": [],
    "Luck": ["Unluck"],
    "Unluck": ["Luck"],
    "Nausea": [],
    "ConduitPower": [],
    "DolphinsGrace": [],
    "BadOmen": ["HeroOfTheVillage"],
    "HeroOfTheVillage": ["BadOmen"]
  }

  return opposites[effect1]?.includes(effect2) ?? false
}

// 効果強化判定のための純粋関数
const isEnhancingEffect = (effect1: PotionEffectType, effect2: PotionEffectType): boolean => {
  // 相互強化する効果のマップ定義
  const enhancements: Record<PotionEffectType, PotionEffectType[]> = {
    "Speed": ["JumpBoost", "DolphinsGrace"],
    "JumpBoost": ["Speed"],
    "Strength": ["Haste"],
    "Haste": ["Strength"],
    "Regeneration": ["HealthBoost"],
    "HealthBoost": ["Regeneration", "Absorption"],
    "Absorption": ["HealthBoost"],
    "NightVision": ["ConduitPower"],
    "ConduitPower": ["NightVision", "WaterBreathing"],
    "WaterBreathing": ["ConduitPower", "DolphinsGrace"],
    "DolphinsGrace": ["WaterBreathing", "Speed"],
    "Luck": ["HeroOfTheVillage"],
    "HeroOfTheVillage": ["Luck"]
  }

  return enhancements[effect1]?.includes(effect2) ?? false
}
```

## 視覚効果統合

### パーティクルシステム統合

```typescript
// 効果パーティクル設定
const EffectParticleConfig = Schema.Struct({
  type: Schema.Literal("Ambient", "Spell", "InstantSpell", "WitchSpell", "Note", "Portal", "Enchant", "Flame", "Lava", "Footstep", "Splash", "Wake", "Smoke", "Redstone", "Snowball", "Slime", "Heart", "Barrier", "ItemCrack", "BlockCrack", "BlockDust", "DropletRain", "DropletSplash", "Sweep", "Bubble", "Cloud", "Explosion"),
  color: Schema.Struct({
    r: Schema.Number.pipe(Schema.clamp(0, 1)),
    g: Schema.Number.pipe(Schema.clamp(0, 1)),
    b: Schema.Number.pipe(Schema.clamp(0, 1)),
    a: Schema.Number.pipe(Schema.clamp(0, 1))
  }),
  velocity: Vector3,
  count: Schema.Number.pipe(Schema.positive()),
  lifetime: Schema.Number.pipe(Schema.positive()),
  size: Schema.Number.pipe(Schema.positive()),
  gravity: Schema.Number
})

type EffectParticleConfig = Schema.Schema.Type<typeof EffectParticleConfig>

// 効果固有のパーティクルマッピング
const getEffectParticleConfigs = (effectType: PotionEffectType): readonly EffectParticleConfig[] => {
  const particleMap: Record<PotionEffectType, readonly EffectParticleConfig[]> = {
    "Speed": [{
      type: "Spell",
      color: { r: 0.5, g: 0.9, b: 1.0, a: 0.8 },
      velocity: { x: 0.1, y: 0.1, z: 0.1 },
      count: 3,
      lifetime: 40,
      size: 0.5,
      gravity: -0.02
    }],
    "Strength": [{
      type: "Spell",
      color: { r: 0.9, g: 0.4, b: 0.2, a: 0.8 },
      velocity: { x: 0.05, y: 0.15, z: 0.05 },
      count: 4,
      lifetime: 50,
      size: 0.6,
      gravity: -0.01
    }],
    "Regeneration": [{
      type: "Heart",
      color: { r: 1.0, g: 0.4, b: 0.4, a: 0.9 },
      velocity: { x: 0.02, y: 0.2, z: 0.02 },
      count: 2,
      lifetime: 60,
      size: 0.4,
      gravity: -0.03
    }],
    "Poison": [{
      type: "Spell",
      color: { r: 0.3, g: 0.8, b: 0.3, a: 0.7 },
      velocity: { x: 0.08, y: 0.05, z: 0.08 },
      count: 5,
      lifetime: 35,
      size: 0.3,
      gravity: 0.01
    }],
    "Invisibility": [{
      type: "Spell",
      color: { r: 0.8, g: 0.8, b: 1.0, a: 0.3 },
      velocity: { x: 0.12, y: 0.08, z: 0.12 },
      count: 8,
      lifetime: 30,
      size: 0.2,
      gravity: -0.02
    }],
    "NightVision": [{
      type: "Spell",
      color: { r: 0.2, g: 0.2, b: 1.0, a: 0.6 },
      velocity: { x: 0.06, y: 0.12, z: 0.06 },
      count: 3,
      lifetime: 45,
      size: 0.4,
      gravity: -0.015
    }],
    "FireResistance": [{
      type: "Flame",
      color: { r: 1.0, g: 0.6, b: 0.0, a: 0.8 },
      velocity: { x: 0.04, y: 0.18, z: 0.04 },
      count: 6,
      lifetime: 25,
      size: 0.3,
      gravity: -0.05
    }]
    // 追加効果...
  }

  return particleMap[effectType] ?? []
}

// パーティクルレンダリングサービス
interface EffectParticleRendererInterface {
  readonly spawnEffectParticles: (
    entityId: EntityId,
    effect: PotionEffect,
    position: Position,
    intensity: number
  ) => Effect.Effect<void, RenderError>

  readonly updateParticles: (
    deltaTicks: number
  ) => Effect.Effect<void, never>

  readonly getActiveParticleSystems: (
    entityId: EntityId
  ) => Effect.Effect<readonly ParticleSystem[], never>

  readonly clearEntityParticles: (
    entityId: EntityId,
    effectType?: PotionEffectType
  ) => Effect.Effect<void, never>
}

const EffectParticleRenderer = Context.GenericTag<EffectParticleRendererInterface>("@app/EffectParticleRenderer")
```

### UI表示システム

```typescript
// 効果ステータスUIコンポーネント
const EffectStatusIcon = Schema.Struct({
  effectType: PotionEffectType,
  amplifier: Schema.Number,
  remainingTicks: Schema.Number,
  color: Schema.Struct({
    r: Schema.Number,
    g: Schema.Number,
    b: Schema.Number,
    a: Schema.Number
  }),
  texturePath: Schema.String,
  blinking: Schema.Boolean,
  ambient: Schema.Boolean,
  sortOrder: Schema.Number
})

type EffectStatusIcon = Schema.Schema.Type<typeof EffectStatusIcon>

// 画面オーバーレイ効果
const ScreenOverlayEffect = Schema.Struct({
  effectType: PotionEffectType,
  overlayType: Schema.Literal("ColorTint", "Distortion", "Border", "Vignette", "Particles"),
  intensity: Schema.Number.pipe(Schema.clamp(0, 1)),
  color: Schema.optional(Schema.Struct({
    r: Schema.Number,
    g: Schema.Number,
    b: Schema.Number,
    a: Schema.Number
  })),
  blendMode: Schema.Literal("Normal", "Multiply", "Screen", "Overlay", "Add"),
  animationPhase: Schema.Number
})

type ScreenOverlayEffect = Schema.Schema.Type<typeof ScreenOverlayEffect>

// UI管理サービス
interface EffectUIInterface {
  readonly updateStatusDisplay: (
    playerId: PlayerId,
    activeEffects: readonly ActiveEffect[]
  ) => Effect.Effect<void, UIError>

  readonly createScreenOverlays: (
    activeEffects: readonly ActiveEffect[],
    currentTick: number
  ) => Effect.Effect<readonly ScreenOverlayEffect[], never>

  readonly showEffectNotification: (
    playerId: PlayerId,
    effect: PotionEffect,
    action: "Applied" | "Removed" | "Expired" | "Enhanced"
  ) => Effect.Effect<void, UIError>

  readonly calculateStatusIconLayout: (
    effects: readonly ActiveEffect[],
    screenWidth: number,
    screenHeight: number
  ) => Effect.Effect<readonly EffectStatusIcon[], never>
}

const EffectUI = Context.GenericTag<EffectUIInterface>("@app/EffectUI")
```

## ステータス効果計算

### 属性変更システム

```typescript
// 属性修飾子タイプ
const AttributeModifier = Schema.Struct({
  attribute: Schema.Literal(
    "MaxHealth", "MovementSpeed", "AttackDamage", "AttackSpeed",
    "Armor", "ArmorToughness", "KnockbackResistance", "JumpHeight",
    "FlyingSpeed", "Luck", "FollowRange"
  ),
  operation: Schema.Literal("Add", "MultiplyBase", "MultiplyTotal"),
  value: Schema.Number,
  uuid: Schema.String.pipe(Schema.brand("ModifierUUID"))
})

type AttributeModifier = Schema.Schema.Type<typeof AttributeModifier>

// 効果から修飾子へのマッピング
const getEffectModifiers = (
  effect: PotionEffect
): readonly AttributeModifier[] => {
  const amplifier = effect.amplifier + 1

  const modifierMap: Record<PotionEffectType, (amp: number) => readonly AttributeModifier[]> = {
    "Speed": (amp) => [{
      attribute: "MovementSpeed",
      operation: "MultiplyBase",
      value: 0.2 * amp, // 増幅レベル毎に20%の移動速度向上
      uuid: `speed_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Slowness": (amp) => [{
      attribute: "MovementSpeed",
      operation: "MultiplyBase",
      value: -0.15 * amp, // 増幅レベル毎に15%の移動速度低下
      uuid: `slowness_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Haste": (amp) => [{
      attribute: "AttackSpeed",
      operation: "MultiplyBase",
      value: 0.1 * amp, // 増幅レベル毎に10%の攻撃速度向上
      uuid: `haste_${effect.id}` as AttributeModifier["uuid"]
    }],
    "MiningFatigue": (amp) => [{
      attribute: "AttackSpeed",
      operation: "MultiplyBase",
      value: -0.1 * amp, // 増幅レベル毎に10%の採掘速度低下
      uuid: `mining_fatigue_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Strength": (amp) => [{
      attribute: "AttackDamage",
      operation: "Add",
      value: 3 * amp, // 増幅レベル毎に3ポイントの攻撃力向上
      uuid: `strength_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Weakness": (amp) => [{
      attribute: "AttackDamage",
      operation: "Add",
      value: -4 * amp, // 増幅レベル毎に4ポイントの攻撃力低下
      uuid: `weakness_${effect.id}` as AttributeModifier["uuid"]
    }],
    "JumpBoost": (amp) => [{
      attribute: "JumpHeight",
      operation: "Add",
      value: 0.1 * amp, // 増幅レベル毎に0.1の跳躍力向上
      uuid: `jump_boost_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Resistance": (amp) => [{
      attribute: "Armor",
      operation: "Add",
      value: 2 * amp, // 増幅レベル毎に2ポイントの防御力向上
      uuid: `resistance_${effect.id}` as AttributeModifier["uuid"]
    }],
    "HealthBoost": (amp) => [{
      attribute: "MaxHealth",
      operation: "Add",
      value: 4 * amp, // 増幅レベル毎に4ポイントの最大体力向上
      uuid: `health_boost_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Absorption": (amp) => [{
      attribute: "MaxHealth",
      operation: "Add",
      value: 4 * amp, // 増幅レベル毎に4ポイントの衝撃吸収
      uuid: `absorption_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Luck": (amp) => [{
      attribute: "Luck",
      operation: "Add",
      value: amp, // 増幅レベル毎に1ポイントの幸運向上
      uuid: `luck_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Unluck": (amp) => [{
      attribute: "Luck",
      operation: "Add",
      value: -amp, // 増幅レベル毎に1ポイントの運低下
      uuid: `unluck_${effect.id}` as AttributeModifier["uuid"]
    }]
  }

  const generator = modifierMap[effect.type]
  return generator ? generator(amplifier) : []
}

// ステータス計算サービス
interface StatusCalculatorInterface {
  readonly calculateEntityAttributes: (
    entityId: EntityId,
    baseAttributes: EntityAttributes
  ) => Effect.Effect<EntityAttributes, never>

  readonly applyModifiers: (
    baseValue: number,
    modifiers: readonly AttributeModifier[]
  ) => number

  readonly getEffectiveMovementSpeed: (
    entityId: EntityId
  ) => Effect.Effect<number, never>

  readonly getEffectiveAttackDamage: (
    entityId: EntityId
  ) => Effect.Effect<number, never>
}

const StatusCalculator = Context.GenericTag<StatusCalculatorInterface>("@app/StatusCalculator")

// 純粋修飾子適用関数
const applyAttributeModifiers = (
  baseValue: number,
  modifiers: readonly AttributeModifier[]
): number => {
  // 操作タイプ別に修飾子をグループ化
  const addModifiers = modifiers.filter(m => m.operation === "Add")
  const multiplyBaseModifiers = modifiers.filter(m => m.operation === "MultiplyBase")
  const multiplyTotalModifiers = modifiers.filter(m => m.operation === "MultiplyTotal")

  // 最初に加算修飾子を適用
  const afterAdd = addModifiers.reduce(
    (value, modifier) => value + modifier.value,
    baseValue
  )

  // ベース乗算修飾子を適用
  const afterMultiplyBase = multiplyBaseModifiers.reduce(
    (value, modifier) => value * (1 + modifier.value),
    afterAdd
  )

  // 総合乗算修飾子を適用
  const final = multiplyTotalModifiers.reduce(
    (value, modifier) => value * (1 + modifier.value),
    afterMultiplyBase
  )

  return Math.max(0, final) // 負の値を防ぐ
}
```

## 効果永続化・保存システム

### 永続化スキーマ

```typescript
// シリアライズ可能効果データ
const SerializableEffect = Schema.Struct({
  type: PotionEffectType,
  amplifier: Schema.Number,
  remainingTicks: Schema.Number,
  ambient: Schema.Boolean,
  showParticles: Schema.Boolean,
  showIcon: Schema.Boolean,
  source: Schema.Struct({
    type: Schema.String,
    sourceId: Schema.optional(Schema.String)
  }),
  appliedTick: Schema.Number,
  lastTickApplied: Schema.Number
})

type SerializableEffect = Schema.Schema.Type<typeof SerializableEffect>

// エンティティ効果保存データ
const EntityEffectSaveData = Schema.Struct({
  entityId: EntityId,
  effects: Schema.Array(SerializableEffect),
  lastUpdateTick: Schema.Number,
  worldTick: Schema.Number
})

type EntityEffectSaveData = Schema.Schema.Type<typeof EntityEffectSaveData>

// ワールド効果データ
const WorldEffectData = Schema.Struct({
  entities: Schema.Array(EntityEffectSaveData),
  brewingStations: Schema.Array(BrewingStation),
  globalEffects: Schema.Array(Schema.Struct({
    type: Schema.String,
    data: Schema.Record(Schema.String, Schema.Unknown)
  })),
  version: Schema.Number,
  timestamp: Schema.Number
})

type WorldEffectData = Schema.Schema.Type<typeof WorldEffectData>
```

### 永続化サービス

```typescript
// 永続化管理
interface EffectPersistenceInterface {
  readonly saveWorldEffects: (
    worldId: WorldId
  ) => Effect.Effect<void, PersistenceError>

  readonly loadWorldEffects: (
    worldId: WorldId
  ) => Effect.Effect<WorldEffectData, PersistenceError>

  readonly saveEntityEffects: (
    entityId: EntityId,
    effects: readonly ActiveEffect[]
  ) => Effect.Effect<void, PersistenceError>

  readonly loadEntityEffects: (
    entityId: EntityId
  ) => Effect.Effect<readonly ActiveEffect[], PersistenceError>

  readonly createWorldBackup: (
    worldId: WorldId,
    includeEffects: boolean
  ) => Effect.Effect<string, PersistenceError> // バックアップパスを返す

  readonly restoreFromBackup: (
    backupPath: string
  ) => Effect.Effect<WorldEffectData, PersistenceError>
}

const EffectPersistence = Context.GenericTag<EffectPersistenceInterface>("@app/EffectPersistence")

// シリアライゼーションヘルパー
const serializeActiveEffect = (activeEffect: ActiveEffect): SerializableEffect => ({
  type: activeEffect.effect.type,
  amplifier: activeEffect.effect.amplifier,
  remainingTicks: activeEffect.effect.remainingDuration,
  ambient: activeEffect.effect.ambient,
  showParticles: activeEffect.effect.showParticles,
  showIcon: activeEffect.effect.showIcon,
  source: activeEffect.effect.source,
  appliedTick: activeEffect.appliedTick,
  lastTickApplied: activeEffect.lastTickApplied
})

const deserializeEffect = (
  serialized: SerializableEffect,
  currentTick: number
): Effect.Effect<ActiveEffect, never> =>
  Effect.gen(function* () {
    const effect: PotionEffect = {
      id: crypto.randomUUID() as PotionEffect["id"],
      type: serialized.type,
      amplifier: serialized.amplifier as PotionEffect["amplifier"],
      duration: (serialized.remainingTicks + (currentTick - serialized.appliedTick)) as PotionEffect["duration"],
      remainingDuration: serialized.remainingTicks as PotionEffect["remainingDuration"],
      showParticles: serialized.showParticles,
      showIcon: serialized.showIcon,
      ambient: serialized.ambient,
      source: serialized.source as PotionEffect["source"],
      factorData: undefined
    }

    const activeEffect: ActiveEffect = {
      id: crypto.randomUUID() as ActiveEffect["id"],
      entityId: "" as EntityId, // 呼び出し元によって設定される
      effect,
      appliedTick: serialized.appliedTick,
      lastTickApplied: serialized.lastTickApplied,
      ticksActive: currentTick - serialized.appliedTick,
      suspended: false
    }

    return activeEffect
  })
```

## パフォーマンス最適化

### ECS統合とメモリ管理

```typescript
// 効果コンポーネント (ECS統合)
interface EffectComponentArrays {
  readonly entityIds: Int32Array
  readonly effectTypeCounts: Int32Array
  readonly effectTypes: Int32Array // パックされた効果タイプ列挙型
  readonly amplifiers: Int32Array
  readonly remainingDurations: Int32Array
  readonly lastTickApplied: Int32Array
  readonly showParticles: Int8Array // ブールフラグ
  readonly showIcons: Int8Array
  readonly ambient: Int8Array
  readonly particleTimers: Float32Array
}

// Structure of Arrays実装
const createEffectComponentArrays = (capacity: number): EffectComponentArrays => ({
  entityIds: new Int32Array(capacity),
  effectTypeCounts: new Int32Array(capacity),
  effectTypes: new Int32Array(capacity * 8), // エンティティ毎に最大8効果
  amplifiers: new Int32Array(capacity * 8),
  remainingDurations: new Int32Array(capacity * 8),
  lastTickApplied: new Int32Array(capacity * 8),
  showParticles: new Int8Array(capacity * 8),
  showIcons: new Int8Array(capacity * 8),
  ambient: new Int8Array(capacity * 8),
  particleTimers: new Float32Array(capacity * 8)
})

// バッチ効果更新
const updateEffectsBatch = (
  arrays: EffectComponentArrays,
  deltaTicks: number,
  currentTick: number,
  startIndex: number,
  endIndex: number
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    for (let entityIndex = startIndex; entityIndex < endIndex; entityIndex++) {
      const entityId = arrays.entityIds[entityIndex]
      if (entityId === 0) continue // 空きスロット

      const effectCount = arrays.effectTypeCounts[entityIndex]
      const effectStartIndex = entityIndex * 8

      for (let effectIndex = 0; effectIndex < effectCount; effectIndex++) {
        const arrayIndex = effectStartIndex + effectIndex
        const remainingDuration = arrays.remainingDurations[arrayIndex]

        if (remainingDuration <= 0) {
          // 効果が期限切れ - 削除する
          removeEffectFromArrays(arrays, entityIndex, effectIndex)
          continue
        }

        // 残り時間を更新
        arrays.remainingDurations[arrayIndex] = Math.max(0, remainingDuration - deltaTicks)

        // パーティクルタイマーを更新
        arrays.particleTimers[arrayIndex] -= deltaTicks
        if (arrays.particleTimers[arrayIndex] <= 0 && arrays.showParticles[arrayIndex]) {
          arrays.particleTimers[arrayIndex] = 20 // 1秒にリセット
          // パーティクル生成をトリガー
        }

        // ティック効果を適用
        const tickInterval = getEffectTickInterval(arrays.effectTypes[arrayIndex])
        if (currentTick - arrays.lastTickApplied[arrayIndex] >= tickInterval) {
          arrays.lastTickApplied[arrayIndex] = currentTick
          // ティックベースの効果ロジックを適用
        }
      }
    }
  })

// 効果インスタンスのためのメモリプール
interface EffectMemoryPool {
  readonly activeEffects: ActiveEffect[]
  readonly freeIndices: Set<number>
  readonly usedCount: number
  readonly capacity: number
}

const createEffectMemoryPool = (initialCapacity: number = 10000): Effect.Effect<EffectMemoryPool, never> =>
  Effect.sync(() => ({
    activeEffects: new Array(initialCapacity),
    freeIndices: new Set(Array.from({ length: initialCapacity }, (_, i) => i)),
    usedCount: 0,
    capacity: initialCapacity
  }))
```

### パフォーマンス監視と最適化

```typescript
// パフォーマンスメトリクス
const EffectPerformanceMetrics = Schema.Struct({
  totalActiveEffects: Schema.Number,
  effectUpdatesPerSecond: Schema.Number,
  particleRenderTime: Schema.Number,
  memoryUsage: Schema.Number,
  cacheHitRate: Schema.Number,
  averageEffectsPerEntity: Schema.Number,
  peakEffectsThisFrame: Schema.Number
})

type EffectPerformanceMetrics = Schema.Schema.Type<typeof EffectPerformanceMetrics>

// 適応品質システム
const adaptiveEffectQuality = (
  performanceMetrics: EffectPerformanceMetrics,
  targetFPS: number,
  currentFPS: number
): Effect.Effect<EffectQualitySettings, never> =>
  Effect.gen(function* () {
    const performanceRatio = currentFPS / targetFPS

    let particleQuality = 1.0
    let updateFrequency = 1
    let maxEffectsPerEntity = 8
    let enableScreenEffects = true

    if (performanceRatio < 0.8) { // 処理が遅い場合
      particleQuality = 0.6
      updateFrequency = 2 // 2フレーム毎に更新
      maxEffectsPerEntity = 6
      enableScreenEffects = false
    } else if (performanceRatio < 0.9) {
      particleQuality = 0.8
      updateFrequency = 1
      maxEffectsPerEntity = 7
      enableScreenEffects = true
    }

    return {
      particleQuality,
      updateFrequency,
      maxEffectsPerEntity,
      enableScreenEffects,
      enableParticles: particleQuality > 0,
      particleDensityMultiplier: particleQuality,
      effectUpdateInterval: updateFrequency
    }
  })
```

## 実装例とコードサンプル

### 完全な使用例

```typescript
// メイン実装例 - ポーション消費
const drinkPotion = (
  playerId: PlayerId,
  potionItem: PotionItem
): Effect.Effect<void, GameError> =>
  Effect.gen(function* () {
    // 早期リターン: プレイヤー検証
    const player = yield* PlayerManager.getPlayer(playerId)
    if (!player) {
      return yield* Effect.fail(createGameError("Player not found"))
    }

    // 早期リターン: アイテム検証
    const potionEffects = yield* validateAndExtractEffects(potionItem)
    if (potionEffects.length === 0) {
      return yield* Effect.fail(createGameError("Invalid potion - no effects"))
    }

    const currentTick = yield* WorldSystem.getCurrentTick()

    // ポーションのすべての効果を適用
    yield* Effect.forEach(potionEffects, effect =>
      EffectManager.applyEffect(player.entityId, effect)
    )

    // アイテムを消費
    yield* PlayerInventory.removeItem(playerId, potionItem.id, 1)

    // 空の瓶を追加
    const emptyBottle = createGlassBottle()
    yield* PlayerInventory.addItem(playerId, emptyBottle)

    // 消費エフェクトを再生
    yield* SoundManager.playSound(player.position, "potion.drink")
    yield* EffectParticleRenderer.spawnEffectParticles(
      player.entityId,
      potionEffects[0], // パーティクルの色に最初の効果を使用
      player.position,
      1.0
    )

    // アクションをログに記録
    yield* GameLogger.logAction({
      type: "PotionConsumed",
      playerId,
      potionType: potionItem.type,
      effectsApplied: potionEffects.map(e => e.type),
      timestamp: currentTick
    })
  })

// スプラッシュポーション爆発
const explodeSplashPotion = (
  position: Position,
  splashPotion: SplashPotionItem,
  throwerEntityId: EntityId
): Effect.Effect<void, GameError> =>
  Effect.gen(function* () {
    const splashRadius = 4.0
    const potionEffects = yield* extractPotionEffects(splashPotion)
    const nearbyEntities = yield* EntityManager.getEntitiesInRadius(position, splashRadius)

    // 範囲内のすべてのエンティティに効果を適用
    yield* Effect.forEach(nearbyEntities, entity =>
      Effect.gen(function* () {
        const distance = calculateDistance(position, entity.position)
        const intensity = Math.max(0.25, 1 - (distance / splashRadius))

        // 距離に基づく強度でそれぞれの効果を適用
        yield* Effect.forEach(potionEffects, baseEffect => {
          const adjustedEffect: PotionEffect = {
            ...baseEffect,
            amplifier: Math.floor(baseEffect.amplifier * intensity) as PotionEffect["amplifier"],
            duration: Math.floor(baseEffect.duration * intensity) as PotionEffect["duration"],
            remainingDuration: Math.floor(baseEffect.duration * intensity) as PotionEffect["remainingDuration"],
            source: {
              type: "Splash",
              sourceId: splashPotion.id,
              appliedBy: throwerEntityId
            }
          }

          return EffectManager.applyEffect(entity.id, adjustedEffect)
        })
      })
    )

    // スプラッシュの視覚効果を生成
    yield* ParticleManager.spawnExplosion(position, {
      type: "PotionSplash",
      color: getPotionColor(splashPotion),
      radius: splashRadius,
      particleCount: 50
    })

    yield* SoundManager.playSound(position, "potion.splash")
  })

// 滞留ポーション領域効果
const createLingeringPotionCloud = (
  position: Position,
  lingeringPotion: LingeringPotionItem,
  duration: number = 600 // 30秒
): Effect.Effect<LingeringEffectCloud, GameError> =>
  Effect.gen(function* () {
    const cloudId = crypto.randomUUID()
    const potionEffects = yield* extractPotionEffects(lingeringPotion)

    const cloud: LingeringEffectCloud = {
      id: cloudId as LingeringEffectCloud["id"],
      position,
      radius: 3.0,
      effects: potionEffects,
      remainingTicks: duration,
      particleIntensity: 1.0,
      reapplicationInterval: 20, // 毎秒
      lastApplicationTick: 0,
      affectedEntities: new Set()
    }

    // 雲を更新対象に登録
    yield* LingeringEffectManager.registerCloud(cloud)

    // 初期パーティクルを生成
    yield* ParticleManager.spawnLingeringCloud(position, {
      color: getPotionColor(lingeringPotion),
      radius: cloud.radius,
      duration
    })

    return cloud
  })
```

### 醸造システム実装

```typescript
// 完全な醸造プロセス
const startBrewingProcess = (
  brewingStandId: string,
  recipe: BrewingRecipe,
  basePotions: readonly PotionItem[]
): Effect.Effect<BrewingProcess, BrewingError> =>
  Effect.gen(function* () {
    // 早期リターン: ステーション検証
    const station = yield* BrewingStationManager.getStation(brewingStandId)
    if (!station) {
      return yield* Effect.fail(createBrewingError("Brewing stand not found"))
    }

    if (station.fuel <= 0) {
      return yield* Effect.fail(createBrewingError("No fuel in brewing stand"))
    }

    // 早期リターン: レシピ検証
    const isValidCombination = yield* validateBrewingCombination(recipe, basePotions)
    if (!isValidCombination) {
      return yield* Effect.fail(createBrewingError("Invalid brewing combination"))
    }

    const currentTick = yield* WorldSystem.getCurrentTick()
    const brewingTime = calculateBrewingTime(recipe, station.efficiency)

    const process: BrewingProcess = {
      id: crypto.randomUUID() as BrewingProcess["id"],
      stationId: brewingStandId as BrewingProcess["stationId"],
      recipe,
      startTick: currentTick,
      totalTicks: brewingTime,
      remainingTicks: brewingTime,
      stage: "Brewing",
      bubbleIntensity: 0.0,
      fuelConsumed: 0
    }

    // ステーションの状態を更新
    yield* BrewingStationManager.updateStation(brewingStandId, {
      ...station,
      isActive: true,
      brewingProgress: 0
    })

    // 視覚効果を開始
    yield* startBrewingEffects(station.position, brewingTime)

    return process
  })

// 醸造更新ループ
const updateBrewingProcess = (
  processId: string,
  deltaTicks: number
): Effect.Effect<BrewingProcess, BrewingError> =>
  Effect.gen(function* () {
    const process = yield* BrewingProcessManager.getProcess(processId)
    if (!process) {
      return yield* Effect.fail(createBrewingError("Brewing process not found"))
    }

    const newRemainingTicks = Math.max(0, process.remainingTicks - deltaTicks)
    const progress = 1 - (newRemainingTicks / process.totalTicks)

    // サイン波アニメーションで泡の強度を計算
    const bubbleIntensity = Math.sin(progress * Math.PI * 6) * 0.3 + 0.7

    // 燃料消費量を計算
    const fuelRate = 1 / 400 // 400ティック（20秒）で燃料1
    const fuelConsumed = process.fuelConsumed + (deltaTicks * fuelRate)

    const updatedProcess: BrewingProcess = {
      ...process,
      remainingTicks: newRemainingTicks,
      stage: newRemainingTicks <= 0 ? "Complete" : "Brewing",
      bubbleIntensity,
      fuelConsumed
    }

    // 視覚効果を更新
    const station = yield* BrewingStationManager.getStation(process.stationId)
    if (station) {
      yield* updateBrewingEffects(station.position, bubbleIntensity, progress)
    }

    // 完了を確認
    if (updatedProcess.stage === "Complete") {
      yield* completeBrewingProcess(processId)
    }

    return updatedProcess
  })
```

### テスト実装

```typescript
// 包括的テストスイート
describe("Potion Effects System", () => {
  const TestLayer = Layer.mergeAll(
    PotionEffectsSystemLayer,
    TestWorldSystemLayer,
    TestEntitySystemLayer
  )

  describe("Effect Application", () => {
    it("should apply basic effects correctly", () =>
      Effect.gen(function* () {
        const effectManager = yield* EffectManager

        const testEntity = createTestEntity("player")
        const speedEffect = createSpeedEffect(1, 1200) // 60秒間のSpeed II

        const activeEffect = yield* effectManager.applyEffect(
          testEntity.id,
          speedEffect
        )

        expect(activeEffect.effect.type).toBe("Speed")
        expect(activeEffect.effect.amplifier).toBe(1)

        const hasEffect = yield* effectManager.hasEffect(testEntity.id, "Speed")
        expect(hasEffect).toBe(true)

        const effects = yield* effectManager.getActiveEffects(testEntity.id)
        expect(effects.length).toBe(1)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it("should handle effect interactions correctly", () =>
      Effect.gen(function* () {
        const effectManager = yield* EffectManager

        const testEntity = createTestEntity("player")
        const speedEffect = createSpeedEffect(0, 1200) // Speed I
        const slowEffect = createSlowEffect(0, 1200) // Slowness I

        yield* effectManager.applyEffect(testEntity.id, speedEffect)
        yield* effectManager.applyEffect(testEntity.id, slowEffect)

        // SpeedとSlownessは互いに相殺される
        const effects = yield* effectManager.getActiveEffects(testEntity.id)
        expect(effects.length).toBe(0) // 両方とも相殺される
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it("should calculate modifiers correctly", () =>
      Effect.gen(function* () {
        const statusCalculator = yield* StatusCalculator

        const testEntity = createTestEntity("player")
        const strengthEffect = createStrengthEffect(1, 1200) // Strength II

        yield* EffectManager.applyEffect(testEntity.id, strengthEffect)

        const attackDamage = yield* statusCalculator.getEffectiveAttackDamage(testEntity.id)
        expect(attackDamage).toBeGreaterThan(testEntity.baseAttackDamage)
        expect(attackDamage).toBe(testEntity.baseAttackDamage + 6) // 増幅レベルごとに+3
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))
  })

  describe("Brewing System", () => {
    it("should validate recipes correctly", () =>
      Effect.gen(function* () {
        const brewingSystem = yield* BrewingSystem

        const validIngredients = {
          primaryIngredient: "Sugar" as const,
          basePotions: ["Awkward" as const]
        }

        const recipe = yield* brewingSystem.validateRecipe(validIngredients)
        expect(Option.isSome(recipe)).toBe(true)

        const invalidIngredients = {
          primaryIngredient: "Diamond" as const, // 無効な醸造材料
          basePotions: ["Water" as const]
        }

        const invalidRecipe = yield* brewingSystem.validateRecipe(invalidIngredients)
        expect(Option.isNone(invalidRecipe)).toBe(true)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it("should complete brewing process", () =>
      Effect.gen(function* () {
        const brewingSystem = yield* BrewingSystem

        const recipe = createSpeedPotionRecipe()
        const ingredients = {
          primaryIngredient: "Sugar" as const,
          basePotions: ["Awkward" as const]
        }

        const process = yield* brewingSystem.startBrewing(
          "test_stand",
          ingredients,
          recipe
        )

        expect(process.stage).toBe("Brewing")

        // 醸造を早送り
        let currentProcess = process
        while (currentProcess.stage === "Brewing") {
          currentProcess = yield* brewingSystem.updateBrewing(
            process.id,
            100 // 一度に100ティック
          )
        }

        expect(currentProcess.stage).toBe("Complete")

        const results = yield* brewingSystem.completeBrewing(process.id)
        expect(results.length).toBeGreaterThan(0)
        expect(results[0].effects.some(e => e.type === "Speed")).toBe(true)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))
  })

  describe("Performance", () => {
    it("should handle many effects efficiently", () =>
      Effect.gen(function* () {
        const effectManager = yield* EffectManager
        const entityCount = 1000
        const effectsPerEntity = 3

        // 複数の効果を持つ多数のエンティティを作成
        const entities = Array.from({ length: entityCount }, (_, i) =>
          createTestEntity(`entity_${i}`)
        )

        const startTime = performance.now()

        yield* Effect.forEach(entities, entity =>
          Effect.gen(function* () {
            for (let i = 0; i < effectsPerEntity; i++) {
              const effect = createRandomEffect()
              yield* effectManager.applyEffect(entity.id, effect)
            }
          })
        )

        // すべての効果を更新
        yield* Effect.forEach(entities, entity =>
          effectManager.updateEffects(entity.id, 20) // 1ティック
        )

        const endTime = performance.now()
        const duration = endTime - startTime

        expect(duration).toBeLessThan(1000) // 1秒以内に完了する

        // すべての効果が適用されていることを確認
        const totalEffects = yield* Effect.reduce(
          entities,
          0,
          (acc, entity) =>
            Effect.gen(function* () {
              const effects = yield* effectManager.getActiveEffects(entity.id)
              return acc + effects.length
            })
        )

        expect(totalEffects).toBe(entityCount * effectsPerEntity)
      }).pipe(
        Effect.provide(TestLayer),
        Effect.runPromise
      ))
  })
})
```

## パフォーマンス最適化戦略

### バッチ処理とメモリ最適化

```typescript
// パフォーマンス向上のためのバッチ効果更新
const batchUpdateAllEffects = (
  entityIds: readonly EntityId[],
  deltaTicks: number,
  batchSize: number = 100
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const batches = chunk(entityIds, batchSize)

    yield* Effect.forEach(batches, batch =>
      Effect.gen(function* () {
        yield* Effect.forEach(
          batch,
          entityId => EffectManager.updateEffects(entityId, deltaTicks),
          { concurrency: 8 } // 8つのエンティティを同時に処理
        )

        // ブロッキングを防ぐための短い譲歩
        yield* Effect.yieldNow()
      })
    )
  })

// パーティクルレンダリングのための空間最適化
const spatiallyOptimizedParticleRender = (
  entities: readonly Entity[],
  camera: CameraState,
  maxRenderDistance: number = 64
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // カメラからの距離でエンティティをソート
    const entitiesByDistance = entities
      .map(entity => ({
        entity,
        distance: calculateDistance(entity.position, camera.position)
      }))
      .filter(({ distance }) => distance <= maxRenderDistance)
      .sort((a, b) => a.distance - b.distance)

    // LODを使用してパーティクルをレンダリング
    yield* Effect.forEach(entitiesByDistance, ({ entity, distance }) =>
      Effect.gen(function* () {
        const effects = yield* EffectManager.getActiveEffects(entity.id)
        if (effects.length === 0) return

        // 距離に基づいて品質を計算
        let quality = 1.0
        if (distance > 16) quality = 0.5
        if (distance > 32) quality = 0.25

        yield* EffectParticleRenderer.spawnEffectParticles(
          entity.id,
          effects[0], // パーティクルに主要効果を使用
          entity.position,
          quality
        )
      })
    )
  })
```

ポーション効果システムは、TypeScript Minecraft cloneに対する洗練された拡張機能であり、複雑なステータス効果、醸造システム、視覚的フィードバックを通じて豊かなゲームプレイメカニクスを提供します。Effect-TSの関数型アーキテクチャを活用し、厳格な型安全性を維持することで、予測可能な動作を実現しながら、ゲームプレイ体験全体を向上させる広範囲なカスタマイゼーションと相互作用パターンをサポートします。