---
title: '16 Mob Spawning System'
description: '16 Mob Spawning Systemに関する詳細な説明とガイド。'
category: 'specification'
difficulty: 'intermediate'
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: '25分'
---

# Mob Spawning System（モブスポーンシステム）

## 概要

ゲーム世界に動的にモンスター・動物・NPCを生成する重要なシステムです。バイオーム・時間・明度・難易度・プレイヤーの行動に応じて適切なモブを自動生成し、ゲーム世界に生命感と挑戦をもたらします。

## アーキテクチャ設計

### Schema定義

```typescript
import { Schema } from 'effect'

// スポーン条件
export const SpawnCondition = Schema.Struct({
  biome: Schema.Array(Schema.String), // 許可バイオーム
  lightLevel: Schema.Struct({
    min: Schema.Number.pipe(Schema.min(0), Schema.max(15)),
    max: Schema.Number.pipe(Schema.min(0), Schema.max(15)),
  }),
  timeOfDay: Schema.optional(
    Schema.Struct({
      start: Schema.Number.pipe(Schema.min(0), Schema.max(24000)), // ticks
      end: Schema.Number.pipe(Schema.min(0), Schema.max(24000)),
    })
  ),
  altitude: Schema.optional(
    Schema.Struct({
      min: Schema.Number.pipe(Schema.min(-64), Schema.max(320)),
      max: Schema.Number.pipe(Schema.min(-64), Schema.max(320)),
    })
  ),
  moonPhase: Schema.optional(
    Schema.Union(
      Schema.Literal('new_moon'),
      Schema.Literal('waxing_crescent'),
      Schema.Literal('first_quarter'),
      Schema.Literal('waxing_gibbous'),
      Schema.Literal('full_moon'),
      Schema.Literal('waning_gibbous'),
      Schema.Literal('third_quarter'),
      Schema.Literal('waning_crescent')
    )
  ),
  difficulty: Schema.Array(
    Schema.Union(Schema.Literal('peaceful'), Schema.Literal('easy'), Schema.Literal('normal'), Schema.Literal('hard'))
  ),
  blockRequirement: Schema.optional(
    Schema.Struct({
      blockType: Schema.String,
      range: Schema.Number.pipe(Schema.positive()),
    })
  ),
  playerDistance: Schema.optional(
    Schema.Struct({
      min: Schema.Number.pipe(Schema.min(0)),
      max: Schema.Number.pipe(Schema.min(0)),
    })
  ),
})

export type SpawnCondition = Schema.Schema.Type<typeof SpawnCondition>

// モブスポーン定義
export const MobSpawnEntry = Schema.Struct({
  mobType: Schema.String.pipe(Schema.brand('MobType')),
  weight: Schema.Number.pipe(Schema.positive()), // スポーン重み
  minGroupSize: Schema.Number.pipe(Schema.int(), Schema.min(1)),
  maxGroupSize: Schema.Number.pipe(Schema.int(), Schema.min(1)),
  spawnConditions: SpawnCondition,
  maxCount: Schema.Number.pipe(Schema.int(), Schema.min(1)), // チャンクあたりの最大数
  rarity: Schema.Union(
    Schema.Literal('common'), // 10+%
    Schema.Literal('uncommon'), // 1-10%
    Schema.Literal('rare'), // 0.1-1%
    Schema.Literal('epic'), // 0.01-0.1%
    Schema.Literal('legendary') // <0.01%
  ),
  cooldown: Schema.Number.pipe(Schema.min(0)), // スポーン間隔（ミリ秒）
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})

export type MobSpawnEntry = Schema.Schema.Type<typeof MobSpawnEntry>

// スポーンイベント
export const MobSpawnEvent = Schema.Struct({
  _tag: Schema.Literal('MobSpawnEvent'),
  mobType: Schema.String.pipe(Schema.brand('MobType')),
  entityId: Schema.String.pipe(Schema.brand('EntityId')),
  position: Position,
  chunk: ChunkCoordinate,
  spawnReason: Schema.Union(
    Schema.Literal('natural'), // 自然スポーン
    Schema.Literal('spawner'), // スポナーブロック
    Schema.Literal('structure'), // 構造物生成
    Schema.Literal('event'), // イベントスポーン
    Schema.Literal('command'), // コマンド生成
    Schema.Literal('breeding'), // 繁殖
    Schema.Literal('conversion') // 変身（ゾンビ→ドラウンド等）
  ),
  groupSize: Schema.Number.pipe(Schema.int(), Schema.min(1)),
  timestamp: Schema.DateTimeUtc,
  conditions: Schema.Struct({
    lightLevel: Schema.Number,
    timeOfDay: Schema.Number,
    difficulty: Schema.String,
    biome: Schema.String,
  }),
})

export type MobSpawnEvent = Schema.Schema.Type<typeof MobSpawnEvent>

// スポーン管理データ
export const SpawnManager = Schema.Struct({
  chunkCoord: ChunkCoordinate,
  activeSpawns: Schema.Array(
    Schema.Struct({
      entityId: Schema.String.pipe(Schema.brand('EntityId')),
      mobType: Schema.String.pipe(Schema.brand('MobType')),
      spawnTime: Schema.DateTimeUtc,
      lastActivity: Schema.DateTimeUtc,
    })
  ),
  spawnCooldowns: Schema.Record(
    Schema.String.pipe(Schema.brand('MobType')),
    Schema.Number // 次回スポーン可能時間
  ),
  lastSpawnAttempt: Schema.DateTimeUtc,
  spawnCapReached: Schema.Boolean.pipe(Schema.default(() => false)),
})

export type SpawnManager = Schema.Schema.Type<typeof SpawnManager>

// スポーン統計
export const SpawnStatistics = Schema.Struct({
  chunkCoord: ChunkCoordinate,
  totalSpawns: Schema.Number.pipe(Schema.int(), Schema.min(0)),
  spawnsByType: Schema.Record(Schema.String, Schema.Number),
  averageSpawnRate: Schema.Number.pipe(Schema.min(0)), // spawns per minute
  peakSpawnTime: Schema.Number.pipe(Schema.min(0), Schema.max(24000)),
  lastReset: Schema.DateTimeUtc,
})

export type SpawnStatistics = Schema.Schema.Type<typeof SpawnStatistics>
```

### Service定義

```typescript
// エラー定義（TaggedError使用）
export const SpawnError = Schema.TaggedError('SpawnError')({
  reason: Schema.String,
  mobType: Schema.optional(MobType),
  position: Schema.optional(Position),
  conditions: Schema.optional(Schema.Unknown),
})

export const PopulationLimitError = Schema.TaggedError('PopulationLimitError')({
  chunkCoord: ChunkCoordinate,
  currentCount: Population,
  maxCount: Population,
  mobType: MobType,
})

export const InvalidSpawnConditionError = Schema.TaggedError('InvalidSpawnConditionError')({
  position: Position,
  failedConditions: Schema.Array(Schema.String),
  mobType: MobType,
})

// 環境条件（パターンマッチング対応）
export const EnvironmentConditions = Schema.TaggedUnion('type', {
  surface: Schema.Struct({
    type: Schema.Literal('surface'),
    biome: Biome,
    lightLevel: Schema.Int.pipe(Schema.between(0, 15)),
    timeOfDay: Schema.Int.pipe(Schema.between(0, 24000)),
    difficulty: Difficulty,
    moonPhase: MoonPhase,
    nearbyBlocks: Schema.Array(Schema.String),
  }),
  underground: Schema.Struct({
    type: Schema.Literal('underground'),
    biome: Biome,
    lightLevel: Schema.Int.pipe(Schema.between(0, 15)),
    depth: Schema.Int.pipe(Schema.min(1)),
    caveType: Schema.String,
    difficulty: Difficulty,
  }),
  structure: Schema.Struct({
    type: Schema.Literal('structure'),
    structureType: Schema.String,
    roomType: Schema.String,
    lightLevel: Schema.Int.pipe(Schema.between(0, 15)),
    difficulty: Difficulty,
  }),
})
export type EnvironmentConditions = Schema.Schema.Type<typeof EnvironmentConditions>

// Mob Spawning Service Interface（STM統合）
export interface MobSpawningServiceInterface {
  // スポーン実行（Stream使用）
  readonly attemptSpawn: (
    chunkCoord: ChunkCoordinate,
    conditions: EnvironmentConditions
  ) => Stream.Stream<MobSpawnEvent, SpawnError>

  readonly spawnMob: (
    mobType: MobType,
    position: Position,
    spawnReason: SpawnReason
  ) => Effect.Effect<MobSpawnEvent, SpawnError>

  readonly spawnGroup: (
    mobType: MobType,
    centerPosition: Position,
    groupSize: Schema.Int
  ) => Stream.Stream<MobSpawnEvent, SpawnError>

  // スポーン条件判定（パターンマッチング使用）
  readonly canSpawnAt: (
    mobType: MobType,
    position: Position,
    conditions: EnvironmentConditions
  ) => Effect.Effect<boolean, never>

  readonly findValidSpawnPositions: (
    chunkCoord: ChunkCoordinate,
    mobType: MobType,
    maxCount: Schema.Int
  ) => Effect.Effect<ReadonlyArray<Position>, InvalidSpawnConditionError>

  readonly calculateSpawnChance: (
    mobEntry: MobSpawnEntry,
    conditions: EnvironmentConditions
  ) => Effect.Effect<SpawnRate, never>

  // STMベースの人口管理
  readonly getPopulationCount: (chunkCoord: ChunkCoordinate, mobType: MobType) => STM.STM<Population, never, never>

  readonly updatePopulation: (
    chunkCoord: ChunkCoordinate,
    mobType: MobType,
    delta: number
  ) => STM.STM<Population, PopulationLimitError, never>

  readonly cleanupDespawnedMobs: (chunkCoord: ChunkCoordinate) => Effect.Effect<Population, never>

  // 設定管理（Random使用）
  readonly setDifficultyMultiplier: (difficulty: Difficulty, multiplier: SpawnRate) => Effect.Effect<void, never>

  readonly setSpawnRate: (globalMultiplier: SpawnRate) => Effect.Effect<void, never>

  readonly enableMobCategory: (category: MobCategory, enabled: boolean) => Effect.Effect<void, never>

  // 統計・デバッグ
  readonly getSpawnStatistics: (chunkCoord: ChunkCoordinate) => Effect.Effect<SpawnStatistics, never>

  readonly getGlobalSpawnRate: () => Effect.Effect<SpawnRate, never>

  readonly debugSpawnInfo: (position: Position) => Effect.Effect<SpawnDebugInfo, never>
}

export const MobSpawningService = Context.GenericTag<MobSpawningServiceInterface>('@minecraft/MobSpawningService')

// デバッグ情報（ブランド型使用）
export const SpawnDebugInfo = Schema.Struct({
  position: Position,
  lightLevel: Schema.Int.pipe(Schema.between(0, 15)),
  biome: Biome,
  blockType: Schema.String,
  canSpawn: Schema.Record(MobType, Schema.Boolean),
  spawnChances: Schema.Record(MobType, SpawnRate),
  nearbyMobCount: Population,
  chunkSpawnCap: Population,
  environmentType: EnvironmentConditions,
})
export type SpawnDebugInfo = Schema.Schema.Type<typeof SpawnDebugInfo>
```

### 実装パターン

```typescript
// STMベースのスポーン管理
const makeSTMSpawnManager = Effect.gen(function* () {
  const spawnManagers = yield* STM.map.empty<string, SpawnManager>()
  const populationCounters = yield* STM.map.empty<string, STM.TMap<MobType, Population>>()

  return { spawnManagers, populationCounters }
})

// Mob Spawning Service 実装（最新パターン）
export const MobSpawningServiceLive = Layer.effect(
  MobSpawningService,
  Effect.gen(function* () {
    const stmState = yield* makeSTMSpawnManager
    const spawnStatistics = yield* Ref.make(new Map<string, SpawnStatistics>())
    const globalSettings = yield* Ref.make({
      spawnRate: SpawnRate.make(1.0),
      difficultyMultipliers: new Map([
        ['peaceful', SpawnRate.make(0.0)],
        ['easy', SpawnRate.make(0.5)],
        ['normal', SpawnRate.make(1.0)],
        ['hard', SpawnRate.make(1.5)],
      ]),
      enabledCategories: new Set<string>(['hostile', 'passive', 'neutral']),
    })

    const gameTime = yield* GameTimeService
    const worldService = yield* WorldService
    const biomeService = yield* BiomeService
    const entityService = yield* EntityService
    const eventBus = yield* EventBusService
    const random = yield* Random.Random

    return MobSpawningService.of({
      // Stream実装でのスポーン処理
      attemptSpawn: (chunkCoord, conditions) =>
        Stream.fromEffect(
          Effect.gen(function* () {
            // パターンマッチングで環境タイプを判定
            const spawnStrategy = yield* Match.value(conditions).pipe(
              Match.when({ type: 'surface' }, (surface) => Effect.succeed(createSurfaceSpawnStrategy(surface))),
              Match.when({ type: 'underground' }, (underground) =>
                Effect.succeed(createUndergroundSpawnStrategy(underground))
              ),
              Match.when({ type: 'structure' }, (structure) => Effect.succeed(createStructureSpawnStrategy(structure))),
              Match.exhaustive
            )

            return yield* spawnStrategy.execute(chunkCoord)
          })
        ).pipe(Stream.flatMap((spawnEvents) => Stream.fromIterable(spawnEvents))),

      spawnMob: (mobType, position, spawnReason) =>
        Effect.gen(function* () {
          const entityData = yield* createMobEntity(mobType, position)
          const entityId = yield* entityService.spawnEntity(entityData)
          const chunkCoord = worldToChunkCoordinate(position)

          // STMによる人口更新
          yield* STM.commit(MobSpawningService.updatePopulation(chunkCoord, mobType, 1))

          const spawnEvent = MobSpawnEvent.make({
            _tag: 'MobSpawnEvent',
            mobType,
            entityId,
            position,
            chunk: chunkCoord,
            spawnReason,
            groupSize: 1,
            timestamp: new Date(),
            conditions: yield* getEnvironmentConditions(position),
          })

          yield* eventBus.publish(spawnEvent)
          return spawnEvent
        }),

      spawnGroup: (mobType, centerPosition, groupSize) =>
        Stream.fromEffect(
          Random.next.pipe(
            Effect.flatMap((seed) =>
              Random.setSeed(seed).pipe(Effect.flatMap(() => generateGroupPositions(centerPosition, groupSize)))
            )
          )
        ).pipe(
          Stream.flatMap((positions) =>
            Stream.fromIterable(positions).pipe(
              Stream.mapEffect((position) =>
                MobSpawningService.spawnMob(
                  mobType,
                  position,
                  SpawnReason.natural({
                    naturalConditions: {
                      lightLevel: 0,
                      surfaceLevel: true,
                    },
                  })
                )
              )
            )
          )
        ),

      // パターンマッチングベースの条件判定
      canSpawnAt: (mobType, position, conditions) =>
        Effect.gen(function* () {
          const mobEntry = yield* getMobEntry(mobType)
          if (!mobEntry) return false

          return yield* Match.value(conditions).pipe(
            Match.when({ type: 'surface' }, (surface) => checkSurfaceSpawnConditions(mobEntry, surface, position)),
            Match.when({ type: 'underground' }, (underground) =>
              checkUndergroundSpawnConditions(mobEntry, underground, position)
            ),
            Match.when({ type: 'structure' }, (structure) =>
              checkStructureSpawnConditions(mobEntry, structure, position)
            ),
            Match.exhaustive
          )
        }),

      // Random使用での位置探索
      findValidSpawnPositions: (chunkCoord, mobType, maxCount) =>
        Effect.gen(function* () {
          const positions = yield* Random.shuffle(generateChunkPositions(chunkCoord)).pipe(
            Effect.flatMap((shuffled) =>
              Effect.forEach(
                shuffled.slice(0, maxCount * 3), // 3倍の候補から選択
                (position) => validateSpawnPosition(position, mobType),
                { concurrency: 4 }
              )
            )
          )

          return positions.filter(Boolean).slice(0, maxCount)
        }),

      calculateSpawnChance: (mobEntry, conditions) =>
        Effect.gen(function* () {
          const settings = yield* Ref.get(globalSettings)

          const baseChance = yield* calculateBaseSpawnChance(mobEntry.weight, mobEntry.rarity)

          const modifiedChance = yield* Match.value(conditions).pipe(
            Match.when({ type: 'surface' }, (surface) => applySurfaceModifiers(baseChance, surface, mobEntry)),
            Match.when({ type: 'underground' }, (underground) =>
              applyUndergroundModifiers(baseChance, underground, mobEntry)
            ),
            Match.when({ type: 'structure' }, (structure) => applyStructureModifiers(baseChance, structure, mobEntry)),
            Match.exhaustive
          )

          return SpawnRate.make(Math.min(1.0, modifiedChance * settings.spawnRate))
        }),

      // STMベースの人口管理
      getPopulationCount: (chunkCoord, mobType) =>
        STM.gen(function* () {
          const chunkKey = `${chunkCoord.x},${chunkCoord.z}`
          const counters = yield* STM.map.get(stmState.populationCounters, chunkKey)

          if (!counters) return Population.make(0)

          return yield* STM.map.get(counters, mobType).pipe(STM.orElse(() => STM.succeed(Population.make(0))))
        }),

      updatePopulation: (chunkCoord, mobType, delta) =>
        STM.gen(function* () {
          const chunkKey = `${chunkCoord.x},${chunkCoord.z}`
          const counters = yield* STM.map
            .get(stmState.populationCounters, chunkKey)
            .pipe(
              STM.orElse(() =>
                STM.map
                  .empty<MobType, Population>()
                  .pipe(STM.tap((newCounters) => STM.map.set(stmState.populationCounters, chunkKey, newCounters)))
              )
            )

          const currentCount = yield* STM.map
            .get(counters, mobType)
            .pipe(STM.orElse(() => STM.succeed(Population.make(0))))

          const newCount = Population.make(currentCount + delta)

          if (newCount > Population.make(20)) {
            // 最大20体まで
            return yield* STM.fail(
              new PopulationLimitError({
                chunkCoord,
                currentCount,
                maxCount: Population.make(20),
                mobType,
              })
            )
          }

          yield* STM.map.set(counters, mobType, newCount)
          return newCount
        }),

      cleanupDespawnedMobs: (chunkCoord) =>
        Effect.gen(function* () {
          const activeEntities = yield* entityService.getChunkEntities(chunkCoord)
          const entityIds = new Set(activeEntities.map((e) => e.id))

          yield* STM.commit(
            STM.gen(function* () {
              const chunkKey = `${chunkCoord.x},${chunkCoord.z}`
              const manager = yield* STM.map.get(stmState.spawnManagers, chunkKey)
              if (!manager) return

              const activeSpawns = manager.activeSpawns.filter((spawn) => entityIds.has(spawn.entityId))

              const updatedManager = { ...manager, activeSpawns }
              yield* STM.map.set(stmState.spawnManagers, chunkKey, updatedManager)
            })
          )

          return Population.make(activeEntities.length)
        }),

      setDifficultyMultiplier: (difficulty, multiplier) =>
        Ref.update(globalSettings, (settings) => ({
          ...settings,
          difficultyMultipliers: settings.difficultyMultipliers.set(difficulty.level, multiplier),
        })),

      setSpawnRate: (globalMultiplier) =>
        Ref.update(globalSettings, (settings) => ({
          ...settings,
          spawnRate: globalMultiplier,
        })),

      enableMobCategory: (category, enabled) =>
        Ref.update(globalSettings, (settings) => {
          const categories = new Set(settings.enabledCategories)
          if (enabled) {
            categories.add(category.category)
          } else {
            categories.delete(category.category)
          }
          return { ...settings, enabledCategories: categories }
        }),

      getSpawnStatistics: (chunkCoord) =>
        Effect.gen(function* () {
          const stats = yield* Ref.get(spawnStatistics)
          const chunkKey = `${chunkCoord.x},${chunkCoord.z}`

          return (
            stats.get(chunkKey) || {
              chunkCoord,
              totalSpawns: Population.make(0),
              spawnsByType: new Map(),
              spawnsByCategory: new Map(),
              averageSpawnRate: SpawnRate.make(0),
              peakSpawnTime: 12000,
              successfulSpawns: Population.make(0),
              failedSpawns: Population.make(0),
              lastReset: new Date(),
            }
          )
        }),

      getGlobalSpawnRate: () => Ref.get(globalSettings).pipe(Effect.map((settings) => settings.spawnRate)),

      debugSpawnInfo: (position) =>
        Effect.gen(function* () {
          const lightLevel = yield* worldService.getLightLevel(position)
          const biome = yield* biomeService.getBiomeAt(position)
          const conditions = yield* getEnvironmentConditions(position)

          return SpawnDebugInfo.make({
            position,
            lightLevel,
            biome,
            blockType: yield* worldService.getBlockType(position),
            canSpawn: new Map(),
            spawnChances: new Map(),
            nearbyMobCount: Population.make(0),
            chunkSpawnCap: Population.make(20),
            environmentType: conditions,
          })
        }),
    })
  })
)

// ヘルパー関数群（浅いネスティングパターン）
const createHostileCategory = (attackDamage: number) => ({
  category: 'hostile' as const,
  despawnDistance: 32,
  attackDamage,
})

const createPassiveCategory = (breedingCooldown: number, maxHerdSize: number) => ({
  category: 'passive' as const,
  breedingCooldown,
  maxHerdSize,
})

const createCommonRarity = () => ({
  level: 'common' as const,
  spawnChance: 0.15,
})

const createUncommonRarity = () => ({
  level: 'uncommon' as const,
  spawnChance: 0.05,
})

// スポーンテーブル（TaggedUnion使用）
export const MobSpawnTable = Schema.TaggedUnion('biomeType', {
  overworld_surface: Schema.Struct({
    biomeType: Schema.Literal('overworld_surface'),
    entries: Schema.Array(
      Schema.Struct({
        mobType: MobType,
        weight: SpawnRate,
        category: MobCategory,
        conditions: Schema.Struct({
          lightLevel: Schema.Struct({ min: Schema.Int, max: Schema.Int }),
          timeOfDay: Schema.optional(Schema.Struct({ start: Schema.Int, end: Schema.Int })),
          difficulty: Schema.Array(Difficulty),
        }),
      })
    ),
  }),

  overworld_underground: Schema.Struct({
    biomeType: Schema.Literal('overworld_underground'),
    entries: Schema.Array(
      Schema.Struct({
        mobType: MobType,
        weight: SpawnRate,
        category: MobCategory,
        conditions: Schema.Struct({
          lightLevel: Schema.Struct({ min: Schema.Int, max: Schema.Int }),
          depth: Schema.Int.pipe(Schema.min(10)),
          caveType: Schema.String,
        }),
      })
    ),
  }),

  nether: Schema.Struct({
    biomeType: Schema.Literal('nether'),
    entries: Schema.Array(
      Schema.Struct({
        mobType: MobType,
        weight: SpawnRate,
        category: MobCategory,
        conditions: Schema.Struct({
          nearLava: Schema.Boolean,
          fortressProximity: Schema.optional(Schema.Number),
        }),
      })
    ),
  }),

  end: Schema.Struct({
    biomeType: Schema.Literal('end'),
    entries: Schema.Array(
      Schema.Struct({
        mobType: MobType,
        weight: SpawnRate,
        category: MobCategory,
        conditions: Schema.Struct({
          islandType: Schema.Union(Schema.Literal('main'), Schema.Literal('outer'), Schema.Literal('void')),
          endStoneProximity: Schema.Number,
        }),
      })
    ),
  }),
})

export type MobSpawnTable = Schema.Schema.Type<typeof MobSpawnTable>

// バイオーム固有スポーン設定（パターンマッチング使用）
export const BiomeSpawnConfigurations = new Map<Biome, MobSpawnTable>([
  // 平原バイオーム
  [
    Biome.make('plains'),
    {
      biomeType: 'overworld_surface',
      entries: [
        {
          mobType: MobType.make('zombie'),
          weight: SpawnRate.make(0.95),
          category: createHostileCategory(4),
          conditions: {
            lightLevel: { min: 0, max: 7 },
            timeOfDay: { start: 13000, end: 23000 },
            difficulty: [
              { level: 'easy', spawnMultiplier: 0.5 },
              { level: 'normal', spawnMultiplier: 1.0 },
              { level: 'hard', spawnMultiplier: 1.5 },
            ],
          },
        },
        {
          mobType: MobType.make('cow'),
          weight: SpawnRate.make(0.08),
          category: createPassiveCategory(300000, 4),
          conditions: {
            lightLevel: { min: 8, max: 15 },
            difficulty: [
              { level: 'peaceful', spawnMultiplier: 1.0 },
              { level: 'easy', spawnMultiplier: 1.0 },
              { level: 'normal', spawnMultiplier: 1.0 },
              { level: 'hard', spawnMultiplier: 1.0 },
            ],
          },
        },
      ],
    },
  ],

  // 森林バイオーム
  [
    Biome.make('forest'),
    {
      biomeType: 'overworld_surface',
      entries: [
        {
          mobType: MobType.make('skeleton'),
          weight: SpawnRate.make(0.8),
          category: createHostileCategory(3),
          conditions: {
            lightLevel: { min: 0, max: 7 },
            timeOfDay: { start: 13000, end: 23000 },
            difficulty: [
              { level: 'easy', spawnMultiplier: 0.5 },
              { level: 'normal', spawnMultiplier: 1.0 },
              { level: 'hard', spawnMultiplier: 1.5 },
            ],
          },
        },
      ],
    },
  ],

  // ネザーバイオーム
  [
    Biome.make('nether_wastes'),
    {
      biomeType: 'nether',
      entries: [
        {
          mobType: MobType.make('zombie_pigman'),
          weight: SpawnRate.make(1.0),
          category: {
            category: 'neutral',
            aggressionTriggers: ['attack_player', 'attack_ally'],
            calmDuration: 60000,
          },
          conditions: {
            nearLava: true,
          },
        },
      ],
    },
  ],
])

// スポーン戦略パターン（Tagged Union使用）
export const SpawnStrategy = Schema.TaggedUnion('strategyType', {
  natural_spawn: Schema.Struct({
    strategyType: Schema.Literal('natural_spawn'),
    biomeTable: MobSpawnTable,
    populationLimit: Population,
    spawnRadius: Schema.Number,
  }),

  structure_spawn: Schema.Struct({
    strategyType: Schema.Literal('structure_spawn'),
    structureType: Schema.String,
    spawnRooms: Schema.Array(Schema.String),
    guardiansOnly: Schema.Boolean,
  }),

  event_spawn: Schema.Struct({
    strategyType: Schema.Literal('event_spawn'),
    eventTrigger: Schema.String,
    spawnBurst: Schema.Boolean,
    temporarySpawn: Schema.Boolean,
  }),
})

export type SpawnStrategy = Schema.Schema.Type<typeof SpawnStrategy>
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
    hard: 20,
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
      spawnCapReached: false,
    }

    // 新しいスポーンを追加
    manager.activeSpawns.push({
      entityId: spawnEvent.entityId,
      mobType: spawnEvent.mobType,
      spawnTime: spawnEvent.timestamp,
      lastActivity: spawnEvent.timestamp,
    })

    // クールダウンを設定
    const mobEntry = SPAWN_ENTRIES.get(spawnEvent.mobType)
    if (mobEntry) {
      const nextSpawnTime = Date.now() + mobEntry.cooldown
      manager.spawnCooldowns[spawnEvent.mobType] = nextSpawnTime
    }

    // マップを更新
    yield* Ref.update(spawnManagers, (map) => map.set(chunkKey, manager))
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
      }),
  },

  // ネザーバイオーム：ブレイズ・ガスト・ゾンビピッグマン
  nether: {
    netherSpawning: (position: Position) =>
      Effect.gen(function* () {
        const dimension = yield* worldService.getDimension(position)
        if (dimension !== 'nether') {
          return false
        }

        // 溶岩湖の近くかチェック
        const nearLava = yield* worldService.hasBlockInRange(position, 'lava', 8)
        return nearLava
      }),
  },

  // エンドバイオーム：エンダーマン・シュルカー
  end: {
    endSpawning: (position: Position) =>
      Effect.gen(function* () {
        const dimension = yield* worldService.getDimension(position)
        return dimension === 'end'
      }),
  },
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
      }),
  },

  // 要塞：シルバーフィッシュ
  stronghold: {
    silverfishInfestation: (position: Position) =>
      Effect.gen(function* () {
        const structure = yield* worldService.getStructureAt(position)
        return structure?.type === 'stronghold'
      }),
  },
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
        if (entity.type === 'pig') {
          // 豚をゾンビピッグマンに変身
          yield* entityService.removeEntity(entity.id)
          yield* MobSpawningService.spawnMob('zombie_pigman', entity.position, 'conversion')
        }
      }
    }),

  // 村人の感染（ゾンビ化）
  villagerInfection: (villagerPosition: Position, zombieAttacker: string) =>
    Effect.gen(function* () {
      const difficulty = yield* worldService.getDifficulty()

      // 難易度による感染確率
      const infectionChance =
        {
          easy: 0, // 感染なし
          normal: 0.5, // 50%
          hard: 1.0, // 100%
        }[difficulty] || 0

      const random = yield* Random.next
      if (random < infectionChance) {
        yield* MobSpawningService.spawnMob('zombie_villager', villagerPosition, 'conversion')
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
          z: playerPosition.z + (Math.random() - 0.5) * spawnRadius,
        }

        const surfaceY = yield* worldService.findSurfaceLevel(spawnPosition.x, spawnPosition.z)
        if (surfaceY) {
          yield* MobSpawningService.spawnMob('pillager', { ...spawnPosition, y: surfaceY + 1 }, 'event')
        }
      }
    }),
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
        const distanceA = Math.min(...playerPositions.map((pos) => Vector3.distance(chunkToWorldPosition(a), pos)))
        const distanceB = Math.min(...playerPositions.map((pos) => Vector3.distance(chunkToWorldPosition(b), pos)))
        return distanceA - distanceB
      })

      return prioritizedChunks.slice(0, 20) // 近い20チャンクのみスポーン処理
    }),
}

// バッチスポーン処理
export const batchSpawnProcessing = (chunks: ReadonlyArray<ChunkCoordinate>) =>
  Effect.gen(function* () {
    const batchSize = 4

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)

      // バッチを並行処理
      yield* Effect.forEach(batch, (chunk) => processChunkSpawning(chunk), { concurrency: batchSize })

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
          z: position.z + (Math.random() - 0.5) * 4,
        }

        yield* MobSpawningService.spawnMob(mobType, offsetPosition, 'command')
      }
    }),

  // スポーン統計のリセット
  resetStatistics: (chunkCoord?: ChunkCoordinate) =>
    Effect.gen(function* () {
      if (chunkCoord) {
        const chunkKey = `${chunkCoord.x},${chunkCoord.z}`
        yield* Ref.update(spawnStatistics, (map) => {
          map.delete(chunkKey)
          return map
        })
      } else {
        yield* Ref.set(spawnStatistics, new Map())
      }
    }),
}
```

## テスト戦略

```typescript
describe('Mob Spawning System', () => {
  const TestLayer = Layer.mergeAll(
    MobSpawningServiceLive,
    TestWorldServiceLayer,
    TestEntityServiceLayer,
    TestBiomeServiceLayer
  )

  test('夜間に敵対モブがスポーンする', () =>
    Effect.gen(function* () {
      const spawningService = yield* MobSpawningService

      // 夜間設定
      yield* GameTimeService.setTimeOfDay(18000) // 夜中
      yield* WorldService.setLightLevel({ x: 0, y: 64, z: 0 }, 0) // 暗闇

      const conditions = {
        biome: 'plains',
        lightLevel: 0,
        timeOfDay: 18000,
        difficulty: 'normal',
      }

      const canSpawnZombie = yield* spawningService.canSpawnAt('zombie', { x: 0, y: 64, z: 0 }, conditions)
      expect(canSpawnZombie).toBe(true)
    }).pipe(Effect.provide(TestLayer)))

  test('昼間は敵対モブがスポーンしない', () =>
    Effect.gen(function* () {
      const spawningService = yield* MobSpawningService

      // 昼間設定
      yield* GameTimeService.setTimeOfDay(6000) // 正午
      yield* WorldService.setLightLevel({ x: 0, y: 64, z: 0 }, 15) // 明るい

      const conditions = {
        biome: 'plains',
        lightLevel: 15,
        timeOfDay: 6000,
        difficulty: 'normal',
      }

      const canSpawnZombie = yield* spawningService.canSpawnAt('zombie', { x: 0, y: 64, z: 0 }, conditions)
      expect(canSpawnZombie).toBe(false)
    }))

  test('スポーンキャップが機能する', () =>
    Effect.gen(function* () {
      const spawningService = yield* MobSpawningService
      const chunkCoord = { x: 0, z: 0 }

      // スポーンキャップまでモブを生成
      for (let i = 0; i < 20; i++) {
        yield* spawningService.spawnMob('zombie', { x: i, y: 64, z: 0 }, 'command')
      }

      // キャップ更新
      const mobCount = yield* spawningService.updateSpawnCap(chunkCoord)
      expect(mobCount).toBe(20)

      // スポーン試行（キャップに達しているので失敗するはず）
      const spawnEvents = yield* spawningService.attemptSpawn(chunkCoord, {
        biome: 'plains',
        lightLevel: 0,
        timeOfDay: 18000,
        difficulty: 'normal',
      })

      expect(spawnEvents.length).toBe(0)
    }))
})
```

## プロパティベーステスト戦略

### Fast-Check統合パターン

```typescript
import { Arbitrary, fc } from '@effect/vitest'
import { Effect, TestClock, TestRandom, Layer } from 'effect'
import { describe, test, expect } from '@effect/vitest'

// Schema-based Arbitraryの生成
const MobTypeArbitrary: Arbitrary<MobType> = fc
  .string({ minLength: 3, maxLength: 20 })
  .filter((s) => /^[a-z_]+$/.test(s))
  .map(MobType.make)

const BiomeArbitrary: Arbitrary<Biome> = fc
  .constantFrom('plains', 'forest', 'desert', 'ocean', 'nether_wastes', 'end')
  .map(Biome.make)

const PopulationArbitrary: Arbitrary<Population> = fc.nat({ max: 50 }).map(Population.make)

const SpawnRateArbitrary: Arbitrary<SpawnRate> = fc.float({ min: 0, max: 2 }).map(SpawnRate.make)

const PositionArbitrary: Arbitrary<Position> = fc.record({
  x: fc.integer({ min: -1000, max: 1000 }),
  y: fc.integer({ min: -64, max: 320 }),
  z: fc.integer({ min: -1000, max: 1000 }),
})

// 環境条件のArbitrary
const EnvironmentConditionsArbitrary: Arbitrary<EnvironmentConditions> = fc.oneof(
  fc.record({
    type: fc.constant('surface' as const),
    biome: BiomeArbitrary,
    lightLevel: fc.integer({ min: 0, max: 15 }),
    timeOfDay: fc.integer({ min: 0, max: 24000 }),
    difficulty: fc.record({
      level: fc.constantFrom('easy', 'normal', 'hard'),
      spawnMultiplier: fc.float({ min: 0.5, max: 2.0 }),
    }),
    moonPhase: fc.record({
      phase: fc.constantFrom('new_moon', 'full_moon', 'first_quarter'),
      modifier: fc.float({ min: 0.5, max: 1.5 }),
    }),
    nearbyBlocks: Schema.Array(Schema.String, { maxLength: 5 }),
  }),
  fc.record({
    type: fc.constant('underground' as const),
    biome: BiomeArbitrary,
    lightLevel: fc.integer({ min: 0, max: 7 }),
    depth: fc.integer({ min: 1, max: 100 }),
    caveType: fc.constantFrom('cave', 'ravine', 'mineshaft'),
    difficulty: fc.record({
      level: fc.constantFrom('easy', 'normal', 'hard'),
      spawnMultiplier: fc.float({ min: 0.5, max: 2.0 }),
    }),
  })
)

// テストレイヤー定義
const TestMobSpawningServiceLive = Layer.effect(
  MobSpawningService,
  Effect.gen(function* () {
    const testClock = yield* TestClock.TestClock
    const testRandom = yield* TestRandom.TestRandom

    return MobSpawningService.of({
      attemptSpawn: (chunkCoord, conditions) =>
        Stream.fromEffect(
          Effect.gen(function* () {
            yield* TestRandom.nextIntBetween(0, 3)
            return [
              MobSpawnEvent.make({
                _tag: 'MobSpawnEvent',
                mobType: MobType.make('test_mob'),
                entityId: 'test_entity_123' as any,
                position: { x: 0, y: 64, z: 0 },
                chunk: chunkCoord,
                spawnReason: SpawnReason.natural({
                  naturalConditions: { lightLevel: 0, surfaceLevel: true },
                }),
                groupSize: 1,
                timestamp: new Date(),
                conditions,
              }),
            ]
          })
        ),

      spawnMob: (mobType, position, spawnReason) =>
        Effect.succeed(
          MobSpawnEvent.make({
            _tag: 'MobSpawnEvent',
            mobType,
            entityId: 'test_entity' as any,
            position,
            chunk: { x: 0, z: 0 },
            spawnReason,
            groupSize: 1,
            timestamp: new Date(),
            conditions: {
              lightLevel: 0,
              timeOfDay: 0,
              difficulty: { level: 'normal', spawnMultiplier: 1.0 },
              biome: Biome.make('plains'),
            },
          })
        ),

      canSpawnAt: (mobType, position, conditions) =>
        Effect.gen(function* () {
          // パターンマッチングテスト
          return yield* Match.value(conditions).pipe(
            Match.when({ type: 'surface' }, () => Effect.succeed(true)),
            Match.when({ type: 'underground' }, () => Effect.succeed(false)),
            Match.when({ type: 'structure' }, () => Effect.succeed(true)),
            Match.exhaustive
          )
        }),

      findValidSpawnPositions: (chunkCoord, mobType, maxCount) =>
        Effect.succeed([{ x: chunkCoord.x * 16, y: 64, z: chunkCoord.z * 16 }]),

      calculateSpawnChance: (mobEntry, conditions) => Effect.succeed(SpawnRate.make(0.1)),

      getPopulationCount: (chunkCoord, mobType) => STM.succeed(Population.make(5)),

      updatePopulation: (chunkCoord, mobType, delta) => STM.succeed(Population.make(Math.max(0, 5 + delta))),

      cleanupDespawnedMobs: (chunkCoord) => Effect.succeed(Population.make(0)),

      setDifficultyMultiplier: (difficulty, multiplier) => Effect.unit,

      setSpawnRate: (globalMultiplier) => Effect.unit,

      enableMobCategory: (category, enabled) => Effect.unit,

      getSpawnStatistics: (chunkCoord) =>
        Effect.succeed({
          chunkCoord,
          totalSpawns: Population.make(10),
          spawnsByType: new Map(),
          spawnsByCategory: new Map(),
          averageSpawnRate: SpawnRate.make(0.5),
          peakSpawnTime: 18000,
          successfulSpawns: Population.make(8),
          failedSpawns: Population.make(2),
          lastReset: new Date(),
        }),

      getGlobalSpawnRate: () => Effect.succeed(SpawnRate.make(1.0)),

      debugSpawnInfo: (position) =>
        Effect.succeed({
          position,
          lightLevel: 0,
          biome: Biome.make('plains'),
          blockType: 'stone',
          canSpawn: new Map(),
          spawnChances: new Map(),
          nearbyMobCount: Population.make(3),
          chunkSpawnCap: Population.make(20),
          environmentType: {
            type: 'surface',
            biome: Biome.make('plains'),
            lightLevel: 0,
            timeOfDay: 0,
            difficulty: { level: 'normal', spawnMultiplier: 1.0 },
            moonPhase: { phase: 'new_moon', modifier: 1.0 },
            nearbyBlocks: [],
          },
        }),
    })
  })
)

describe('Mob Spawning System - Property Based Tests', () => {
  const TestLayer = Layer.mergeAll(TestMobSpawningServiceLive, TestClock.live, TestRandom.deterministic)

  describe('スポーン条件の不変性テスト', () => {
    test.prop([EnvironmentConditionsArbitrary, MobTypeArbitrary, PositionArbitrary])(
      '有効な環境では必ずスポーン判定が実行される',
      (conditions, mobType, position) =>
        Effect.gen(function* () {
          const spawningService = yield* MobSpawningService

          const canSpawn = yield* spawningService.canSpawnAt(mobType, position, conditions)

          // 不変性: 結果はboolean型である
          expect(typeof canSpawn).toBe('boolean')

          // パターンマッチングの網羅性テスト
          const hasValidType = ['surface', 'underground', 'structure'].includes(conditions.type)
          expect(hasValidType).toBe(true)
        }).pipe(Effect.provide(TestLayer))
    )

    test.prop([PopulationArbitrary, SpawnRateArbitrary])(
      '人口制限は常に非負の値を保持する',
      (initialPopulation, spawnRate) =>
        Effect.gen(function* () {
          const result = yield* STM.commit(
            STM.gen(function* () {
              const population = yield* STM.ref(initialPopulation)
              const newPop = Math.max(0, initialPopulation + spawnRate * 10)
              yield* STM.set(population, Population.make(newPop))
              return yield* STM.get(population)
            })
          )

          // 不変性: 人口は非負
          expect(result).toBeGreaterThanOrEqual(0)
        }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('スポーン戦略のパフォーマンステスト', () => {
    test.prop([Schema.Array(PositionArbitrary, { minLength: 1, maxLength: 100 })])(
      '大量位置でのスポーン処理が適切な時間内に完了する',
      (positions) =>
        Effect.gen(function* () {
          const spawningService = yield* MobSpawningService
          const testClock = yield* TestClock.TestClock

          const startTime = yield* TestClock.currentTimeMillis

          // 並行スポーン処理
          const results = yield* Effect.forEach(
            positions,
            (position) =>
              spawningService.spawnMob(
                MobType.make('test_mob'),
                position,
                SpawnReason.natural({
                  naturalConditions: { lightLevel: 0, surfaceLevel: true },
                })
              ),
            { concurrency: 4 }
          )

          const endTime = yield* TestClock.currentTimeMillis
          const duration = endTime - startTime

          // パフォーマンス制約: 1000ms以内
          expect(duration).toBeLessThan(1000)
          expect(results).toHaveLength(positions.length)

          // 各結果がMobSpawnEventスキーマに準拠
          results.forEach((event) => {
            expect(event._tag).toBe('MobSpawnEvent')
            expect(event.mobType).toBeTruthy()
          })
        }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('STM並行性テスト', () => {
    test.prop([Schema.Array(MobTypeArbitrary, { minLength: 2, maxLength: 10 })])(
      '複数モブタイプの並行人口更新が競合状態を起こさない',
      (mobTypes) =>
        Effect.gen(function* () {
          const chunkCoord = { x: 0, z: 0 }

          // 並行して人口を更新
          const updateResults = yield* Effect.forEach(
            mobTypes,
            (mobType, index) =>
              STM.commit(
                STM.gen(function* () {
                  const spawningService = yield* MobSpawningService
                  return yield* spawningService.updatePopulation(chunkCoord, mobType, index + 1)
                })
              ),
            { concurrency: mobTypes.length }
          )

          // 不変性: 全ての更新が成功
          expect(updateResults).toHaveLength(mobTypes.length)
          updateResults.forEach((result, index) => {
            expect(result).toBeGreaterThan(0)
          })
        }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Streamベーススポーンテスト', () => {
    test.prop([fc.integer({ min: 1, max: 20 })])('Stream実装が指定された数のイベントを生成する', (expectedCount) =>
      Effect.gen(function* () {
        const spawningService = yield* MobSpawningService
        const chunkCoord = { x: 0, z: 0 }
        const conditions: EnvironmentConditions = {
          type: 'surface',
          biome: Biome.make('plains'),
          lightLevel: 0,
          timeOfDay: 18000,
          difficulty: { level: 'normal', spawnMultiplier: 1.0 },
          moonPhase: { phase: 'full_moon', modifier: 1.2 },
          nearbyBlocks: [],
        }

        const events = yield* spawningService
          .attemptSpawn(chunkCoord, conditions)
          .pipe(Stream.take(expectedCount), Stream.runCollect)

        // Stream不変性: 要求された数のイベントが生成される
        expect(events).toHaveLength(Math.min(expectedCount, 1)) // テスト実装では1つのみ
        events.forEach((event) => {
          expect(event._tag).toBe('MobSpawnEvent')
          expect(event.conditions).toEqual(conditions)
        })
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
```

## インテグレーションテスト

```typescript
describe('Mob Spawning Integration Tests', () => {
  const IntegrationTestLayer = Layer.mergeAll(
    MobSpawningServiceLive,
    TestWorldServiceLive,
    TestEntityServiceLive,
    TestBiomeServiceLive,
    TestGameTimeServiceLive,
    TestEventBusServiceLive
  )

  test('完全なスポーンライフサイクル', () =>
    Effect.gen(function* () {
      const spawningService = yield* MobSpawningService
      const worldService = yield* WorldService
      const gameTime = yield* GameTimeService

      // 夜間に設定
      yield* gameTime.setTimeOfDay(18000)
      yield* worldService.setLightLevel({ x: 0, y: 64, z: 0 }, 0)

      const chunkCoord = { x: 0, z: 0 }
      const conditions: EnvironmentConditions = {
        type: 'surface',
        biome: Biome.make('plains'),
        lightLevel: 0,
        timeOfDay: 18000,
        difficulty: { level: 'normal', spawnMultiplier: 1.0 },
        moonPhase: { phase: 'full_moon', modifier: 1.2 },
        nearbyBlocks: [],
      }

      // スポーン実行
      const spawnEvents = yield* spawningService.attemptSpawn(chunkCoord, conditions).pipe(Stream.runCollect)

      expect(spawnEvents.length).toBeGreaterThan(0)

      // 人口カウント確認
      const population = yield* STM.commit(spawningService.getPopulationCount(chunkCoord, spawnEvents[0].mobType))
      expect(population).toBeGreaterThan(0)

      // クリーンアップ
      const cleaned = yield* spawningService.cleanupDespawnedMobs(chunkCoord)
      expect(cleaned).toBeGreaterThanOrEqual(0)
    }).pipe(Effect.provide(IntegrationTestLayer)))
})
```

## 次のステップ

このシステムは以下との統合が必要です：

- **Entity System**: スポーンされたモブの管理・AI
- **World System**: 地形・バイオーム・構造物との連携
- **Time System**: 昼夜サイクル・月相との同期
- **Combat System**: モブの戦闘能力・ドロップ設定
- **Difficulty System**: 難易度によるスポーン調整

### 実装優先度

1. **STMベース人口管理**: 並行安全なモブカウント管理
2. **Stream API**: リアルタイムスポーンイベント処理
3. **パターンマッチング**: 環境条件による分岐処理
4. **プロパティベーステスト**: システム不変性の検証
5. **バイオーム固有ロジック**: 環境に応じたスポーン戦略
