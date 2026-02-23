---
title: '13 The End Dimension'
description: '13 The End Dimensionに関する詳細な説明とガイド。'
category: 'specification'
difficulty: 'intermediate'
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: '5分'
---

# The End Dimension（エンド次元）

TypeScript Minecraft Cloneにおけるエンドゲームコンテンツの最高峰として、The End Dimensionは高度な技術的実装とゲームプレイ設計の集大成です。Effect-TSの型安全性とDDDアーキテクチャを活用した包括的な異次元システムの設計と実装について詳述します。

## 🎯 アーキテクチャ概要

The End Dimensionは、以下の主要コンポーネントで構成される複雑なシステムです：

### コアドメイン構造

```
EndDimension/
├── Domain/
│   ├── Entities/
│   │   ├── EnderDragon.ts          # エンダードラゴン
│   │   ├── EndPortal.ts            # エンドポータル
│   │   ├── EndCrystal.ts           # エンドクリスタル
│   │   └── Shulker.ts              # シュルカー
│   ├── ValueObjects/
│   │   ├── DragonPhase.ts          # ドラゴンフェーズ
│   │   ├── EndCoordinate.ts        # エンド座標系
│   │   └── LevitationEffect.ts     # 浮遊効果
│   └── Services/
│       ├── DragonAI.ts             # ドラゴンAI
│       ├── EndGeneration.ts        # エンド地形生成
│       └── PortalTransition.ts     # 次元移動
├── Application/
│   ├── UseCases/
│   │   ├── InitiateDragonFight.ts  # ドラゴン戦開始
│   │   ├── HandlePortalActivation.ts # ポータル起動
│   │   └── ProcessDragonDefeat.ts   # ドラゴン討伐処理
│   └── EventHandlers/
│       ├── DragonStateChanged.ts   # ドラゴン状態変更
│       └── CrystalDestroyed.ts     # クリスタル破壊
└── Infrastructure/
    ├── Generators/
    │   ├── EndTerrainGenerator.ts  # エンド地形生成
    │   └── EndStructureGenerator.ts # エンド構造生成
    └── AI/
        ├── DragonBehaviorTree.ts   # ドラゴン行動木
        └── ShulkerAI.ts           # シュルカーAI
```

## 🌌 エンドポータルシステム

### Schema駆動設計

```typescript
// エンドポータルの型安全な定義
const EndPortalSchema = Schema.Struct({
  _tag: Schema.Literal('EndPortal'),
  position: PositionSchema,
  frameBlocks: Schema.Array(EndPortalFrameSchema, { minItems: 12, maxItems: 12 }),
  isActivated: Schema.Boolean,
  eyeCount: Schema.Number.pipe(Schema.between(0, 12)),
  strongholdId: StrongholdIdSchema,
})

const EndPortalFrameSchema = Schema.Struct({
  position: PositionSchema,
  hasEye: Schema.Boolean,
  facing: DirectionSchema,
})

type EndPortal = typeof EndPortalSchema.Type
type EndPortalFrame = typeof EndPortalFrameSchema.Type
```

### ポータル起動の実装

```typescript
// エンドポータルサービス
export interface EndPortalService {
  readonly activatePortal: (portalId: EndPortalId) => Effect.Effect<void, PortalActivationError>
  readonly teleportToEnd: (playerId: PlayerId, portalId: EndPortalId) => Effect.Effect<void, TeleportationError>
  readonly checkActivationRequirements: (portalId: EndPortalId) => Effect.Effect<ActivationStatus, PortalError>
}

export const EndPortalService = Context.GenericTag<EndPortalService>('@minecraft/EndPortalService')

// ポータル起動ロジック
const activateEndPortal = (portalId: EndPortalId) =>
  Effect.gen(function* () {
    const portalService = yield* EndPortalService
    const worldService = yield* WorldService

    // すべてのフレームにエンダーアイが配置されているか確認
    const portal = yield* worldService.getEndPortal(portalId)
    const requiredEyes = portal.frameBlocks.filter((frame) => !frame.hasEye)

    if (requiredEyes.length > 0) {
      return yield* Effect.fail(new InsufficientEyesError({ missingEyes: requiredEyes.length }))
    }

    // ポータル起動エフェクト
    yield* pipe(
      Effect.all(
        [
          createPortalActivationEffect(portal.position),
          playPortalActivationSound(portal.position),
          broadcastPortalActivationEvent(portalId),
        ],
        { concurrency: 'unbounded' }
      )
    )

    // ポータル状態更新
    return yield* worldService.updateEndPortal(portalId, { isActivated: true })
  })
```

### 次元移動メカニズム

```typescript
// 次元移動の型安全な実装
const DimensionTransitionSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  fromDimension: DimensionSchema,
  toDimension: DimensionSchema,
  transitionType: Schema.Literal('portal', 'command', 'death'),
  preserveInventory: Schema.Boolean,
  spawnPosition: Schema.optional(PositionSchema),
})

// 次元移動サービス
const executeEndTransition = (playerId: PlayerId, portalId: EndPortalId) =>
  Effect.gen(function* () {
    const playerService = yield* PlayerService
    const dimensionService = yield* DimensionService

    // プレイヤー状態保存
    const playerState = yield* playerService.capturePlayerState(playerId)

    // エンド次元への移動
    const endSpawnPosition = yield* calculateEndSpawnPosition()
    yield* dimensionService.transferPlayer(playerId, {
      dimension: 'end',
      position: endSpawnPosition,
      preserveInventory: true,
    })

    // エフェクト演出
    yield* pipe(
      Effect.all(
        [
          playDimensionTransitionSound(playerId),
          createTeleportationParticles(endSpawnPosition),
          updatePlayerDimensionHistory(playerId, 'end'),
        ],
        { concurrency: 'unbounded' }
      )
    )
  })
```

## 🐲 エンダードラゴン システム

### ドラゴンAIの状態管理

```typescript
// ドラゴンの行動フェーズ
const DragonPhaseSchema = Schema.TaggedUnion('type', [
  Schema.Struct({
    type: Schema.Literal('circling'),
    targetHeight: Schema.Number,
    circlingRadius: Schema.Number,
    speed: Schema.Number,
  }),
  Schema.Struct({
    type: Schema.Literal('charging'),
    targetPlayer: PlayerIdSchema,
    chargeSpeed: Schema.Number,
    damageAmount: Schema.Number,
  }),
  Schema.Struct({
    type: Schema.Literal('perching'),
    perchPosition: PositionSchema,
    perchDuration: Schema.Number,
    isVulnerable: Schema.Boolean,
  }),
  Schema.Struct({
    type: Schema.Literal('breathing'),
    breathTarget: PositionSchema,
    breathDuration: Schema.Number,
    damageRadius: Schema.Number,
  }),
  Schema.Struct({
    type: Schema.Literal('dying'),
    deathAnimation: Schema.Boolean,
    experienceAmount: Schema.Number,
  }),
])

type DragonPhase = typeof DragonPhaseSchema.Type
```

### ドラゴンエンティティ

```typescript
// エンダードラゴンエンティティ
const EnderDragonSchema = Schema.Struct({
  _tag: Schema.Literal('EnderDragon'),
  id: EntityIdSchema,
  position: PositionSchema,
  health: Schema.Number.pipe(Schema.between(0, 200)), // 通常200HP
  maxHealth: Schema.Number,
  currentPhase: DragonPhaseSchema,
  targetPlayer: Schema.optional(PlayerIdSchema),
  crystalsLinked: Schema.Array(EndCrystalIdSchema),
  isInvulnerable: Schema.Boolean,
  lastDamageTime: Schema.DateTimeUtc,
  experienceDropped: Schema.Number,
})

// ドラゴンAIサービス
export interface DragonAIService {
  readonly updateDragonBehavior: (dragonId: EntityId) => Effect.Effect<void, DragonAIError>
  readonly transitionPhase: (dragonId: EntityId, newPhase: DragonPhase) => Effect.Effect<void, PhaseTransitionError>
  readonly handleDamage: (
    dragonId: EntityId,
    damage: number,
    source: DamageSource
  ) => Effect.Effect<DamageResult, DamageError>
  readonly calculateNextAction: (dragonId: EntityId) => Effect.Effect<DragonAction, AIError>
}

export const DragonAIService = Context.GenericTag<DragonAIService>('@minecraft/DragonAIService')
```

### ドラゴン戦闘システム

```typescript
// ドラゴン戦闘の実装
const processDragonCombat = (dragonId: EntityId) =>
  Effect.gen(function* () {
    const dragonAI = yield* DragonAIService
    const combatService = yield* CombatService
    const dragon = yield* EntityService.getEntity(dragonId)

    if (dragon._tag !== 'EnderDragon') {
      return yield* Effect.fail(new InvalidEntityTypeError({ expected: 'EnderDragon', actual: dragon._tag }))
    }

    // フェーズベースの行動決定
    const nextAction = yield* pipe(
      dragon.currentPhase,
      Match.value,
      Match.when({ type: 'circling' }, (phase) => calculateCirclingMovement(dragon, phase)),
      Match.when({ type: 'charging' }, (phase) => executePlayerCharge(dragon, phase)),
      Match.when({ type: 'perching' }, (phase) => handlePerchingBehavior(dragon, phase)),
      Match.when({ type: 'breathing' }, (phase) => executeBreathAttack(dragon, phase)),
      Match.exhaustive
    )

    // アクション実行
    yield* dragonAI.executeAction(dragonId, nextAction)

    // クリスタル回復チェック
    if (dragon.crystalsLinked.length > 0) {
      yield* processCrystalHealing(dragonId, dragon.crystalsLinked)
    }
  })

// クリスタル回復システム
const processCrystalHealing = (dragonId: EntityId, crystalIds: ReadonlyArray<EndCrystalId>) =>
  Effect.gen(function* () {
    const healingService = yield* HealingService
    const crystalService = yield* EndCrystalService

    // アクティブなクリスタルから回復
    const activeCrystals = yield* pipe(
      crystalIds,
      Effect.forEach((crystalId) => crystalService.getCrystal(crystalId)),
      Effect.map((crystals) => crystals.filter((crystal) => crystal.isActive))
    )

    if (activeCrystals.length > 0) {
      const healAmount = activeCrystals.length * 2 // クリスタル1個につき2HP/秒
      yield* healingService.healEntity(dragonId, healAmount)

      // 回復エフェクト
      yield* createHealingBeamEffect(dragonId, activeCrystals)
    }
  })
```

## 💎 エンドクリスタルシステム

### クリスタル管理

```typescript
// エンドクリスタル定義
const EndCrystalSchema = Schema.Struct({
  _tag: Schema.Literal('EndCrystal'),
  id: EndCrystalIdSchema,
  position: PositionSchema,
  isActive: Schema.Boolean,
  pillarHeight: Schema.Number,
  linkedDragon: Schema.optional(EntityIdSchema),
  health: Schema.Number.pipe(Schema.between(0, 1)), // 1回の攻撃で破壊
  regenerationTime: Schema.optional(Schema.DateTimeUtc),
})

// クリスタル配置パターン
const CRYSTAL_POSITIONS = [
  { x: 0, y: 104, z: 0 }, // 中央
  { x: 40, y: 103, z: 0 }, // 北
  { x: -40, y: 103, z: 0 }, // 南
  { x: 0, y: 103, z: 40 }, // 東
  { x: 0, y: 103, z: -40 }, // 西
  { x: 28, y: 108, z: 28 }, // 北東
  { x: -28, y: 108, z: 28 }, // 南東
  { x: 28, y: 108, z: -28 }, // 北西
  { x: -28, y: 108, z: -28 }, // 南西
  { x: 61, y: 100, z: 0 }, // 外周北
] as const

// クリスタル破壊処理
const destroyEndCrystal = (crystalId: EndCrystalId, damageSource: DamageSource) =>
  Effect.gen(function* () {
    const crystalService = yield* EndCrystalService
    const explosionService = yield* ExplosionService
    const eventService = yield* EventService

    const crystal = yield* crystalService.getCrystal(crystalId)

    // 爆発エフェクト
    yield* explosionService.createExplosion({
      position: crystal.position,
      power: 6.0, // 強力な爆発
      damageEntities: true,
      destroyBlocks: false,
      particleEffect: 'end_crystal_explosion',
    })

    // クリスタル削除
    yield* crystalService.removeCrystal(crystalId)

    // ドラゴンからのリンク解除
    if (crystal.linkedDragon) {
      yield* DragonService.unlinkCrystal(crystal.linkedDragon, crystalId)
    }

    // イベント発行
    yield* eventService.publishEvent({
      type: 'CrystalDestroyed',
      crystalId,
      position: crystal.position,
      destroyedBy: damageSource,
    })
  })
```

## 🏛 エンドシティ生成システム

### 構造生成アルゴリズム

```typescript
// エンドシティ生成スキーマ
const EndCityStructureSchema = Schema.Struct({
  id: StructureIdSchema,
  basePosition: PositionSchema,
  floors: Schema.Array(EndCityFloorSchema),
  hasEndShip: Schema.Boolean,
  shipPosition: Schema.optional(PositionSchema),
  shulkerSpawns: Schema.Array(ShulkerSpawnSchema),
  lootChests: Schema.Array(LootChestSchema),
})

const EndCityFloorSchema = Schema.Struct({
  level: Schema.Number,
  roomType: Schema.Literal('base', 'tower', 'bridge', 'ship_dock'),
  dimensions: Schema.Struct({
    width: Schema.Number,
    length: Schema.Number,
    height: Schema.Number,
  }),
  connections: Schema.Array(Schema.Literal('north', 'south', 'east', 'west', 'up', 'down')),
})

// エンドシティ生成サービス
export interface EndCityGenerator {
  readonly generateEndCity: (basePosition: Position) => Effect.Effect<EndCityStructure, GenerationError>
  readonly generateEndShip: (cityPosition: Position) => Effect.Effect<EndShip, GenerationError>
  readonly populateWithLoot: (cityId: StructureId) => Effect.Effect<void, LootError>
  readonly spawnShulkers: (cityId: StructureId) => Effect.Effect<void, SpawnError>
}

// プロシージャル生成の実装
const generateEndCityStructure = (basePosition: Position) =>
  Effect.gen(function* () {
    const generator = yield* EndCityGenerator
    const random = yield* RandomService

    // 基本構造決定
    const cityHeight = yield* random.nextInt(3, 8) // 3-7階建て
    const hasShip = yield* random.nextBoolean(0.15) // 15%の確率でエンドシップ

    // フロア生成
    const floors = yield* pipe(
      Array.from({ length: cityHeight }, (_, i) => i),
      Effect.forEach((level) => generateCityFloor(level, basePosition))
    )

    // 構造体組み立て
    const city: EndCityStructure = {
      id: yield* generateStructureId(),
      basePosition,
      floors,
      hasEndShip: hasShip,
      shipPosition: hasShip ? calculateShipPosition(basePosition, floors) : undefined,
      shulkerSpawns: yield* calculateShulkerSpawns(floors),
      lootChests: yield* generateLootChests(floors),
    }

    return city
  })
```

## 🔮 シュルカー AI システム

### シュルカー行動パターン

```typescript
// シュルカーエンティティ
const ShulkerSchema = Schema.Struct({
  _tag: Schema.Literal('Shulker'),
  id: EntityIdSchema,
  position: PositionSchema,
  health: Schema.Number.pipe(Schema.between(0, 30)),
  isOpen: Schema.Boolean,
  attachedFace: DirectionSchema,
  targetPlayer: Schema.optional(PlayerIdSchema),
  lastProjectileTime: Schema.DateTimeUtc,
  projectileCooldown: Schema.Number,
  teleportCooldown: Schema.Number,
})

// シュルカー弾の実装
const ShulkerBulletSchema = Schema.Struct({
  _tag: Schema.Literal('ShulkerBullet'),
  id: ProjectileIdSchema,
  position: PositionSchema,
  velocity: VelocitySchema,
  target: PlayerIdSchema,
  shooter: EntityIdSchema,
  trackingAccuracy: Schema.Number,
  levitationDuration: Schema.Number,
})

// シュルカーAI
const updateShulkerBehavior = (shulkerId: EntityId) =>
  Effect.gen(function* () {
    const shulker = yield* EntityService.getEntity(shulkerId)
    const playerService = yield* PlayerService

    if (shulker._tag !== 'Shulker') return

    // 近くのプレイヤーを検索
    const nearbyPlayers = yield* playerService.getPlayersInRange(
      shulker.position,
      16 // 16ブロック半径
    )

    if (nearbyPlayers.length === 0) {
      // プレイヤーが居ない場合は殻を閉じる
      yield* updateShulkerState(shulkerId, { isOpen: false })
      return
    }

    const targetPlayer = nearbyPlayers[0]

    // シェル開放とプロジェクタイル発射
    if (!shulker.isOpen) {
      yield* updateShulkerState(shulkerId, { isOpen: true })
      yield* playShulkerOpenSound(shulker.position)
    }

    // プロジェクタイル発射
    const currentTime = yield* Clock.currentTimeMillis
    if (currentTime - shulker.lastProjectileTime > shulker.projectileCooldown) {
      yield* fireShulkerBullet(shulkerId, targetPlayer.id)
    }
  })

// シュルカー弾の挙動
const updateShulkerBullet = (bulletId: ProjectileId) =>
  Effect.gen(function* () {
    const bullet = yield* ProjectileService.getProjectile(bulletId)
    const playerService = yield* PlayerService

    if (bullet._tag !== 'ShulkerBullet') return

    const targetPlayer = yield* playerService.getPlayer(bullet.target)
    const targetPosition = targetPlayer.position

    // ホーミング移動
    const direction = normalizeVector(subtractVector(targetPosition, bullet.position))

    const newVelocity = scaleVector(direction, 0.15) // ゆっくりとした追尾
    const newPosition = addVector(bullet.position, newVelocity)

    // 着弾判定
    const distanceToTarget = calculateDistance(newPosition, targetPosition)
    if (distanceToTarget < 1.0) {
      yield* handleShulkerBulletHit(bulletId, bullet.target)
    } else {
      yield* ProjectileService.updateProjectile(bulletId, {
        position: newPosition,
        velocity: newVelocity,
      })
    }
  })

// 浮遊効果の適用
const applyLevitationEffect = (playerId: PlayerId, duration: number) =>
  Effect.gen(function* () {
    const effectService = yield* EffectService

    yield* effectService.applyEffect(playerId, {
      type: 'levitation',
      level: 1,
      duration: duration * 20, // ticks (20 ticks = 1 second)
      particles: true,
      ambient: false,
    })

    yield* playLevitationSound(playerId)
  })
```

## 🎮 UI統合とゲーム体験

### ボスバー実装

```typescript
// ドラゴン戦ボスバー
const DragonBossBarSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  progress: Schema.Number.pipe(Schema.between(0, 1)),
  color: Schema.Literal('pink', 'red', 'purple'),
  style: Schema.Literal('progress', 'notched_6', 'notched_10', 'notched_12', 'notched_20'),
  visible: Schema.Boolean,
})

// ボスバー管理
const updateDragonBossBar = (dragonId: EntityId) =>
  Effect.gen(function* () {
    const dragon = yield* EntityService.getEntity(dragonId)
    const uiService = yield* UIService

    if (dragon._tag !== 'EnderDragon') return

    const healthPercentage = dragon.health / dragon.maxHealth
    const barColor = pipe(
      healthPercentage,
      Match.value,
      Match.when(
        (p) => p > 0.75,
        () => 'pink' as const
      ),
      Match.when(
        (p) => p > 0.25,
        () => 'purple' as const
      ),
      Match.orElse(() => 'red' as const)
    )

    yield* uiService.updateBossBar({
      id: `dragon_${dragonId}`,
      title: 'Ender Dragon',
      progress: healthPercentage,
      color: barColor,
      style: 'progress',
      visible: true,
    })
  })
```

### エンドクレジットシステム

```typescript
// エンドクレジットの実装
const triggerEndCredits = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const creditService = yield* CreditService
    const achievementService = yield* AchievementService

    // 実績解除
    yield* achievementService.unlockAchievement(playerId, 'kill_dragon')
    yield* achievementService.unlockAchievement(playerId, 'reach_the_end')

    // クレジット表示
    yield* creditService.displayCredits(playerId, {
      scrollSpeed: 40, // ゆっくりスクロール
      backgroundMusic: 'end_credits',
      skipEnabled: true,
      onComplete: () => showPostCreditOptions(playerId),
    })
  })
```

## 📊 パフォーマンス最適化

### エンドディメンションの効率的管理

```typescript
// エンドディメンション専用の最適化
const optimizeEndDimension = Effect.gen(function* () {
  const performanceService = yield* PerformanceService

  // ドラゴンAI処理の最適化
  yield* performanceService.setTickRate('dragon_ai', 2) // 10 TPS

  // パーティクルエフェクトの調整
  yield* performanceService.setParticleLimit('end_dimension', 1000)

  // 遠距離オブジェクトのカリング
  yield* performanceService.enableFrustumCulling('end_dimension', {
    maxDistance: 128,
    excludeEntities: ['EnderDragon'],
  })

  // メモリプールの事前確保
  yield* performanceService.preallocateMemory('end_crystals', 12)
  yield* performanceService.preallocateMemory('shulker_bullets', 50)
})
```

## ✅ 包括的テストスイート

```typescript
// エンドディメンション統合テスト
describe('End Dimension Integration', () => {
  it('should complete full dragon fight sequence', () =>
    Effect.gen(function* () {
      const testEnv = yield* createTestEnvironment()

      // 1. ポータル起動
      const portal = yield* createTestEndPortal()
      yield* activateEndPortal(portal.id)

      // 2. プレイヤー転送
      const playerId = yield* createTestPlayer()
      yield* teleportToEnd(playerId, portal.id)

      // 3. ドラゴン戦開始
      const dragon = yield* spawnEnderDragon()
      yield* initiateDragonFight(dragon.id, playerId)

      // 4. クリスタル破壊シミュレーション
      const crystals = yield* getAllEndCrystals()
      yield* pipe(
        crystals,
        Effect.forEach((crystal) => destroyEndCrystal(crystal.id, { type: 'player', id: playerId }))
      )

      // 5. ドラゴン討伐
      yield* dealDamageToEntity(dragon.id, 200, { type: 'player', id: playerId })

      // 6. 戦闘完了検証
      const dragonState = yield* EntityService.getEntity(dragon.id)
      const portalState = yield* getExitPortal()

      expect(dragonState.health).toBe(0)
      expect(portalState.isActive).toBe(true)
    }).pipe(Effect.provide(testEndDimensionLayer)))
})
```

**★ Insight ─────────────────────────────────────**
The End Dimensionは、Effect-TSの型安全性とDDDアーキテクチャを活用した高度なゲームシステムの典型例です。Context.GenericTagによるサービス注入、Schema.Structによる型安全なデータモデリング、Effect.genによる非同期処理の合成が、複雑なボス戦システムを管理可能にしています。
**─────────────────────────────────────────────────**

この包括的なエンドディメンション実装により、TypeScript Minecraft Cloneは本家Minecraftに匹敵する高品質なエンドゲーム体験を提供できます。
