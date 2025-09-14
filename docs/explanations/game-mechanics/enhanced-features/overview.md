---
title: "拡張機能概要 - 高度システムとアドバンスド機能"
description: "Minecraftクローンの拡張機能群の完全概要。レッドストーン、マルチプレイヤー、AIシステムなどの高度なシステム設計。"
category: "specification"
difficulty: "advanced"
tags: ["enhanced-features", "system-overview", "advanced-mechanics", "multiplayer", "ai-systems", "circuit-simulation"]
prerequisites: ["effect-ts-fundamentals", "ddd-concepts", "concurrent-patterns", "core-systems"]
estimated_reading_time: "15分"
related_patterns: ["concurrent-patterns", "state-machine-patterns", "ai-behavior-patterns"]
related_docs: ["../core-features/overview.md", "./redstone-system.md", "./multiplayer-architecture.md"]
---

# Enhanced Features - 拡張機能

## 概要

Enhanced Featuresは、基本的なMinecraft機能を拡張し、よりリッチで魅力的なゲーム体験を提供する機能群です。これらの機能は、Effect-TSの高度なパターンとDDDの戦略的設計を活用して、モジュラーかつ拡張可能な形で実装されています。

## アーキテクチャ原則

### Effect-TSの高度なパターン

```typescript
import { Effect, Layer, Context, Stream, Fiber, Queue, Ref, STM, Schema, Match, pipe, Brand } from "effect"
import * as THREE from "three/webgpu"
import { uniform, attribute, vec3, vec4, texture, time } from "three/tsl"

// IMPORTANT: 外部パッケージ使用時は必ずContext7で最新仕様を確認
// 最新Effect-TS: Context.GenericTag, Schema.TaggedError, Match.value使用
// 最新Three.js r160+: WebGPURenderer, TSL(Three.js Shading Language)使用
```

## Enhanced Feature一覧

### 1. Redstone System（レッドストーン回路システム）
- **論理回路シミュレーション**
- **信号伝播アルゴリズム**
- **機械的コンポーネント制御**
- **回路最適化エンジン**

### 2. Weather System（動的天候システム）
- **リアルタイム気象シミュレーション**
- **降水効果と雷システム**
- **季節変化とバイオーム固有天候**
- **天候がゲームプレイに与える影響**

### 3. Day/Night Cycle（昼夜サイクル）
- **動的時間システム**
- **太陽・月の軌道計算**
- **光源計算とシャドウ**
- **時間に応じたMob行動変化**

### 4. Mob AI System（Mob人工知能）
- **行動木（Behavior Tree）ベースAI**
- **群れ行動シミュレーション**
- **敵対・中立・友好モブの行動パターン**
- **環境適応型AI**

### 5. Villager Trading（村人取引システム）
- **動的価格システム**
- **職業別取引アイテム**
- **評判システム**
- **経済バランス調整**

### 6. Enchantment System（エンチャントシステム）
- **エンチャント効果計算**
- **レベルベース強化システム**
- **アイテム耐久度への影響**
- **特殊エンチャント効果**

### 7. Potion Effects（ポーション効果システム）
- **効果の持続時間管理**
- **複数効果の相互作用**
- **プレイヤー能力値への影響**
- **視覚効果とパーティクル**

### 8. Nether Portals（ネザーポータル・異次元）
- **異次元間移動システム**
- **座標変換アルゴリズム**
- **異次元固有の環境とMob**
- **ポータル構築とリンク管理**

## ⚠️ 追加が必要なEnhanced Features

現在の8つの機能に加えて、以下の重要な拡張機能が不足しています：

### 🌊 環境・自然システム
- **Ocean & Underwater System**: 海洋バイオーム・水中探索・海洋構造物
- **Cave & Underground**: 巨大洞窟・鍾乳洞・地下水脈システム
- **Disaster System**: 地震・火山・津波などの自然災害
- **Liquid Physics Advanced**: 複雑な流体力学・マグマ・水流相互作用

### 🏛️ 構造物・文明システム
- **Ancient Structures**: 遺跡・ピラミッド・海底神殿・要塞
- **Village Evolution**: 村の成長・拡張・文明発展システム
- **Transportation**: 鉄道・馬車・船舶・エリトラ飛行
- **Automation Systems**: ホッパー・ドロッパー・ピストンによる自動化

### 🎯 ゲームプレイシステム
- **Quest & Adventure**: 冒険クエスト・宝探し・ストーリーモード
- **Economy System**: 通貨・市場・貿易・経済バランス
- **Guild & Faction**: ギルド・派閥・領土システム
- **Advanced Combat Mechanics**: 武器の特殊攻撃・防御技・戦闘スキル

### 🔮 マジック・テクノロジー
- **Magic System**: 魔法・呪文・魔法アイテム・魔法陣
- **Technology Tiers**: 蒸気機関・電力・オートメーション
- **Automation**: 自動化装置・ロボット・AI労働者
- **Alchemy System**: 高度なポーション・化学反応・実験装置

### 🎨 クリエイティブ支援
- **Advanced Building**: 建築テンプレート・対称建築・3Dコピー
- **Art & Decoration**: 絵画・彫刻・装飾ブロック・カスタムテクスチャ
- **Music & Sound**: 楽器・音楽ブロック・サウンドスケープ
- **WorldEdit Tools**: 大規模建築支援ツール・地形編集
- **Custom Textures & Skins**: カスタムテクスチャ・スキンシステム

### 🌐 ソーシャル・コミュニティ
- **Player Housing**: 個人住宅・アパート・不動産システム
- **Events & Festivals**: 季節イベント・祭り・コミュニティ活動
- **Social Features**: フレンドリスト・メール・掲示板
- **Server Management**: 権限管理・プラグイン対応・管理UI

### 🎪 エンターテインメント
- **Mini Games**: ゲーム内ミニゲーム・競技・パーティゲーム
- **Story Mode**: ストーリー進行・NPC対話・選択肢システム
- **Photo Mode**: スクリーンショット・動画撮影・シェア機能

詳細は [**不足機能一覧**](../07-missing-features.md) を参照してください。

## Effect-TSによる拡張可能な設計

### Enhanced Feature Architecture

```typescript
// 拡張機能の統合エラーシステム
export const FeatureRegistrationError = Schema.TaggedError("FeatureRegistrationError")({
  featureId: Schema.String,
  message: Schema.String,
  timestamp: Schema.Number
})

export const FeatureError = Schema.TaggedError("FeatureError")({
  featureId: Schema.String,
  operation: Schema.String,
  message: Schema.String,
  timestamp: Schema.Number
})

export const FeatureInitializationError = Schema.TaggedError("FeatureInitializationError")({
  featureId: Schema.String,
  dependencyIssues: Schema.Array(Schema.String),
  timestamp: Schema.Number
})

// 拡張機能の共通インターフェース
export const EnhancedFeature = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  version: Schema.String,
  dependencies: Schema.Array(Schema.String),
  priority: pipe(Schema.Number, Schema.int(), Schema.between(1, 100)),
  category: Schema.Union(
    Schema.Literal("gameplay"),
    Schema.Literal("visual"),
    Schema.Literal("technical"),
    Schema.Literal("experimental")
  ),
  enabled: Schema.Boolean,
  config: Schema.Record(Schema.String, Schema.Unknown).pipe(Schema.optional())
})

export type EnhancedFeature = Schema.Schema.Type<typeof EnhancedFeature>

// 拡張機能マネージャー
interface EnhancedFeatureManagerInterface {
  readonly registerFeature: (
    feature: EnhancedFeature
  ) => Effect.Effect<void, FeatureRegistrationError>

  readonly enableFeature: (
    id: string
  ) => Effect.Effect<void, FeatureError>

  readonly disableFeature: (
    id: string
  ) => Effect.Effect<void, FeatureError>

  readonly getActiveFeatures: () => Effect.Effect<ReadonlyArray<string>, never>

  readonly updateAllFeatures: (
    deltaTime: number
  ) => Effect.Effect<number, FeatureError> // returns updated feature count

  readonly getDependencyGraph: () => Effect.Effect<Map<string, ReadonlyArray<string>>, never>

  readonly validateDependencies: (
    featureId: string
  ) => Effect.Effect<boolean, FeatureError>

  readonly getFeatureMetrics: () => Effect.Effect<FeatureMetrics, never>

  readonly reloadFeature: (
    featureId: string
  ) => Effect.Effect<void, FeatureError>
}

const EnhancedFeatureManager = Context.GenericTag<EnhancedFeatureManagerInterface>("@minecraft/EnhancedFeatureManager")

// Feature Metrics
const FeatureMetrics = Schema.Struct({
  totalFeatures: Schema.Number,
  activeFeatures: Schema.Number,
  averageUpdateTime: Schema.Number,
  memoryUsage: Schema.Number,
  errorCount: Schema.Number,
  lastUpdate: Schema.DateTimeUtc
})

export type FeatureMetrics = Schema.Schema.Type<typeof FeatureMetrics>
```

### Event-Driven Architecture

```typescript
// Position Schema
export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  world: Schema.String
})

export type Position = Schema.Schema.Type<typeof Position>

// 拡張機能関連イベント（統一されたイベントシステム）
export const EnhancedFeatureEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("RedstoneSignalChanged"),
    position: Position,
    signalStrength: pipe(Schema.Number, Schema.int(), Schema.between(0, 15)),
    timestamp: Schema.DateTimeUtc
  }),
  Schema.Struct({
    _tag: Schema.Literal("WeatherChanged"),
    oldCondition: Schema.String,
    newCondition: Schema.String,
    region: Schema.String,
    timestamp: Schema.DateTimeUtc
  }),
  Schema.Struct({
    _tag: Schema.Literal("TimeChanged"),
    gameTime: Schema.Number,
    dayPhase: Schema.String,
    timestamp: Schema.DateTimeUtc
  }),
  Schema.Struct({
    _tag: Schema.Literal("MobSpawned"),
    mobType: Schema.String,
    position: Position,
    spawnReason: Schema.String,
    timestamp: Schema.DateTimeUtc
  }),
  Schema.Struct({
    _tag: Schema.Literal("VillagerTradeCompleted"),
    traderId: Schema.String,
    playerId: Schema.String,
    tradeItems: Schema.Array(Schema.String),
    timestamp: Schema.DateTimeUtc
  }),
  Schema.Struct({
    _tag: Schema.Literal("EnchantmentApplied"),
    itemId: Schema.String,
    enchantmentType: Schema.String,
    level: Schema.Number,
    timestamp: Schema.DateTimeUtc
  }),
  Schema.Struct({
    _tag: Schema.Literal("PotionEffectStarted"),
    entityId: Schema.String,
    effectType: Schema.String,
    duration: Schema.Number,
    amplifier: Schema.Number,
    timestamp: Schema.DateTimeUtc
  }),
  Schema.Struct({
    _tag: Schema.Literal("PortalTraversed"),
    playerId: Schema.String,
    fromDimension: Schema.String,
    toDimension: Schema.String,
    portalPosition: Position,
    timestamp: Schema.DateTimeUtc
  })
)

export type EnhancedFeatureEvent = Schema.Schema.Type<typeof EnhancedFeatureEvent>
```

### Concurrent Processing

```typescript
// 拡張機能の並行処理パターン
export const processEnhancedFeatures = (
  features: ReadonlyArray<string>,
  deltaTime: number
) => Effect.gen(function* () {
  const manager = yield* EnhancedFeatureManager

  // 全ての拡張機能を並行して更新
  yield* Effect.forEach(
    features,
    (featureId) => manager.updateFeature(featureId, deltaTime),
    { concurrency: "unbounded" }
  )
})

// STMを使用したゲーム状態の原子的更新
export const atomicGameStateUpdate = (
  worldState: Ref.Ref<WorldState>,
  playerStates: Ref.Ref<Map<string, PlayerState>>,
  updates: ReadonlyArray<GameStateUpdate>
) => STM.gen(function* () {
  const currentWorld = yield* STM.get(worldState)
  const currentPlayers = yield* STM.get(playerStates)

  // すべての更新を検証
  for (const update of updates) {
    const isValid = yield* STM.succeed(validateUpdate(update, currentWorld))
    if (!isValid) {
      return yield* STM.fail(new InvalidUpdateError(update))
    }
  }

  // 原子的に状態を更新
  const newWorld = applyUpdates(currentWorld, updates)
  const newPlayers = updatePlayersFromWorld(currentPlayers, newWorld)

  yield* STM.set(worldState, newWorld)
  yield* STM.set(playerStates, newPlayers)
})
```

## モジュール間の統合

### Layer Composition

```typescript
// Enhanced Features Layer構成（最新パターン）
export const EnhancedFeatureManagerLive = Layer.effect(
  EnhancedFeatureManager,
  Effect.gen(function* () {
    const features = yield* Ref.make<Map<string, EnhancedFeature>>(new Map())
    const activeFeatures = yield* Ref.make<Set<string>>(new Set())
    const dependencyGraph = yield* Ref.make<Map<string, ReadonlyArray<string>>>(new Map())
    const metrics = yield* Ref.make<FeatureMetrics>({
      totalFeatures: 0,
      activeFeatures: 0,
      averageUpdateTime: 0,
      memoryUsage: 0,
      errorCount: 0,
      lastUpdate: new Date()
    })

    const registerFeature = (feature: EnhancedFeature) => Effect.gen(function* () {
      // Validate feature configuration
      yield* validateFeatureConfiguration(feature)

      yield* Ref.update(features, map => map.set(feature.id, feature))
      yield* updateDependencyGraph(feature)

      yield* Ref.update(metrics, m => ({
        ...m,
        totalFeatures: m.totalFeatures + 1,
        lastUpdate: new Date()
      }))
    })

    const enableFeature = (id: string) => Effect.gen(function* () {
      const featureMap = yield* Ref.get(features)
      const feature = featureMap.get(id)

      if (!feature) {
        return yield* Effect.fail(new FeatureError({
          featureId: id,
          operation: "enable",
          message: "Feature not found",
          timestamp: Date.now()
        }))
      }

      // Validate dependencies first
      const dependenciesValid = yield* validateDependencies(id)
      if (!dependenciesValid) {
        return yield* Effect.fail(new FeatureError({
          featureId: id,
          operation: "enable",
          message: "Dependency validation failed",
          timestamp: Date.now()
        }))
      }

      // Enable dependencies first
      for (const depId of feature.dependencies) {
        const active = yield* Ref.get(activeFeatures)
        if (!active.has(depId)) {
          yield* enableFeature(depId)
        }
      }

      yield* Ref.update(activeFeatures, set => set.add(id))
      yield* Ref.update(metrics, m => ({
        ...m,
        activeFeatures: m.activeFeatures + 1,
        lastUpdate: new Date()
      }))
    })

    const updateAllFeatures = (deltaTime: number) => Effect.gen(function* () {
      const startTime = Date.now()
      const active = yield* Ref.get(activeFeatures)
      let updatedCount = 0
      let totalUpdateTime = 0

      for (const featureId of active) {
        const updateStart = Date.now()

        try {
          yield* updateFeature(featureId, deltaTime)
          updatedCount++
        } catch (error) {
          yield* Ref.update(metrics, m => ({ ...m, errorCount: m.errorCount + 1 }))
        }

        totalUpdateTime += Date.now() - updateStart
      }

      const averageUpdateTime = updatedCount > 0 ? totalUpdateTime / updatedCount : 0

      yield* Ref.update(metrics, m => ({
        ...m,
        averageUpdateTime,
        lastUpdate: new Date()
      }))

      return updatedCount
    })

    const validateDependencies = (featureId: string) => Effect.gen(function* () {
      const featureMap = yield* Ref.get(features)
      const feature = featureMap.get(featureId)

      if (!feature) return false

      // Check if all dependencies are registered
      for (const depId of feature.dependencies) {
        if (!featureMap.has(depId)) {
          return false
        }
      }

      // Check for circular dependencies
      const visited = new Set<string>()
      const hasCycle = yield* checkCyclicDependencies(featureId, visited)

      return !hasCycle
    })

    return {
      registerFeature,
      enableFeature,
      disableFeature: (id) => disableFeatureImpl(id),
      getActiveFeatures: () => Ref.get(activeFeatures).pipe(
        Effect.map(set => Array.from(set))
      ),
      updateAllFeatures,
      getDependencyGraph: () => Ref.get(dependencyGraph),
      validateDependencies,
      getFeatureMetrics: () => Ref.get(metrics),
      reloadFeature: (id) => reloadFeatureImpl(id)
    } as const
  })
)

// Enhanced Features Layer構成（依存関係を明確化）
export const EnhancedFeaturesLayer = Layer.mergeAll(
  EnhancedFeatureManagerLive,
  // Individual feature layers
  RedstoneSystemLayer,
  WeatherSystemLayer,
  DayNightCycleLayer,
  MobAISystemLayer,
  VillagerTradingLayer,
  EnchantmentSystemLayer,
  PotionEffectsLayer,
  NetherPortalsLayer,
  ParticleSystemLayer,
  OceanUnderwaterSystemLayer,
  ExtendedBiomeSystemLayer,
  StructureGenerationLayer,
  MultiplayerArchitectureLayer
).pipe(
  // Core dependencies
  Layer.provide(CoreFeaturesLayer),
  Layer.provide(WorldSystemLayer),
  Layer.provide(PhysicsSystemLayer),
  Layer.provide(RenderingSystemLayer),
  Layer.provide(EventBusLayer),
  Layer.provide(TimeSystemLayer),
  Layer.provide(NetworkingLayer)
)
```

### Cross-Cutting Concerns

```typescript
// 拡張機能の横断的関心事
export const withFeatureLogging = <R, E, A>(
  featureName: string,
  operation: string,
  effect: Effect.Effect<A, E, R>
) => pipe(
  effect,
  Effect.tap(() => Effect.log(`[${featureName}] Starting ${operation}`)),
  Effect.tapError((error) => Effect.log(`[${featureName}] Error in ${operation}: ${error}`)),
  Effect.tapDefect((defect) => Effect.log(`[${featureName}] Defect in ${operation}: ${defect}`))
)

export const withPerformanceTracking = <R, E, A>(
  featureName: string,
  operation: string,
  effect: Effect.Effect<A, E, R>
) => Effect.gen(function* () {
  const startTime = yield* Effect.sync(() => performance.now())

  try {
    const result = yield* effect
    const duration = performance.now() - startTime

    yield* recordPerformanceMetric(featureName, operation, duration, "success")
    return result
  } catch (error) {
    const duration = performance.now() - startTime
    yield* recordPerformanceMetric(featureName, operation, duration, "failure")
    throw error
  }
})

export const withFeatureCache = <R, E, A>(
  featureName: string,
  cacheKey: string,
  ttl: number,
  effect: Effect.Effect<A, E, R>
) => Effect.gen(function* () {
  const cache = yield* FeatureCacheService
  const cached = yield* cache.get(featureName, cacheKey)

  if (cached) {
    return cached as A
  }

  const result = yield* effect
  yield* cache.set(featureName, cacheKey, result, ttl)

  return result
})
```

## パフォーマンス最適化戦略

### 1. 段階的機能有効化

```typescript
export const enableFeatureGradually = (
  featureId: string,
  loadSteps: ReadonlyArray<() => Effect.Effect<void, FeatureError>>
) => Effect.gen(function* () {
  const manager = yield* EnhancedFeatureManager

  for (const [index, step] of loadSteps.entries()) {
    yield* Effect.log(`Loading ${featureId} - Step ${index + 1}/${loadSteps.length}`)
    yield* step()

    // ステップ間で他の処理に制御を譲る
    yield* Effect.sleep(10)
  }

  yield* manager.enableFeature(featureId)
  yield* Effect.log(`Feature ${featureId} successfully enabled`)
})
```

### 2. 適応的品質調整

```typescript
export const adaptiveQualityManager = Effect.gen(function* () {
  const performanceMonitor = yield* PerformanceMonitor
  const qualitySettings = yield* Ref.make({
    redstoneTickRate: 20,
    weatherDetailLevel: "high" as const,
    mobAIComplexity: "full" as const,
    particleCount: 1000
  })

  return {
    adjustQuality: Effect.gen(function* () {
      const currentFPS = yield* performanceMonitor.getCurrentFPS()
      const settings = yield* Ref.get(qualitySettings)

      if (currentFPS < 30) {
        // パフォーマンスが低下している場合は品質を下げる
        const newSettings = {
          ...settings,
          redstoneTickRate: Math.max(settings.redstoneTickRate - 5, 5),
          weatherDetailLevel: "low" as const,
          mobAIComplexity: "simple" as const,
          particleCount: Math.max(settings.particleCount - 100, 100)
        }
        yield* Ref.set(qualitySettings, newSettings)
        yield* Effect.log("Performance optimization: Quality reduced")
      } else if (currentFPS > 55 && settings.weatherDetailLevel === "low") {
        // パフォーマンスに余裕がある場合は品質を上げる
        const newSettings = {
          ...settings,
          redstoneTickRate: Math.min(settings.redstoneTickRate + 2, 20),
          weatherDetailLevel: "medium" as const,
          mobAIComplexity: "enhanced" as const,
          particleCount: Math.min(settings.particleCount + 50, 1000)
        }
        yield* Ref.set(qualitySettings, newSettings)
        yield* Effect.log("Performance optimization: Quality increased")
      }
    }),

    getSettings: () => Ref.get(qualitySettings)
  }
})
```

### 3. バッチ処理最適化

```typescript
export const createEnhancedFeatureBatchProcessor = <T>(
  featureName: string,
  processItem: (item: T) => Effect.Effect<void, ProcessingError>,
  batchSize: number = 100,
  processingInterval: number = 16 // 60fps
) => Effect.gen(function* () {
  const queue = yield* Queue.unbounded<T>()
  const isRunning = yield* Ref.make(true)

  const processingFiber = yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        const shouldRun = yield* Ref.get(isRunning)
        if (!shouldRun) return

        const batch = yield* Queue.takeUpTo(queue, batchSize)
        if (batch.length > 0) {
          yield* Effect.forEach(
            batch,
            processItem,
            { concurrency: Math.min(batch.length, 4) }
          ).pipe(
            withFeatureLogging(featureName, `processing batch of ${batch.length}`)
          )
        }

        yield* Effect.sleep(processingInterval)
      })
    )
  )

  return {
    addItem: (item: T) => Queue.offer(queue, item),
    shutdown: () => Effect.gen(function* () {
      yield* Ref.set(isRunning, false)
      yield* Fiber.interrupt(processingFiber)
    }),
    getQueueSize: () => Queue.size(queue)
  }
})
```

## テスト戦略

```typescript
// Enhanced Features のテスト
import { Effect, TestContext, TestClock, TestRandom } from "effect"

describe("Enhanced Features", () => {
  const TestEnhancedLayer = Layer.mergeAll(
    TestRedstoneSystemLayer,
    TestWeatherSystemLayer,
    TestMobAISystemLayer,
    TestEnchantmentSystemLayer
  ).pipe(
    Layer.provide(TestContext.TestContext),
    Layer.provide(TestClock.TestClock),
    Layer.provide(TestRandom.TestRandom)
  )

  it("should coordinate multiple enhanced features", () =>
    Effect.gen(function* () {
      const manager = yield* EnhancedFeatureManager

      // 複数の機能を同時に有効化
      yield* Effect.all([
        manager.enableFeature("redstone"),
        manager.enableFeature("weather"),
        manager.enableFeature("day-night-cycle")
      ])

      const activeFeatures = yield* manager.getActiveFeatures()
      expect(activeFeatures).toContain("redstone")
      expect(activeFeatures).toContain("weather")
      expect(activeFeatures).toContain("day-night-cycle")
    }).pipe(
      Effect.provide(TestEnhancedLayer),
      Effect.runPromise
    ))

  it("should handle feature interactions correctly", () =>
    Effect.gen(function* () {
      // 天候変化が時間システムに影響することをテスト
      const timeSystem = yield* DayNightCycle
      const weatherSystem = yield* WeatherSystem

      yield* weatherSystem.setWeather("thunderstorm")
      yield* timeSystem.advanceTime(1000) // 1秒進める

      const currentLight = yield* timeSystem.getCurrentLightLevel()
      expect(currentLight).toBeLessThan(15) // 雷雨で暗くなる
    }).pipe(
      Effect.provide(TestEnhancedLayer),
      Effect.runPromise
    ))
})
```

## 機能一覧

### 基盤システム
- **Day/Night Cycle** - 時間システム
- **Weather System** - 環境効果

### ゲームプレイ拡張
- **Redstone System** - 回路とメカニズム
- **Mob AI System** - 動的なゲーム世界

### プレイヤー体験
- **Enchantment System** - アイテム強化
- **Potion Effects** - ステータス効果
- **Villager Trading** - NPC相互作用

### 高度な機能
- **Nether Portals** - 異次元システム

## Related Documents

**Core System Dependencies**:
- [Core Features Overview](../core-features/overview.md) - 基本システムとの統合
- [Entity System](../core-features/entity-system.md) - モブとエンティティ管理
- [World Management System](../core-features/world-management-system.md) - ワールド生成との連携
- [Physics System](../core-features/physics-system.md) - 物理エンジンとの統合

**Architecture**:
- [Overall Design](../../01-architecture/00-overall-design.md) - システム全体設計
- [Effect-TS Patterns](../../01-architecture/06-effect-ts-patterns.md) - 関数型プログラミングパターン
- [ECS Integration](../../01-architecture/05-ecs-integration.md) - ECSアーキテクチャとの統合

**Individual Enhanced Features**:
- [Redstone System](./redstone-system.md) - 回路とメカニクス
- [Weather System](./weather-system.md) - 動的天候システム
- [Day/Night Cycle](./day-night-cycle.md) - 時間と光源管理
- [Mob AI System](./mob-ai-system.md) - 人工知能とビヘイビア
- [Villager Trading](./villager-trading.md) - 経済と取引システム
- [Enchantment System](./enchantment-system.md) - アイテム強化
- [Potion Effects](./potion-effects.md) - ステータス効果管理
- [Nether Portals](./nether-portals.md) - 次元間移動
- [Structure Generation](./structure-generation.md) - 構造物自動生成
- [Multiplayer Architecture](./multiplayer-architecture.md) - マルチプレイヤー基盤

## Glossary Terms Used

- **Concurrent Processing**: 並行処理による高性能化 ([詳細](../../04-appendix/00-glossary.md#concurrency))
- **Domain Service (ドメインサービス)**: 複数アグリゲートにまたがるビジネスロジック ([詳細](../../04-appendix/00-glossary.md#domain-service))
- **Effect (エフェクト)**: Effect-TSの副作用管理型 ([詳細](../../04-appendix/00-glossary.md#effect))
- **Event Bus (イベントバス)**: ドメインイベントの発行・購読システム ([詳細](../../04-appendix/00-glossary.md#event-bus))
- **Layer (レイヤー)**: Effect-TSの依存性注入システム ([詳細](../../04-appendix/00-glossary.md#layered-architecture))
- **Procedural Generation (プロシージャル生成)**: アルゴリズムによる自動コンテンツ生成 ([詳細](../../04-appendix/00-glossary.md#procedural-generation))