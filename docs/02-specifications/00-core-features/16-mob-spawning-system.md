---
title: "16 Mob Spawning System"
description: "16 Mob Spawning Systemに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "25分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Mob Spawning System（モブスポーンシステム）

## 概要

ゲーム世界に動的にモンスター・動物・NPCを生成する重要なシステムです。バイオーム・時間・明度・難易度・プレイヤーの行動に応じて適切なモブを自動生成し、ゲーム世界に生命感と挑戦をもたらします。

## アーキテクチャ設計

### Schema定義

```typescript
import { Schema } from "effect"

// スポーン条件
export const SpawnCondition = Schema.Struct({
  biome: Schema.Array(Schema.String), // 許可バイオーム
  lightLevel: Schema.Struct({
    min: Schema.Number.pipe(Schema.min(0), Schema.max(15)),
    max: Schema.Number.pipe(Schema.min(0), Schema.max(15))
  }),
  timeOfDay: Schema.optional(Schema.Struct({
    start: Schema.Number.pipe(Schema.min(0), Schema.max(24000)), // ticks
    end: Schema.Number.pipe(Schema.min(0), Schema.max(24000))
  })),
  altitude: Schema.optional(Schema.Struct({
    min: Schema.Number.pipe(Schema.min(-64), Schema.max(320)),
    max: Schema.Number.pipe(Schema.min(-64), Schema.max(320))
  })),
  moonPhase: Schema.optional(Schema.Union(
    Schema.Literal("new_moon"),
    Schema.Literal("waxing_crescent"),
    Schema.Literal("first_quarter"),
    Schema.Literal("waxing_gibbous"),
    Schema.Literal("full_moon"),
    Schema.Literal("waning_gibbous"),
    Schema.Literal("third_quarter"),
    Schema.Literal("waning_crescent")
  )),
  difficulty: Schema.Array(Schema.Union(
    Schema.Literal("peaceful"),
    Schema.Literal("easy"),
    Schema.Literal("normal"),
    Schema.Literal("hard")
  )),
  blockRequirement: Schema.optional(Schema.Struct({
    blockType: Schema.String,
    range: Schema.Number.pipe(Schema.positive())
  })),
  playerDistance: Schema.optional(Schema.Struct({
    min: Schema.Number.pipe(Schema.min(0)),
    max: Schema.Number.pipe(Schema.min(0))
  }))
})

export type SpawnCondition = Schema.Schema.Type<typeof SpawnCondition>

// モブスポーン定義
export const MobSpawnEntry = Schema.Struct({
  mobType: Schema.String.pipe(Schema.brand("MobType")),
  weight: Schema.Number.pipe(Schema.positive()), // スポーン重み
  minGroupSize: Schema.Number.pipe(Schema.int(), Schema.min(1)),
  maxGroupSize: Schema.Number.pipe(Schema.int(), Schema.min(1)),
  spawnConditions: SpawnCondition,
  maxCount: Schema.Number.pipe(Schema.int(), Schema.min(1)), // チャンクあたりの最大数
  rarity: Schema.Union(
    Schema.Literal("common"),    // 10+%
    Schema.Literal("uncommon"),  // 1-10%
    Schema.Literal("rare"),      // 0.1-1%
    Schema.Literal("epic"),      // 0.01-0.1%
    Schema.Literal("legendary")  // <0.01%
  ),
  cooldown: Schema.Number.pipe(Schema.min(0)), // スポーン間隔（ミリ秒）
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

export type MobSpawnEntry = Schema.Schema.Type<typeof MobSpawnEntry>

// スポーンイベント
export const MobSpawnEvent = Schema.Struct({
  _tag: Schema.Literal("MobSpawnEvent"),
  mobType: Schema.String.pipe(Schema.brand("MobType")),
  entityId: Schema.String.pipe(Schema.brand("EntityId")),
  position: Position,
  chunk: ChunkCoordinate,
  spawnReason: Schema.Union(
    Schema.Literal("natural"),        // 自然スポーン
    Schema.Literal("spawner"),        // スポナーブロック
    Schema.Literal("structure"),      // 構造物生成
    Schema.Literal("event"),          // イベントスポーン
    Schema.Literal("command"),        // コマンド生成
    Schema.Literal("breeding"),       // 繁殖
    Schema.Literal("conversion")      // 変身（ゾンビ→ドラウンド等）
  ),
  groupSize: Schema.Number.pipe(Schema.int(), Schema.min(1)),
  timestamp: Schema.DateTimeUtc,
  conditions: Schema.Struct({
    lightLevel: Schema.Number,
    timeOfDay: Schema.Number,
    difficulty: Schema.String,
    biome: Schema.String
  })
})

export type MobSpawnEvent = Schema.Schema.Type<typeof MobSpawnEvent>

// スポーン管理データ
export const SpawnManager = Schema.Struct({
  chunkCoord: ChunkCoordinate,
  activeSpawns: Schema.Array(Schema.Struct({
    entityId: Schema.String.pipe(Schema.brand("EntityId")),
    mobType: Schema.String.pipe(Schema.brand("MobType")),
    spawnTime: Schema.DateTimeUtc,
    lastActivity: Schema.DateTimeUtc
  })),
  spawnCooldowns: Schema.Record(
    Schema.String.pipe(Schema.brand("MobType")),
    Schema.Number // 次回スポーン可能時間
  ),
  lastSpawnAttempt: Schema.DateTimeUtc,
  spawnCapReached: Schema.Boolean.pipe(Schema.default(() => false))
})

export type SpawnManager = Schema.Schema.Type<typeof SpawnManager>

// スポーン統計
export const SpawnStatistics = Schema.Struct({
  chunkCoord: ChunkCoordinate,
  totalSpawns: Schema.Number.pipe(Schema.int(), Schema.min(0)),
  spawnsByType: Schema.Record(Schema.String, Schema.Number),
  averageSpawnRate: Schema.Number.pipe(Schema.min(0)), // spawns per minute
  peakSpawnTime: Schema.Number.pipe(Schema.min(0), Schema.max(24000)),
  lastReset: Schema.DateTimeUtc
})

export type SpawnStatistics = Schema.Schema.Type<typeof SpawnStatistics>
```

### Service定義

```typescript
// Mob Spawning Service Interface
export interface MobSpawningServiceInterface {
  // スポーン実行
  readonly attemptSpawn: (chunkCoord: ChunkCoordinate, conditions: EnvironmentConditions) =>
    Effect.Effect<ReadonlyArray<MobSpawnEvent>, SpawnError>
  readonly spawnMob: (mobType: string, position: Position, spawnReason: string) =>
    Effect.Effect<MobSpawnEvent, SpawnError>
  readonly spawnGroup: (mobType: string, centerPosition: Position, groupSize: number) =>
    Effect.Effect<ReadonlyArray<MobSpawnEvent>, SpawnError>

  // スポーン条件判定
  readonly canSpawnAt: (mobType: string, position: Position, conditions: EnvironmentConditions) =>
    Effect.Effect<boolean, never>
  readonly findValidSpawnPositions: (chunkCoord: ChunkCoordinate, mobType: string, count: number) =>
    Effect.Effect<ReadonlyArray<Position>, SpawnError>
  readonly calculateSpawnChance: (mobEntry: MobSpawnEntry, conditions: EnvironmentConditions) =>
    Effect.Effect<number, never>

  // スポーン管理
  readonly getChunkSpawnManager: (chunkCoord: ChunkCoordinate) =>
    Effect.Effect<SpawnManager, never>
  readonly updateSpawnCap: (chunkCoord: ChunkCoordinate) =>
    Effect.Effect<number, never> // 現在のモブ数を返す
  readonly cleanupDespawnedMobs: (chunkCoord: ChunkCoordinate) =>
    Effect.Effect<number, never> // 削除されたモブ数

  // 難易度・設定
  readonly setDifficultyMultiplier: (difficulty: string, multiplier: number) =>
    Effect.Effect<void, never>
  readonly enableMobType: (mobType: string, enabled: boolean) =>
    Effect.Effect<void, never>
  readonly setSpawnRate: (globalMultiplier: number) =>
    Effect.Effect<void, never>

  // 統計・デバッグ
  readonly getSpawnStatistics: (chunkCoord: ChunkCoordinate) =>
    Effect.Effect<SpawnStatistics, never>
  readonly getGlobalSpawnRate: () =>
    Effect.Effect<number, never>
  readonly debugSpawnInfo: (position: Position) =>
    Effect.Effect<SpawnDebugInfo, never>
}

export const MobSpawningService = Context.GenericTag<MobSpawningServiceInterface>("@app/MobSpawningService")

// デバッグ情報
export const SpawnDebugInfo = Schema.Struct({
  position: Position,
  lightLevel: Schema.Number,
  biome: Schema.String,
  blockType: Schema.String,
  canSpawn: Schema.Record(Schema.String, Schema.Boolean),
  spawnChances: Schema.Record(Schema.String, Schema.Number),
  nearbyMobCount: Schema.Number,
  chunkSpawnCap: Schema.Number
})

export type SpawnDebugInfo = Schema.Schema.Type<typeof SpawnDebugInfo>
```

### 実装パターン

```typescript
// Mob Spawning Service 実装
export const MobSpawningServiceLive = Layer.effect(
  MobSpawningService,
  Effect.gen(function* () {
    const spawnManagers = yield* Ref.make(new Map<string, SpawnManager>())
    const spawnStatistics = yield* Ref.make(new Map<string, SpawnStatistics>())
    const globalSettings = yield* Ref.make({
      spawnRate: 1.0,
      difficultyMultipliers: {
        peaceful: 0.0,
        easy: 0.5,
        normal: 1.0,
        hard: 1.5
      },
      enabledMobs: new Set<string>()
    })

    const gameTime = yield* GameTimeService
    const worldService = yield* WorldService
    const biomeService = yield* BiomeService
    const entityService = yield* EntityService
    const eventBus = yield* EventBusService

    return MobSpawningService.of({
      attemptSpawn: (chunkCoord, conditions) =>
        Effect.gen(function* () {
          const manager = yield* MobSpawningService.getChunkSpawnManager(chunkCoord)
          const settings = yield* Ref.get(globalSettings)

          // スポーンキャップチェック
          const currentMobCount = yield* MobSpawningService.updateSpawnCap(chunkCoord)
          const maxMobs = calculateMaxMobsForChunk(conditions.difficulty)

          if (currentMobCount >= maxMobs) {
            return []
          }

          // 適用可能なモブタイプを取得
          const applicableMobs = yield* getApplicableMobTypes(chunkCoord, conditions)
          if (applicableMobs.length === 0) {
            return []
          }

          // 重み付き選択でモブタイプを決定
          const selectedMob = yield* selectWeightedMobType(applicableMobs, conditions)
          if (!selectedMob) {
            return []
          }

          // スポーン位置を検索
          const spawnPositions = yield* MobSpawningService.findValidSpawnPositions(
            chunkCoord,
            selectedMob.mobType,
            selectedMob.maxGroupSize
          )

          if (spawnPositions.length === 0) {
            return []
          }

          // グループサイズを決定
          const groupSize = Math.min(
            spawnPositions.length,
            Math.floor(Math.random() * (selectedMob.maxGroupSize - selectedMob.minGroupSize + 1)) + selectedMob.minGroupSize
          )

          // モブをスポーン
          const spawnEvents = yield* Effect.forEach(
            spawnPositions.slice(0, groupSize),
            (position) => MobSpawningService.spawnMob(selectedMob.mobType, position, "natural")
          )

          // スポーン統計の更新
          yield* updateSpawnStatistics(chunkCoord, spawnEvents)

          return spawnEvents
        }),

      spawnMob: (mobType, position, spawnReason) =>
        Effect.gen(function* () {
          // エンティティの作成
          const entityData = yield* createMobEntity(mobType, position)
          const entityId = yield* entityService.spawnEntity(entityData)

          // スポーンイベントの生成
          const spawnEvent: MobSpawnEvent = {
            _tag: "MobSpawnEvent",
            mobType,
            entityId,
            position,
            chunk: worldToChunkCoordinate(position),
            spawnReason,
            groupSize: 1,
            timestamp: new Date(),
            conditions: {
              lightLevel: yield* worldService.getLightLevel(position),
              timeOfDay: yield* gameTime.getTimeOfDay(),
              difficulty: yield* worldService.getDifficulty(),
              biome: yield* biomeService.getBiomeAt(position)
            }
          }

          // イベント配信
          yield* eventBus.publish(spawnEvent)

          // スポーンマネージャーの更新
          const chunkCoord = worldToChunkCoordinate(position)
          yield* updateSpawnManager(chunkCoord, spawnEvent)

          return spawnEvent
        }),

      canSpawnAt: (mobType, position, conditions) =>
        Effect.gen(function* () {
          const mobEntry = SPAWN_ENTRIES.get(mobType)
          if (!mobEntry) {
            return false
          }

          const spawnConditions = mobEntry.spawnConditions

          // バイオーム条件
          if (!spawnConditions.biome.includes(conditions.biome)) {
            return false
          }

          // 明度条件
          if (conditions.lightLevel < spawnConditions.lightLevel.min ||
              conditions.lightLevel > spawnConditions.lightLevel.max) {
            return false
          }

          // 時間条件
          if (spawnConditions.timeOfDay) {
            const timeInRange = isTimeInRange(
              conditions.timeOfDay,
              spawnConditions.timeOfDay.start,
              spawnConditions.timeOfDay.end
            )
            if (!timeInRange) {
              return false
            }
          }

          // 高度条件
          if (spawnConditions.altitude) {
            if (position.y < spawnConditions.altitude.min ||
                position.y > spawnConditions.altitude.max) {
              return false
            }
          }

          // 難易度条件
          if (!spawnConditions.difficulty.includes(conditions.difficulty)) {
            return false
          }

          // ブロック要件
          if (spawnConditions.blockRequirement) {
            const hasRequiredBlock = yield* worldService.hasBlockInRange(
              position,
              spawnConditions.blockRequirement.blockType,
              spawnConditions.blockRequirement.range
            )
            if (!hasRequiredBlock) {
              return false
            }
          }

          // プレイヤー距離条件
          if (spawnConditions.playerDistance) {
            const nearestPlayerDistance = yield* entityService.getNearestPlayerDistance(position)
            if (nearestPlayerDistance < spawnConditions.playerDistance.min ||
                nearestPlayerDistance > spawnConditions.playerDistance.max) {
              return false
            }
          }

          // 地形・構造チェック
          const isValidTerrain = yield* checkTerrainValidity(position, mobType)
          if (!isValidTerrain) {
            return false
          }

          return true
        }),

      findValidSpawnPositions: (chunkCoord, mobType, count) =>
        Effect.gen(function* () {
          const validPositions: Position[] = []
          const attempts = count * 10 // 試行回数制限

          for (let i = 0; i < attempts && validPositions.length < count; i++) {
            // チャンク内のランダム位置を生成
            const position = {
              x: chunkCoord.x * 16 + Math.floor(Math.random() * 16),
              y: 64 + Math.floor(Math.random() * 128), // Y64-192の範囲
              z: chunkCoord.z * 16 + Math.floor(Math.random() * 16)
            }

            // 地表を検索
            const surfaceY = yield* worldService.findSurfaceLevel(position.x, position.z)
            if (surfaceY === null) {
              continue
            }

            const surfacePosition = { ...position, y: surfaceY + 1 }

            // スポーン条件をチェック
            const conditions = {
              biome: yield* biomeService.getBiomeAt(surfacePosition),
              lightLevel: yield* worldService.getLightLevel(surfacePosition),
              timeOfDay: yield* gameTime.getTimeOfDay(),
              difficulty: yield* worldService.getDifficulty()
            }

            const canSpawn = yield* MobSpawningService.canSpawnAt(mobType, surfacePosition, conditions)
            if (canSpawn) {
              validPositions.push(surfacePosition)
            }
          }

          return validPositions
        }),

      calculateSpawnChance: (mobEntry, conditions) =>
        Effect.gen(function* () {
          let baseChance = mobEntry.weight / 100 // 基本確率

          // 難易度修正
          const settings = yield* Ref.get(globalSettings)
          const difficultyMultiplier = settings.difficultyMultipliers[conditions.difficulty] || 1.0
          baseChance *= difficultyMultiplier

          // 月相修正（敵対モブは満月に多くスポーン）
          if (conditions.moonPhase === "full_moon" && isHostileMob(mobEntry.mobType)) {
            baseChance *= 1.5
          } else if (conditions.moonPhase === "new_moon" && isHostileMob(mobEntry.mobType)) {
            baseChance *= 0.5
          }

          // 時間修正（夜行性モブ等）
          baseChance *= getTimeOfDayMultiplier(mobEntry.mobType, conditions.timeOfDay)

          // レア度修正
          const rarityMultiplier = {
            common: 1.0,
            uncommon: 0.3,
            rare: 0.1,
            epic: 0.05,
            legendary: 0.01
          }[mobEntry.rarity]

          baseChance *= rarityMultiplier

          // グローバルスポーン率適用
          baseChance *= settings.spawnRate

          return Math.min(1.0, Math.max(0.0, baseChance))
        })
    })
  })
)

// スポーンエントリの定義
export const SPAWN_ENTRIES = new Map<string, MobSpawnEntry>([
  ["zombie", {
    mobType: "zombie",
    weight: 95,
    minGroupSize: 1,
    maxGroupSize: 4,
    spawnConditions: {
      biome: ["plains", "forest", "desert", "taiga"],
      lightLevel: { min: 0, max: 7 },
      timeOfDay: { start: 13000, end: 23000 }, // 夜間
      difficulty: ["easy", "normal", "hard"]
    },
    maxCount: 8,
    rarity: "common",
    cooldown: 20000 // 20秒
  }],

  ["skeleton", {
    mobType: "skeleton",
    weight: 80,
    minGroupSize: 1,
    maxGroupSize: 2,
    spawnConditions: {
      biome: ["plains", "forest", "mountains", "taiga"],
      lightLevel: { min: 0, max: 7 },
      timeOfDay: { start: 13000, end: 23000 },
      difficulty: ["easy", "normal", "hard"]
    },
    maxCount: 6,
    rarity: "common",
    cooldown: 25000
  }],

  ["creeper", {
    mobType: "creeper",
    weight: 100,
    minGroupSize: 1,
    maxGroupSize: 1,
    spawnConditions: {
      biome: ["plains", "forest", "desert", "taiga", "mountains"],
      lightLevel: { min: 0, max: 7 },
      difficulty: ["easy", "normal", "hard"]
    },
    maxCount: 5,
    rarity: "common",
    cooldown: 30000
  }],

  ["spider", {
    mobType: "spider",
    weight: 100,
    minGroupSize: 1,
    maxGroupSize: 1,
    spawnConditions: {
      biome: ["plains", "forest", "desert", "jungle"],
      lightLevel: { min: 0, max: 7 },
      difficulty: ["easy", "normal", "hard"]
    },
    maxCount: 6,
    rarity: "common",
    cooldown: 20000
  }],

  ["cow", {
    mobType: "cow",
    weight: 8,
    minGroupSize: 2,
    maxGroupSize: 4,
    spawnConditions: {
      biome: ["plains", "forest"],
      lightLevel: { min: 8, max: 15 }, // 昼間のみ
      difficulty: ["peaceful", "easy", "normal", "hard"]
    },
    maxCount: 10,
    rarity: "common",
    cooldown: 60000 // 1分
  }],

  ["enderman", {
    mobType: "enderman",
    weight: 10,
    minGroupSize: 1,
    maxGroupSize: 1,
    spawnConditions: {
      biome: ["plains", "desert", "end"],
      lightLevel: { min: 0, max: 7 },
      altitude: { min: 0, max: 256 },
      difficulty: ["easy", "normal", "hard"]
    },
    maxCount: 2,
    rarity: "uncommon",
    cooldown: 120000 // 2分
  }]
])
```

## スポーン管理詳細

### チャンク単位のスポーン制御

```typescript
// チャンクのスポーンキャップ計算
const calculateMaxMobsForChunk = (difficulty: string): number => {
  const baseCaps = {
    peaceful: 0,
    easy: 10,
    normal: 15,
    hard: 20
  }

  return baseCaps[difficulty] || 15
}

// アクティブモブの監視
const updateSpawnManager = (chunkCoord: ChunkCoordinate, spawnEvent: MobSpawnEvent) =>
  Effect.gen(function* () {
    const managers = yield* Ref.get(spawnManagers)
    const chunkKey = `${chunkCoord.x},${chunkCoord.z}`

    const manager = managers.get(chunkKey) || {
      chunkCoord,
      activeSpawns: [],
      spawnCooldowns: {},
      lastSpawnAttempt: new Date(),
      spawnCapReached: false
    }

    // 新しいスポーンを追加
    manager.activeSpawns.push({
      entityId: spawnEvent.entityId,
      mobType: spawnEvent.mobType,
      spawnTime: spawnEvent.timestamp,
      lastActivity: spawnEvent.timestamp
    })

    // クールダウンを設定
    const mobEntry = SPAWN_ENTRIES.get(spawnEvent.mobType)
    if (mobEntry) {
      const nextSpawnTime = Date.now() + mobEntry.cooldown
      manager.spawnCooldowns[spawnEvent.mobType] = nextSpawnTime
    }

    // マップを更新
    yield* Ref.update(spawnManagers, map => map.set(chunkKey, manager))
  })
```

### 特殊スポーン条件

```typescript
// バイオーム固有のスポーン処理
export const BiomeSpecificSpawning = {
  // 海洋バイオーム：魚・イカ・ドラウンド
  ocean: {
    underwaterSpawning: (position: Position) =>
      Effect.gen(function* () {
        // 水中かチェック
        const isUnderwater = yield* worldService.isPositionUnderwater(position)
        if (!isUnderwater) {
          return false
        }

        // 深度チェック
        const depth = yield* worldService.getWaterDepth(position)
        return depth >= 3 // 最低3ブロックの深さ
      })
  },

  // ネザーバイオーム：ブレイズ・ガスト・ゾンビピッグマン
  nether: {
    netherSpawning: (position: Position) =>
      Effect.gen(function* () {
        const dimension = yield* worldService.getDimension(position)
        if (dimension !== "nether") {
          return false
        }

        // 溶岩湖の近くかチェック
        const nearLava = yield* worldService.hasBlockInRange(position, "lava", 8)
        return nearLava
      })
  },

  // エンドバイオーム：エンダーマン・シュルカー
  end: {
    endSpawning: (position: Position) =>
      Effect.gen(function* () {
        const dimension = yield* worldService.getDimension(position)
        return dimension === "end"
      })
  }
}

// 構造物限定スポーン
export const StructureSpawning = {
  // ダンジョンスポーナー
  dungeon: {
    spawnerActivation: (spawnerPosition: Position, mobType: string) =>
      Effect.gen(function* () {
        // プレイヤーが16ブロック以内にいるかチェック
        const nearestPlayer = yield* entityService.getNearestPlayerDistance(spawnerPosition)
        if (nearestPlayer > 16) {
          return false
        }

        // スポナー周囲の明度チェック
        const lightLevel = yield* worldService.getLightLevel(spawnerPosition)
        return lightLevel <= 11
      })
  },

  // 要塞：シルバーフィッシュ
  stronghold: {
    silverfishInfestation: (position: Position) =>
      Effect.gen(function* () {
        const structure = yield* worldService.getStructureAt(position)
        return structure?.type === "stronghold"
      })
  }
}
```

### イベント駆動スポーン

```typescript
// 特殊イベントでのスポーン
export const EventDrivenSpawning = {
  // 雷による変身（豚→ゾンビピッグマン）
  lightningStrike: (position: Position) =>
    Effect.gen(function* () {
      const nearbyEntities = yield* entityService.getEntitiesInRange(position, 5)

      for (const entity of nearbyEntities) {
        if (entity.type === "pig") {
          // 豚をゾンビピッグマンに変身
          yield* entityService.removeEntity(entity.id)
          yield* MobSpawningService.spawnMob("zombie_pigman", entity.position, "conversion")
        }
      }
    }),

  // 村人の感染（ゾンビ化）
  villagerInfection: (villagerPosition: Position, zombieAttacker: string) =>
    Effect.gen(function* () {
      const difficulty = yield* worldService.getDifficulty()

      // 難易度による感染確率
      const infectionChance = {
        easy: 0,      // 感染なし
        normal: 0.5,  // 50%
        hard: 1.0     // 100%
      }[difficulty] || 0

      const random = yield* Random.next
      if (random < infectionChance) {
        yield* MobSpawningService.spawnMob("zombie_villager", villagerPosition, "conversion")
        return true
      }

      return false
    }),

  // パトロール隊の生成
  pillagerPatrol: (playerPosition: Position) =>
    Effect.gen(function* () {
      // プレイヤーが村から100ブロック以上離れている場合
      const nearestVillage = yield* worldService.getNearestVillage(playerPosition)
      if (!nearestVillage || Vector3.distance(playerPosition, nearestVillage.center) < 100) {
        return
      }

      // パトロール隊をスポーン（2-5体）
      const patrolSize = Math.floor(Math.random() * 4) + 2
      const spawnRadius = 32

      for (let i = 0; i < patrolSize; i++) {
        const spawnPosition = {
          x: playerPosition.x + (Math.random() - 0.5) * spawnRadius,
          y: playerPosition.y,
          z: playerPosition.z + (Math.random() - 0.5) * spawnRadius
        }

        const surfaceY = yield* worldService.findSurfaceLevel(spawnPosition.x, spawnPosition.z)
        if (surfaceY) {
          yield* MobSpawningService.spawnMob("pillager", { ...spawnPosition, y: surfaceY + 1 }, "event")
        }
      }
    })
}
```

## パフォーマンス最適化

### スポーン頻度制御

```typescript
// 適応的スポーン頻度調整
export const AdaptiveSpawnRate = {
  adjustSpawnRate: () =>
    Effect.gen(function* () {
      const performanceMonitor = yield* PerformanceMonitor
      const currentFPS = yield* performanceMonitor.getCurrentFPS()
      const currentEntityCount = yield* entityService.getTotalEntityCount()

      let newSpawnRate = 1.0

      // FPSベースの調整
      if (currentFPS < 30) {
        newSpawnRate *= 0.5 // スポーン率半減
      } else if (currentFPS > 55) {
        newSpawnRate *= 1.2 // スポーン率増加
      }

      // エンティティ数ベースの調整
      if (currentEntityCount > 1000) {
        newSpawnRate *= 0.3 // 大幅減少
      } else if (currentEntityCount > 500) {
        newSpawnRate *= 0.7 // 減少
      }

      yield* MobSpawningService.setSpawnRate(newSpawnRate)
    }),

  // 距離ベースの優先順位
  prioritizeNearbyChunks: (playerPositions: ReadonlyArray<Position>) =>
    Effect.gen(function* () {
      const allChunks = yield* worldService.getActiveChunks()

      // プレイヤーからの距離でソート
      const prioritizedChunks = allChunks.sort((a, b) => {
        const distanceA = Math.min(...playerPositions.map(pos =>
          Vector3.distance(chunkToWorldPosition(a), pos)
        ))
        const distanceB = Math.min(...playerPositions.map(pos =>
          Vector3.distance(chunkToWorldPosition(b), pos)
        ))
        return distanceA - distanceB
      })

      return prioritizedChunks.slice(0, 20) // 近い20チャンクのみスポーン処理
    })
}

// バッチスポーン処理
export const batchSpawnProcessing = (chunks: ReadonlyArray<ChunkCoordinate>) =>
  Effect.gen(function* () {
    const batchSize = 4

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)

      // バッチを並行処理
      yield* Effect.forEach(
        batch,
        (chunk) => processChunkSpawning(chunk),
        { concurrency: batchSize }
      )

      // フレーム制御（60FPSを維持）
      yield* Effect.sleep(16)
    }
  })
```

## デバッグ・管理ツール

```typescript
// スポーンデバッグコマンド
export const SpawnDebugCommands = {
  // 特定位置のスポーン情報表示
  analyzePosition: (position: Position) =>
    Effect.gen(function* () {
      const debugInfo = yield* MobSpawningService.debugSpawnInfo(position)

      console.log(`=== Spawn Analysis for ${position.x}, ${position.y}, ${position.z} ===`)
      console.log(`Light Level: ${debugInfo.lightLevel}`)
      console.log(`Biome: ${debugInfo.biome}`)
      console.log(`Block Type: ${debugInfo.blockType}`)
      console.log(`Nearby Mobs: ${debugInfo.nearbyMobCount}`)
      console.log(`Chunk Spawn Cap: ${debugInfo.chunkSpawnCap}`)

      console.log('\nSpawn Chances:')
      Object.entries(debugInfo.spawnChances).forEach(([mobType, chance]) => {
        console.log(`  ${mobType}: ${(chance * 100).toFixed(2)}%`)
      })
    }),

  // 強制スポーン（デバッグ用）
  forceSpawn: (mobType: string, position: Position, count: number = 1) =>
    Effect.gen(function* () {
      for (let i = 0; i < count; i++) {
        const offsetPosition = {
          x: position.x + (Math.random() - 0.5) * 4,
          y: position.y,
          z: position.z + (Math.random() - 0.5) * 4
        }

        yield* MobSpawningService.spawnMob(mobType, offsetPosition, "command")
      }
    }),

  // スポーン統計のリセット
  resetStatistics: (chunkCoord?: ChunkCoordinate) =>
    Effect.gen(function* () {
      if (chunkCoord) {
        const chunkKey = `${chunkCoord.x},${chunkCoord.z}`
        yield* Ref.update(spawnStatistics, map => {
          map.delete(chunkKey)
          return map
        })
      } else {
        yield* Ref.set(spawnStatistics, new Map())
      }
    })
}
```

## テスト戦略

```typescript
describe("Mob Spawning System", () => {
  const TestLayer = Layer.mergeAll(
    MobSpawningServiceLive,
    TestWorldServiceLayer,
    TestEntityServiceLayer,
    TestBiomeServiceLayer
  )

  test("夜間に敵対モブがスポーンする", () =>
    Effect.gen(function* () {
      const spawningService = yield* MobSpawningService

      // 夜間設定
      yield* GameTimeService.setTimeOfDay(18000) // 夜中
      yield* WorldService.setLightLevel({ x: 0, y: 64, z: 0 }, 0) // 暗闇

      const conditions = {
        biome: "plains",
        lightLevel: 0,
        timeOfDay: 18000,
        difficulty: "normal"
      }

      const canSpawnZombie = yield* spawningService.canSpawnAt("zombie", { x: 0, y: 64, z: 0 }, conditions)
      expect(canSpawnZombie).toBe(true)
    }).pipe(Effect.provide(TestLayer)))

  test("昼間は敵対モブがスポーンしない", () =>
    Effect.gen(function* () {
      const spawningService = yield* MobSpawningService

      // 昼間設定
      yield* GameTimeService.setTimeOfDay(6000) // 正午
      yield* WorldService.setLightLevel({ x: 0, y: 64, z: 0 }, 15) // 明るい

      const conditions = {
        biome: "plains",
        lightLevel: 15,
        timeOfDay: 6000,
        difficulty: "normal"
      }

      const canSpawnZombie = yield* spawningService.canSpawnAt("zombie", { x: 0, y: 64, z: 0 }, conditions)
      expect(canSpawnZombie).toBe(false)
    }))

  test("スポーンキャップが機能する", () =>
    Effect.gen(function* () {
      const spawningService = yield* MobSpawningService
      const chunkCoord = { x: 0, z: 0 }

      // スポーンキャップまでモブを生成
      for (let i = 0; i < 20; i++) {
        yield* spawningService.spawnMob("zombie", { x: i, y: 64, z: 0 }, "command")
      }

      // キャップ更新
      const mobCount = yield* spawningService.updateSpawnCap(chunkCoord)
      expect(mobCount).toBe(20)

      // スポーン試行（キャップに達しているので失敗するはず）
      const spawnEvents = yield* spawningService.attemptSpawn(chunkCoord, {
        biome: "plains",
        lightLevel: 0,
        timeOfDay: 18000,
        difficulty: "normal"
      })

      expect(spawnEvents.length).toBe(0)
    }))
})
```

## 次のステップ

このシステムは以下との統合が必要です：
- **Entity System**: スポーンされたモブの管理・AI
- **World System**: 地形・バイオーム・構造物との連携
- **Time System**: 昼夜サイクル・月相との同期
- **Combat System**: モブの戦闘能力・ドロップ設定
- **Difficulty System**: 難易度によるスポーン調整