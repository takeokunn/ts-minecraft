---
title: "Testing Patterns"
category: "Pattern Catalog"
complexity: "high"
dependencies:
  - "effect"
  - "@effect/vitest"
  - "fast-check"
  - "vitest"
ai_tags:
  - "unit-testing"
  - "integration-testing"
  - "property-based-testing"
  - "test-layers"
  - "branded-types"
implementation_time: "2-4 hours"
skill_level: "advanced"
last_pattern_update: "2025-09-14"
---

# Testing Patterns

Effect-TSアプリケーションにおけるテストのベストプラクティス集

## Pattern 1: Schema-Based Service Testing with Branded Types

**使用場面**: サービスの単体テスト（ブランド型とスキーマベース）

**実装**:
```typescript
import { Effect, Layer, Context, Schema, Match, pipe, Either, Option, Ref } from "effect"
import { describe, layer } from "@effect/vitest"
import * as fc from "fast-check"

// ブランド型定義
const ChunkIdBrand = Symbol.for("@minecraft/ChunkId")
type ChunkId = string & { readonly [ChunkIdBrand]: typeof ChunkIdBrand }
const ChunkId = (id: string): ChunkId => id as ChunkId

// スキーマ定義
const ChunkCoordinateSchema = Schema.Struct({
  x: Schema.Number,
  z: Schema.Number
})

const ChunkSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(ChunkIdBrand)),
  coordinate: ChunkCoordinateSchema,
  blocks: Schema.Array(Schema.Struct({
    position: Schema.Struct({
      x: Schema.NumberFromString,
      y: Schema.NumberFromString,
      z: Schema.NumberFromString
    }),
    material: Schema.Literal("stone", "dirt", "grass")
  })),
  entities: Schema.Array(Schema.String),
  version: Schema.Number
})

type Chunk = Schema.Schema.Type<typeof ChunkSchema>
type ChunkCoordinate = Schema.Schema.Type<typeof ChunkCoordinateSchema>

// エラースキーマ
const ChunkLoadErrorSchema = Schema.TaggedError("ChunkLoadError", {
  coordinate: ChunkCoordinateSchema,
  reason: Schema.String
})

const ChunkSaveErrorSchema = Schema.TaggedError("ChunkSaveError", {
  chunkId: Schema.String.pipe(Schema.brand(ChunkIdBrand)),
  reason: Schema.String
})

class ChunkLoadError extends Schema.TaggedError(ChunkLoadErrorSchema)("ChunkLoadError") {}
class ChunkSaveError extends Schema.TaggedError(ChunkSaveErrorSchema)("ChunkSaveError") {}

// サービス定義
export interface ChunkService {
  readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, ChunkSaveError>
}

export const ChunkService = Context.GenericTag<ChunkService>("@minecraft/ChunkService")

// モックストレージサービス
export interface StorageService {
  readonly get: (key: string) => Effect.Effect<Option.Option<string>>
  readonly set: (key: string, value: string) => Effect.Effect<void>
}

export const StorageService = Context.GenericTag<StorageService>("@minecraft/StorageService")

// テストレイヤー
const TestStorageLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, string>())

    return {
      get: (key) => pipe(
        Ref.get(store),
        Effect.map(map => Option.fromNullable(map.get(key)))
      ),

      set: (key, value) => pipe(
        Ref.update(store, map => new Map(map).set(key, value)),
        Effect.asVoid
      )
    }
  })
)

const TestChunkServiceLive = Layer.effect(
  ChunkService,
  Effect.gen(function* () {
    const storage = yield* StorageService

    return {
      loadChunk: (coord) => pipe(
        storage.get(`chunk_${coord.x}_${coord.z}`),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new ChunkLoadError({ coordinate: coord, reason: "Chunk not found" })),
            onSome: (data) => pipe(
              Schema.decodeUnknown(ChunkSchema)(JSON.parse(data)),
              Effect.mapError(() => new ChunkLoadError({ coordinate: coord, reason: "Invalid chunk data" }))
            )
          })
        )
      ),

      saveChunk: (chunk) => pipe(
        Schema.encode(ChunkSchema)(chunk),
        Effect.flatMap(encoded =>
          storage.set(`chunk_${chunk.coordinate.x}_${chunk.coordinate.z}`, JSON.stringify(encoded))
        ),
        Effect.mapError(() => new ChunkSaveError({ chunkId: chunk.id, reason: "Serialization failed" }))
      )
    }
  })
)

// テスト用データジェネレーター
const chunkArbitrary = fc.record({
  id: fc.string().map(ChunkId),
  coordinate: fc.record({
    x: fc.integer({ min: -1000, max: 1000 }),
    z: fc.integer({ min: -1000, max: 1000 })
  }),
  blocks: fc.array(
    fc.record({
      position: fc.record({
        x: fc.integer({ min: 0, max: 15 }),
        y: fc.integer({ min: 0, max: 255 }),
        z: fc.integer({ min: 0, max: 15 })
      }),
      material: fc.constantFrom("stone" as const, "dirt" as const, "grass" as const)
    }),
    { maxLength: 100 }
  ),
  entities: fc.array(fc.string(), { maxLength: 10 }),
  version: fc.nat()
})

// テスト実装
layer(Layer.provide(TestChunkServiceLive, TestStorageLive))("ChunkService", (it) => {
  it.effect("should save and load chunks correctly", () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const testChunk = yield* Effect.sync(() => fc.sample(chunkArbitrary, 1)[0])

      yield* chunkService.saveChunk(testChunk)
      const loadedChunk = yield* chunkService.loadChunk(testChunk.coordinate)

      return pipe(
        Match.value([testChunk, loadedChunk]),
        Match.when(
          ([original, loaded]) => original.id === loaded.id && original.version === loaded.version,
          () => Effect.void
        ),
        Match.orElse(() => Effect.fail("Chunk data mismatch"))
      )
    })
  )

  it.prop("chunk serialization roundtrip", [chunkArbitrary], (chunk) =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService

      yield* chunkService.saveChunk(chunk)
      const loaded = yield* chunkService.loadChunk(chunk.coordinate)

      if (loaded.id !== chunk.id) {
        return yield* Effect.fail("ID mismatch in roundtrip")
      }
    })
  )

  it.effect("should handle missing chunks with proper error", () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const nonExistentCoord = { x: 9999, z: 9999 }

      const result = yield* Effect.either(chunkService.loadChunk(nonExistentCoord))

      return pipe(
        result,
        Either.match({
          onLeft: (error) => error instanceof ChunkLoadError
            ? Effect.void
            : Effect.fail("Wrong error type"),
          onRight: () => Effect.fail("Expected error but got success")
        })
      )
    })
  )
})
```

## Pattern 2: TestClock with TestRandom for Deterministic Testing

**使用場面**: 時間に依存するロジックと確率的要素の組み合わせテスト

**実装**:
```typescript
import { TestClock, TestServices, TestContext, Random, Schedule, Duration, pipe, Match } from "effect"
import { layer } from "@effect/vitest"
import * as fc from "fast-check"

// 時間ベースのゲームイベント定義
const GameEventSchema = Schema.Struct({
  type: Schema.Literal("mob_spawn", "weather_change", "resource_regeneration"),
  timestamp: Schema.Number,
  probability: Schema.Number.pipe(Schema.between(0, 1)),
  metadata: Schema.Record(Schema.String, Schema.Unknown)
})

type GameEvent = Schema.Schema.Type<typeof GameEventSchema>

// ゲームイベントサービス
export interface GameEventService {
  readonly scheduleEvent: (event: GameEvent, delay: Duration.Duration) => Effect.Effect<void>
  readonly processEvents: () => Effect.Effect<readonly GameEvent[]>
  readonly getRandomEvent: () => Effect.Effect<GameEvent>
}

export const GameEventService = Context.GenericTag<GameEventService>("@minecraft/GameEventService")

// テスト用のGameEventService実装
const TestGameEventServiceLive = Layer.effect(
  GameEventService,
  Effect.gen(function* () {
    const events = yield* Ref.make<GameEvent[]>([])
    const scheduledEvents = yield* Ref.make<Array<{ event: GameEvent; executeAt: number }>>([])

    return {
      scheduleEvent: (event, delay) => pipe(
        Effect.clockWith(clock => clock.currentTimeMillis),
        Effect.flatMap(currentTime =>
          Ref.update(scheduledEvents, arr => [...arr, {
            event,
            executeAt: currentTime + Duration.toMillis(delay)
          }])
        )
      ),

      processEvents: () => pipe(
        Effect.all([
          Effect.clockWith(clock => clock.currentTimeMillis),
          Ref.get(scheduledEvents)
        ]),
        Effect.flatMap(([currentTime, scheduled]) => {
          const readyEvents = scheduled
            .filter(({ executeAt }) => executeAt <= currentTime)
            .map(({ event }) => event)

          return pipe(
            Ref.set(scheduledEvents, scheduled.filter(({ executeAt }) => executeAt > currentTime)),
            Effect.flatMap(() => Ref.update(events, arr => [...arr, ...readyEvents])),
            Effect.as(readyEvents)
          )
        })
      ),

      getRandomEvent: () => pipe(
        Random.next,
        Effect.map(random => ({
          type: random < 0.3 ? "mob_spawn" as const :
                random < 0.6 ? "weather_change" as const :
                "resource_regeneration" as const,
          timestamp: Date.now(),
          probability: random,
          metadata: { randomValue: random }
        }))
      )
    }
  })
)

// テスト用の固定乱数値
const fixedRandomValues = [0.1, 0.4, 0.7, 0.2, 0.9, 0.5]

// 時間ベースのプロパティ生成器
const gameEventArbitrary = fc.record({
  type: fc.constantFrom("mob_spawn" as const, "weather_change" as const, "resource_regeneration" as const),
  timestamp: fc.nat(),
  probability: fc.float({ min: 0, max: 1 }),
  metadata: fc.dictionary(fc.string(), fc.anything())
})

const durationArbitrary = fc.integer({ min: 100, max: 10000 }).map(ms => Duration.millis(ms))

// テスト実装
layer(TestGameEventServiceLive)("GameEventService with TestClock", (it) => {
  it.effect("should handle scheduled events with precise timing", () =>
    Effect.gen(function* () {
      const gameEventService = yield* GameEventService
      const testClock = yield* TestClock.TestClock

      const event1: GameEvent = {
        type: "mob_spawn",
        timestamp: 1000,
        probability: 0.5,
        metadata: { mob: "zombie" }
      }

      const event2: GameEvent = {
        type: "weather_change",
        timestamp: 2000,
        probability: 0.8,
        metadata: { weather: "rain" }
      }

      // イベントをスケジュール（1秒後と3秒後）
      yield* gameEventService.scheduleEvent(event1, Duration.seconds(1))
      yield* gameEventService.scheduleEvent(event2, Duration.seconds(3))

      // 最初は何も実行されない
      const initialEvents = yield* gameEventService.processEvents()
      if (initialEvents.length !== 0) {
        return yield* Effect.fail("Expected no events initially")
      }

      // 1秒進める
      yield* testClock.adjust(Duration.seconds(1))
      const firstBatch = yield* gameEventService.processEvents()

      return pipe(
        Match.value(firstBatch.length),
        Match.when(1, () => pipe(
          testClock.adjust(Duration.seconds(2)),
          Effect.flatMap(() => gameEventService.processEvents()),
          Effect.flatMap(secondBatch =>
            secondBatch.length === 1
              ? Effect.void
              : Effect.fail("Expected exactly one event in second batch")
          )
        )),
        Match.orElse(() => Effect.fail("Expected exactly one event in first batch"))
      )
    }).pipe(
      Effect.provide(TestContext.TestContext)
    )
  )

  it.effect("should generate deterministic random events", () =>
    Effect.gen(function* () {
      const gameEventService = yield* GameEventService

      // 固定された乱数値で複数のイベントを生成
      const events = yield* Effect.all([
        gameEventService.getRandomEvent(),
        gameEventService.getRandomEvent(),
        gameEventService.getRandomEvent()
      ])

      return pipe(
        Match.value(events.map(e => e.type)),
        Match.when(
          (types) => types[0] === "mob_spawn" && types[1] === "weather_change" && types[2] === "resource_regeneration",
          () => Effect.void
        ),
        Match.orElse(() => Effect.fail("Random events didn't match expected deterministic sequence"))
      )
    }).pipe(
      Effect.withRandom(Random.fixed(fixedRandomValues)),
      Effect.provide(TestContext.TestContext)
    )
  )

  it.prop("event scheduling maintains temporal ordering", [fc.array(durationArbitrary, { minLength: 2, maxLength: 5 })], (delays) =>
    Effect.gen(function* () {
      const gameEventService = yield* GameEventService
      const testClock = yield* TestClock.TestClock

      const events = delays.map((_, index) => ({
        type: "mob_spawn" as const,
        timestamp: index,
        probability: 0.5,
        metadata: { order: index }
      }))

      // 全イベントをスケジュール
      yield* Effect.all(
        events.map((event, index) =>
          gameEventService.scheduleEvent(event, delays[index])
        )
      )

      // 最大遅延時間まで時間を進める
      const maxDelay = delays.reduce((max, delay) =>
        Duration.greaterThan(delay, max) ? delay : max
      )
      yield* testClock.adjust(maxDelay)

      // 全イベントが処理されることを確認
      const processedEvents = yield* gameEventService.processEvents()

      if (processedEvents.length !== events.length) {
        return yield* Effect.fail("Not all events were processed")
      }
    }).pipe(
      Effect.provide(TestContext.TestContext)
    )
  )

  it.effect("should handle concurrent time-based operations", () =>
    Effect.gen(function* () {
      const gameEventService = yield* GameEventService
      const testClock = yield* TestClock.TestClock
      const results = yield* Ref.make<string[]>([])

      // 並行タスク: 異なる間隔で結果を記録
      const task1 = pipe(
        Effect.sleep(Duration.millis(100)),
        Effect.flatMap(() => Ref.update(results, arr => [...arr, "task1_100ms"])),
        Effect.flatMap(() => Effect.sleep(Duration.millis(200))),
        Effect.flatMap(() => Ref.update(results, arr => [...arr, "task1_300ms"]))
      )

      const task2 = pipe(
        Effect.sleep(Duration.millis(150)),
        Effect.flatMap(() => Ref.update(results, arr => [...arr, "task2_150ms"])),
        Effect.flatMap(() => Effect.sleep(Duration.millis(100))),
        Effect.flatMap(() => Ref.update(results, arr => [...arr, "task2_250ms"]))
      )

      // 両方のタスクを並行実行
      const fiber1 = yield* Effect.fork(task1)
      const fiber2 = yield* Effect.fork(task2)

      // 段階的に時間を進める
      yield* testClock.adjust(Duration.millis(100))
      const result100ms = yield* Ref.get(results)

      yield* testClock.adjust(Duration.millis(50))  // 150ms total
      const result150ms = yield* Ref.get(results)

      yield* testClock.adjust(Duration.millis(150)) // 300ms total

      yield* Fiber.await(fiber1)
      yield* Fiber.await(fiber2)

      const finalResult = yield* Ref.get(results)

      return pipe(
        Match.value([result100ms, result150ms, finalResult]),
        Match.when(
          ([r100, r150, final]) =>
            r100.includes("task1_100ms") &&
            r150.includes("task2_150ms") &&
            final.length === 4,
          () => Effect.void
        ),
        Match.orElse(() => Effect.fail("Concurrent timing test failed"))
      )
    }).pipe(
      Effect.provide(TestContext.TestContext)
    )
  )
})
```

## Pattern 3: Advanced Property-Based Testing with Schema Integration

**使用場面**: スキーマ連携による高度なプロパティテスト

**実装**:
```typescript
import { Schema, Arbitrary, pipe, Match, Array as EffectArray } from "effect"
import { it } from "@effect/vitest"
import * as fc from "fast-check"

// ブランド型とスキーマベースの型定義
const MaterialIdBrand = Symbol.for("@minecraft/MaterialId")
type MaterialId = number & { readonly [MaterialIdBrand]: typeof MaterialIdBrand }

const BiomeIdBrand = Symbol.for("@minecraft/BiomeId")
type BiomeId = string & { readonly [BiomeIdBrand]: typeof BiomeIdBrand }

const BlockPositionSchema = Schema.Struct({
  x: Schema.NumberFromString.pipe(Schema.int(), Schema.between(0, 15)),
  y: Schema.NumberFromString.pipe(Schema.int(), Schema.between(0, 255)),
  z: Schema.NumberFromString.pipe(Schema.int(), Schema.between(0, 15))
})

const MaterialSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.brand(MaterialIdBrand)),
  name: Schema.Literal("stone", "dirt", "grass", "water", "air"),
  hardness: Schema.Number.pipe(Schema.between(0, 10)),
  luminance: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  transparency: Schema.Boolean,
  renewable: Schema.Boolean
})

const BiomeSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(BiomeIdBrand)),
  name: Schema.String,
  temperature: Schema.Number.pipe(Schema.between(-2, 2)),
  humidity: Schema.Number.pipe(Schema.between(0, 1)),
  supportedMaterials: Schema.Array(Schema.Number.pipe(Schema.brand(MaterialIdBrand)))
})

const BlockSchema = Schema.Struct({
  position: BlockPositionSchema,
  material: MaterialSchema,
  biome: BiomeSchema,
  metadata: Schema.Record(Schema.String, Schema.Union(Schema.String, Schema.Number, Schema.Boolean))
})

const ChunkGenerationRuleSchema = Schema.Struct({
  biomes: Schema.Array(BiomeSchema, { minItems: 1, maxItems: 4 }),
  materialDistribution: Schema.Record(
    Schema.String.pipe(Schema.brand(MaterialIdBrand)),
    Schema.Number.pipe(Schema.between(0, 1))
  ),
  heightVariation: Schema.Number.pipe(Schema.between(0, 64))
})

type Block = Schema.Schema.Type<typeof BlockSchema>
type Material = Schema.Schema.Type<typeof MaterialSchema>
type Biome = Schema.Schema.Type<typeof BiomeSchema>
type ChunkGenerationRule = Schema.Schema.Type<typeof ChunkGenerationRuleSchema>

// Fast-Check Arbitraryとの連携
const materialArbitrary = fc.record({
  id: fc.nat().map(n => n as MaterialId),
  name: fc.constantFrom("stone" as const, "dirt" as const, "grass" as const, "water" as const, "air" as const),
  hardness: fc.float({ min: 0, max: 10 }),
  luminance: fc.integer({ min: 0, max: 15 }),
  transparency: fc.boolean(),
  renewable: fc.boolean()
})

const biomeArbitrary = fc.record({
  id: fc.string().map(s => s as BiomeId),
  name: fc.string({ minLength: 3, maxLength: 20 }),
  temperature: fc.float({ min: -2, max: 2 }),
  humidity: fc.float({ min: 0, max: 1 }),
  supportedMaterials: fc.array(fc.nat().map(n => n as MaterialId), { minLength: 1, maxLength: 10 })
})

const blockArbitrary = fc.record({
  position: fc.record({
    x: fc.integer({ min: 0, max: 15 }),
    y: fc.integer({ min: 0, max: 255 }),
    z: fc.integer({ min: 0, max: 15 })
  }),
  material: materialArbitrary,
  biome: biomeArbitrary,
  metadata: fc.dictionary(
    fc.string(),
    fc.oneof(fc.string(), fc.float(), fc.boolean())
  )
})

// インバリアント関数
const validateMaterialBiomeCompatibility = (block: Block): Effect.Effect<boolean> =>
  Effect.sync(() =>
    block.biome.supportedMaterials.includes(block.material.id)
  )

const validateBlockPosition = (block: Block): Effect.Effect<boolean> =>
  pipe(
    Match.value(block.position),
    Match.when(
      pos => pos.x >= 0 && pos.x <= 15 && pos.y >= 0 && pos.y <= 255 && pos.z >= 0 && pos.z <= 15,
      () => Effect.succeed(true)
    ),
    Match.orElse(() => Effect.succeed(false))
  )

// チャンク生成ロジック
const generateChunk = (rule: ChunkGenerationRule): Effect.Effect<Block[]> =>
  Effect.gen(function* () {
    const blocks: Block[] = []

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const biome = yield* Effect.sync(() =>
          rule.biomes[Math.floor(Math.random() * rule.biomes.length)]
        )

        for (let y = 0; y < 64 + rule.heightVariation; y++) {
          const materialId = yield* Effect.sync(() =>
            biome.supportedMaterials[Math.floor(Math.random() * biome.supportedMaterials.length)]
          )

          const material: Material = {
            id: materialId,
            name: "stone", // 簡略化
            hardness: 5,
            luminance: 0,
            transparency: false,
            renewable: false
          }

          blocks.push({
            position: { x, y, z },
            material,
            biome,
            metadata: {}
          })
        }
      }
    }

    return blocks
  })

// プロパティベーステスト実装
describe("Advanced Property-Based Testing", () => {
  it.prop("generated blocks maintain material-biome compatibility", [blockArbitrary], (block) =>
    Effect.gen(function* () {
      const isCompatible = yield* validateMaterialBiomeCompatibility(block)

      return pipe(
        Match.value(isCompatible),
        Match.when(true, () => Effect.void),
        Match.orElse(() => Effect.fail("Material not compatible with biome"))
      )
    })
  )

  it.prop("block positions are always within chunk boundaries", [blockArbitrary], (block) =>
    Effect.gen(function* () {
      const isValid = yield* validateBlockPosition(block)

      if (!isValid) {
        return yield* Effect.fail("Block position out of bounds")
      }
    })
  )

  it.prop("chunk generation respects biome constraints", [
    fc.record({
      biomes: fc.array(biomeArbitrary, { minLength: 1, maxLength: 4 }),
      materialDistribution: fc.dictionary(
        fc.nat().map(n => String(n) as string & { readonly [MaterialIdBrand]: typeof MaterialIdBrand }),
        fc.float({ min: 0, max: 1 })
      ),
      heightVariation: fc.float({ min: 0, max: 64 })
    })
  ], (generationRule) =>
    Effect.gen(function* () {
      const blocks = yield* generateChunk(generationRule)

      // 全ブロックがバイオーム制約を満たすか検証
      const validationResults = yield* Effect.all(
        blocks.map(validateMaterialBiomeCompatibility),
        { concurrency: 10 }
      )

      const allValid = validationResults.every(Boolean)
      if (!allValid) {
        return yield* Effect.fail("Generated chunk contains invalid material-biome combinations")
      }
    })
  )

  it.effect("schema-based serialization roundtrip maintains type safety", () =>
    Effect.gen(function* () {
      const testBlocks = yield* Effect.sync(() => fc.sample(blockArbitrary, 50))

      const results = yield* Effect.all(
        testBlocks.map(block =>
          pipe(
            Schema.encode(BlockSchema)(block),
            Effect.flatMap(encoded => Schema.decodeUnknown(BlockSchema)(encoded)),
            Effect.map(decoded => ({ original: block, decoded })),
            Effect.catchAll(error => Effect.succeed({ error }))
          )
        )
      )

      const failures = results.filter(result => 'error' in result)
      if (failures.length > 0) {
        return yield* Effect.fail(`Serialization failed for ${failures.length} blocks`)
      }

      // 型レベルでの検証（コンパイル時）
      const validResults = results.filter((result): result is { original: Block; decoded: Block } =>
        'decoded' in result
      )

      return pipe(
        EffectArray.every(validResults, ({ original, decoded }) =>
          original.position.x === decoded.position.x &&
          original.material.id === decoded.material.id &&
          original.biome.id === decoded.biome.id
        ),
        Effect.flatMap(allMatch =>
          allMatch
            ? Effect.void
            : Effect.fail("Roundtrip serialization data mismatch")
        )
      )
    })
  )

  it.prop("invariant: water blocks should not exist above y=64 in hot biomes", [
    fc.array(blockArbitrary, { minLength: 10, maxLength: 100 })
  ], (blocks) =>
    Effect.gen(function* () {
      const violations = blocks.filter(block =>
        block.material.name === "water" &&
        block.position.y > 64 &&
        block.biome.temperature > 1.0
      )

      if (violations.length > 0) {
        return yield* Effect.fail(`Found ${violations.length} invalid water blocks in hot biomes above y=64`)
      }
    })
  )

  it.prop("performance: large chunk processing completes within time bounds", [
    fc.array(blockArbitrary, { minLength: 1000, maxLength: 4096 })
  ], (blocks) =>
    Effect.gen(function* () {
      const startTime = yield* Effect.sync(() => performance.now())

      // 大量のブロック処理（バリデーション + 変換）
      yield* Effect.all(
        blocks.map(block =>
          pipe(
            validateMaterialBiomeCompatibility(block),
            Effect.zip(validateBlockPosition(block)),
            Effect.flatMap(([isCompatible, isValidPos]) =>
              isCompatible && isValidPos
                ? Effect.succeed(block)
                : Effect.fail("Invalid block")
            )
          )
        ),
        { concurrency: 50 }
      )

      const endTime = yield* Effect.sync(() => performance.now())
      const duration = endTime - startTime

      if (duration > 1000) { // 1秒以内
        return yield* Effect.fail(`Processing took too long: ${duration}ms`)
      }
    })
  )
})
```

## Pattern 4: Layer-Based Integration Testing with Test Isolation

**使用場面**: 複数レイヤーでの統合テスト（完全分離とクリーンアップ）

**実装**:
```typescript
import { KeyValueStore, TestServices } from "effect"
import { layer, flakyTest } from "@effect/vitest"
import * as fc from "fast-check"

// ブランド型とスキーマ定義
const PlayerIdBrand = Symbol.for("@minecraft/PlayerId")
type PlayerId = string & { readonly [PlayerIdBrand]: typeof PlayerIdBrand }

const InventoryIdBrand = Symbol.for("@minecraft/InventoryId")
type InventoryId = string & { readonly [InventoryIdBrand]: typeof InventoryIdBrand }

const PlayerSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(PlayerIdBrand)),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number.pipe(Schema.between(0, 255)),
    z: Schema.Number
  }),
  health: Schema.Number.pipe(Schema.int(), Schema.between(0, 20)),
  inventory: Schema.Array(Schema.String.pipe(Schema.brand(InventoryIdBrand))),
  lastLogin: Schema.DateFromString,
  experience: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  gameMode: Schema.Literal("survival", "creative", "adventure", "spectator")
})

type Player = Schema.Schema.Type<typeof PlayerSchema>

// エラー型
const PlayerNotFoundErrorSchema = Schema.TaggedError("PlayerNotFoundError", {
  playerId: Schema.String.pipe(Schema.brand(PlayerIdBrand))
})

const PlayerSaveErrorSchema = Schema.TaggedError("PlayerSaveError", {
  playerId: Schema.String.pipe(Schema.brand(PlayerIdBrand)),
  reason: Schema.String
})

class PlayerNotFoundError extends Schema.TaggedError(PlayerNotFoundErrorSchema)("PlayerNotFoundError") {}
class PlayerSaveError extends Schema.TaggedError(PlayerSaveErrorSchema)("PlayerSaveError") {}

// サービス定義
export interface PlayerRepository {
  readonly save: (player: Player) => Effect.Effect<void, PlayerSaveError>
  readonly findById: (id: PlayerId) => Effect.Effect<Option.Option<Player>, never>
  readonly delete: (id: PlayerId) => Effect.Effect<void, PlayerNotFoundError>
  readonly findAll: () => Effect.Effect<readonly Player[]>
  readonly updateHealth: (id: PlayerId, health: number) => Effect.Effect<void, PlayerNotFoundError>
}

export const PlayerRepository = Context.GenericTag<PlayerRepository>("@minecraft/PlayerRepository")

export interface DatabaseService {
  readonly transaction: <A, E>(
    operation: Effect.Effect<A, E>
  ) => Effect.Effect<A, E>
  readonly query: <T>(sql: string, params?: unknown[]) => Effect.Effect<T[]>
  readonly execute: (sql: string, params?: unknown[]) => Effect.Effect<number>
  readonly cleanup: () => Effect.Effect<void>
}

export const DatabaseService = Context.GenericTag<DatabaseService>("@minecraft/DatabaseService")

export interface CacheService {
  readonly get: <T>(key: string) => Effect.Effect<Option.Option<T>>
  readonly set: <T>(key: string, value: T, ttl?: Duration.Duration) => Effect.Effect<void>
  readonly invalidate: (key: string) => Effect.Effect<void>
  readonly clear: () => Effect.Effect<void>
}

export const CacheService = Context.GenericTag<CacheService>("@minecraft/CacheService")

// テスト用実装レイヤー
const TestDatabaseLive = Layer.scoped(
  DatabaseService,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, any>())
    const transactionCount = yield* Ref.make(0)

    const cleanup = yield* Effect.addFinalizer(() =>
      pipe(
        Ref.set(store, new Map()),
        Effect.zipRight(Ref.set(transactionCount, 0)),
        Effect.zipRight(Effect.logDebug("Test database cleaned up"))
      )
    )

    return {
      transaction: <A, E>(operation: Effect.Effect<A, E>): Effect.Effect<A, E> =>
        pipe(
          Ref.update(transactionCount, n => n + 1),
          Effect.zipRight(operation),
          Effect.ensuring(Ref.update(transactionCount, n => n - 1))
        ),

      query: <T>(sql: string, params: unknown[] = []): Effect.Effect<T[]> =>
        pipe(
          Ref.get(store),
          Effect.map(db => {
            if (sql.includes("SELECT * FROM players WHERE id = ?")) {
              const playerId = params[0] as string
              const player = db.get(`player:${playerId}`)
              return player ? [player] : []
            }
            if (sql.includes("SELECT * FROM players")) {
              const players = Array.from(db.entries())
                .filter(([key]) => key.startsWith("player:"))
                .map(([_, value]) => value)
              return players
            }
            return []
          })
        ),

      execute: (sql: string, params: unknown[] = []): Effect.Effect<number> =>
        pipe(
          Ref.get(store),
          Effect.flatMap(db => {
            if (sql.includes("INSERT INTO players")) {
              const [id, playerData] = params
              const newDb = new Map(db)
              newDb.set(`player:${id}`, playerData)
              return pipe(
                Ref.set(store, newDb),
                Effect.as(1)
              )
            }
            if (sql.includes("DELETE FROM players WHERE id = ?")) {
              const playerId = params[0] as string
              const newDb = new Map(db)
              const existed = newDb.delete(`player:${playerId}`)
              return pipe(
                Ref.set(store, newDb),
                Effect.as(existed ? 1 : 0)
              )
            }
            if (sql.includes("UPDATE players SET health = ? WHERE id = ?")) {
              const [health, playerId] = params
              const player = db.get(`player:${playerId}`)
              if (!player) return Effect.as(0)

              const updatedPlayer = { ...player, health }
              const newDb = new Map(db)
              newDb.set(`player:${playerId}`, updatedPlayer)

              return pipe(
                Ref.set(store, newDb),
                Effect.as(1)
              )
            }
            return Effect.as(0)
          })
        ),

      cleanup: () => pipe(
        Ref.set(store, new Map()),
        Effect.zipRight(Effect.logDebug("Database cleanup executed"))
      )
    }
  })
)

const TestCacheLive = Layer.scoped(
  CacheService,
  Effect.gen(function* () {
    const cache = yield* Ref.make(new Map<string, { value: any; expiresAt: number }>())

    yield* Effect.addFinalizer(() =>
      pipe(
        Ref.set(cache, new Map()),
        Effect.zipRight(Effect.logDebug("Test cache cleaned up"))
      )
    )

    return {
      get: <T>(key: string): Effect.Effect<Option.Option<T>> =>
        pipe(
          Ref.get(cache),
          Effect.map(cacheData => {
            const entry = cacheData.get(key)
            if (!entry || entry.expiresAt < Date.now()) {
              return Option.none()
            }
            return Option.some(entry.value)
          })
        ),

      set: <T>(key: string, value: T, ttl?: Duration.Duration): Effect.Effect<void> =>
        pipe(
          Effect.sync(() => ({
            value,
            expiresAt: ttl ? Date.now() + Duration.toMillis(ttl) : Date.now() + 60000
          })),
          Effect.flatMap(entry =>
            Ref.update(cache, cacheData => new Map(cacheData).set(key, entry))
          )
        ),

      invalidate: (key: string): Effect.Effect<void> =>
        Ref.update(cache, cacheData => {
          const newCache = new Map(cacheData)
          newCache.delete(key)
          return newCache
        }),

      clear: (): Effect.Effect<void> =>
        Ref.set(cache, new Map())
    }
  })
)

const TestPlayerRepositoryLive = Layer.effect(
  PlayerRepository,
  Effect.gen(function* () {
    const db = yield* DatabaseService
    const cache = yield* CacheService

    return {
      save: (player: Player): Effect.Effect<void, PlayerSaveError> =>
        pipe(
          db.transaction(
            pipe(
              Schema.encode(PlayerSchema)(player),
              Effect.flatMap(encodedPlayer =>
                db.execute(
                  "INSERT INTO players (id, data) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET data = ?",
                  [player.id, JSON.stringify(encodedPlayer), JSON.stringify(encodedPlayer)]
                )
              )
            )
          ),
          Effect.zipRight(cache.invalidate(`player:${player.id}`)),
          Effect.mapError(() => new PlayerSaveError({ playerId: player.id, reason: "Database error" }))
        ),

      findById: (id: PlayerId): Effect.Effect<Option.Option<Player>, never> =>
        pipe(
          cache.get<Player>(`player:${id}`),
          Effect.flatMap(
            Option.match({
              onNone: () => pipe(
                db.query<any>("SELECT * FROM players WHERE id = ?", [id]),
                Effect.map(results => results.length > 0 ? Option.some(results[0]) : Option.none()),
                Effect.tap(
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: (player) => cache.set(`player:${id}`, player, Duration.minutes(5))
                  })
                )
              ),
              onSome: (cachedPlayer) => Effect.succeed(Option.some(cachedPlayer))
            })
          ),
          Effect.orElse(() => Effect.succeed(Option.none()))
        ),

      delete: (id: PlayerId): Effect.Effect<void, PlayerNotFoundError> =>
        pipe(
          db.execute("DELETE FROM players WHERE id = ?", [id]),
          Effect.flatMap(rowsAffected =>
            rowsAffected === 0
              ? Effect.fail(new PlayerNotFoundError({ playerId: id }))
              : Effect.void
          ),
          Effect.zipRight(cache.invalidate(`player:${id}`))
        ),

      findAll: (): Effect.Effect<readonly Player[]> =>
        pipe(
          db.query<Player>("SELECT * FROM players"),
          Effect.orElse(() => Effect.succeed([]))
        ),

      updateHealth: (id: PlayerId, health: number): Effect.Effect<void, PlayerNotFoundError> =>
        pipe(
          db.execute("UPDATE players SET health = ? WHERE id = ?", [health, id]),
          Effect.flatMap(rowsAffected =>
            rowsAffected === 0
              ? Effect.fail(new PlayerNotFoundError({ playerId: id }))
              : Effect.void
          ),
          Effect.zipRight(cache.invalidate(`player:${id}`))
        )
    }
  })
)

// プロパティテスト用ジェネレーター
const playerArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 32 }).map(s => s as PlayerId),
  name: fc.string({ minLength: 1, maxLength: 16 }),
  position: fc.record({
    x: fc.float({ min: -30000000, max: 30000000 }),
    y: fc.float({ min: 0, max: 255 }),
    z: fc.float({ min: -30000000, max: 30000000 })
  }),
  health: fc.integer({ min: 0, max: 20 }),
  inventory: fc.array(fc.string().map(s => s as InventoryId), { maxLength: 36 }),
  lastLogin: fc.date(),
  experience: fc.nat(),
  gameMode: fc.constantFrom("survival" as const, "creative" as const, "adventure" as const, "spectator" as const)
})

// テストレイヤー統合
const TestApplicationLive = Layer.provide(
  TestPlayerRepositoryLive,
  Layer.merge(TestDatabaseLive, TestCacheLive)
)

// テスト実装
layer(TestApplicationLive)("PlayerRepository Integration", (it) => {
  it.effect("should handle complete player lifecycle with caching", () =>
    Effect.gen(function* () {
      const playerRepo = yield* PlayerRepository
      const cache = yield* CacheService

      const testPlayer: Player = {
        id: "test-player-1" as PlayerId,
        name: "IntegrationPlayer",
        position: { x: 100, y: 64, z: -50 },
        health: 20,
        inventory: ["sword", "pickaxe"] as InventoryId[],
        lastLogin: new Date(),
        experience: 1500,
        gameMode: "survival"
      }

      // 保存テスト
      yield* playerRepo.save(testPlayer)

      // 読み込みテスト（DBから）
      const loaded1 = yield* playerRepo.findById(testPlayer.id)
      if (Option.isNone(loaded1)) {
        return yield* Effect.fail("Player not found after save")
      }

      // 読み込みテスト（キャッシュから）
      const loaded2 = yield* playerRepo.findById(testPlayer.id)
      if (Option.isNone(loaded2)) {
        return yield* Effect.fail("Player not found in cache")
      }

      // ヘルス更新テスト
      yield* playerRepo.updateHealth(testPlayer.id, 15)
      const updatedPlayer = yield* playerRepo.findById(testPlayer.id)

      return pipe(
        Match.value(updatedPlayer),
        Match.when(
          Option.isSome,
          (player) => player.value.health === 15
            ? Effect.void
            : Effect.fail("Health not updated correctly")
        ),
        Match.orElse(() => Effect.fail("Updated player not found"))
      )
    })
  )

  it.prop("concurrent operations maintain data consistency", [
    fc.array(playerArbitrary, { minLength: 5, maxLength: 20 })
  ], (players) =>
    Effect.gen(function* () {
      const playerRepo = yield* PlayerRepository

      // 並行保存
      yield* Effect.all(
        players.map(player => playerRepo.save(player)),
        { concurrency: 10 }
      )

      // 並行読み込み
      const loadedPlayers = yield* Effect.all(
        players.map(player => playerRepo.findById(player.id)),
        { concurrency: 10 }
      )

      const foundCount = loadedPlayers.filter(Option.isSome).length

      if (foundCount !== players.length) {
        return yield* Effect.fail(`Expected ${players.length} players, found ${foundCount}`)
      }

      // 並行削除
      yield* Effect.all(
        players.map(player => playerRepo.delete(player.id)),
        { concurrency: 10 }
      )

      const remainingPlayers = yield* playerRepo.findAll()
      if (remainingPlayers.length > 0) {
        return yield* Effect.fail(`${remainingPlayers.length} players remain after deletion`)
      }
    })
  )

  it.effect("database transaction rollback maintains consistency", () =>
    flakyTest(
      Effect.gen(function* () {
        const playerRepo = yield* PlayerRepository
        const db = yield* DatabaseService

        const player1: Player = {
          id: "txn-player-1" as PlayerId,
          name: "TxnPlayer1",
          position: { x: 0, y: 64, z: 0 },
          health: 20,
          inventory: [],
          lastLogin: new Date(),
          experience: 0,
          gameMode: "survival"
        }

        const player2: Player = {
          id: "txn-player-2" as PlayerId,
          name: "TxnPlayer2",
          position: { x: 10, y: 64, z: 10 },
          health: 15,
          inventory: [],
          lastLogin: new Date(),
          experience: 100,
          gameMode: "creative"
        }

        // トランザクション内での複数操作（失敗をシミュレート）
        const transactionResult = yield* Effect.either(
          db.transaction(
            pipe(
              playerRepo.save(player1),
              Effect.zipRight(playerRepo.save(player2)),
              Effect.zipRight(Effect.fail("Simulated transaction failure"))
            )
          )
        )

        if (Either.isRight(transactionResult)) {
          return yield* Effect.fail("Expected transaction to fail")
        }

        // ロールバック後の状態確認
        const foundPlayer1 = yield* playerRepo.findById(player1.id)
        const foundPlayer2 = yield* playerRepo.findById(player2.id)

        return pipe(
          Match.value([foundPlayer1, foundPlayer2]),
          Match.when(
            ([p1, p2]) => Option.isNone(p1) && Option.isNone(p2),
            () => Effect.void
          ),
          Match.orElse(() => Effect.fail("Transaction rollback failed - players still exist"))
        )
      }),
      Duration.seconds(5)
    )
  )

  it.effect("cache invalidation works correctly across operations", () =>
    Effect.gen(function* () {
      const playerRepo = yield* PlayerRepository
      const cache = yield* CacheService

      const testPlayer: Player = {
        id: "cache-test-player" as PlayerId,
        name: "CachePlayer",
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        inventory: [],
        lastLogin: new Date(),
        experience: 0,
        gameMode: "survival"
      }

      // プレイヤー保存
      yield* playerRepo.save(testPlayer)

      // 初回読み込み（キャッシュに格納）
      yield* playerRepo.findById(testPlayer.id)

      // キャッシュされていることを確認
      const cachedPlayer = yield* cache.get<Player>(`player:${testPlayer.id}`)
      if (Option.isNone(cachedPlayer)) {
        return yield* Effect.fail("Player not cached after first read")
      }

      // ヘルス更新（キャッシュ無効化）
      yield* playerRepo.updateHealth(testPlayer.id, 10)

      // キャッシュが無効化されていることを確認
      const invalidatedCache = yield* cache.get<Player>(`player:${testPlayer.id}`)
      if (Option.isSome(invalidatedCache)) {
        return yield* Effect.fail("Cache not invalidated after update")
      }

      // 再読み込みで新しい値を取得
      const reloadedPlayer = yield* playerRepo.findById(testPlayer.id)

      return pipe(
        Match.value(reloadedPlayer),
        Match.when(
          Option.isSome,
          (player) => player.value.health === 10
            ? Effect.void
            : Effect.fail("Updated health not reflected")
        ),
        Match.orElse(() => Effect.fail("Player not found after cache invalidation"))
      )
    })
  )
})
```

## Pattern 5: Advanced Error Testing with Schema Validation

**使用場面**: タイプセーフなエラーハンドリングとリトライ戦略のテスト

**実装**:
```typescript
import { Schedule, Retry, pipe, Match } from "effect"
import { layer } from "@effect/vitest"
import * as fc from "fast-check"

// エラー型スキーマ定義
const NetworkErrorSchema = Schema.TaggedError("NetworkError", {
  url: Schema.String,
  statusCode: Schema.Number.pipe(Schema.int(), Schema.between(400, 599)),
  message: Schema.String,
  retryAfter: Schema.optional(Schema.Number),
  headers: Schema.optional(Schema.Record(Schema.String, Schema.String))
})

const TimeoutErrorSchema = Schema.TaggedError("TimeoutError", {
  operation: Schema.String,
  timeoutMs: Schema.Number.pipe(Schema.positive()),
  elapsed: Schema.Number.pipe(Schema.nonNegative())
})

const ValidationErrorSchema = Schema.TaggedError("ValidationError", {
  field: Schema.String,
  expected: Schema.String,
  received: Schema.Unknown,
  path: Schema.Array(Schema.Union(Schema.String, Schema.Number))
})

class NetworkError extends Schema.TaggedError(NetworkErrorSchema)("NetworkError") {}
class TimeoutError extends Schema.TaggedError(TimeoutErrorSchema)("TimeoutError") {}
class ValidationError extends Schema.TaggedError(ValidationErrorSchema)("ValidationError") {}

// ネットワークサービス定義
export interface NetworkService {
  readonly fetch: <T>(url: string, options?: RequestOptions) => Effect.Effect<T, NetworkError | TimeoutError>
  readonly upload: (url: string, data: Uint8Array) => Effect.Effect<UploadResponse, NetworkError>
  readonly healthCheck: () => Effect.Effect<boolean, NetworkError>
}

export const NetworkService = Context.GenericTag<NetworkService>("@minecraft/NetworkService")

type RequestOptions = {
  timeout?: Duration.Duration
  retries?: number
  headers?: Record<string, string>
}

type UploadResponse = {
  success: boolean
  bytesTransferred: number
  url: string
}

// APIサービス定義
export interface ApiService {
  readonly fetchPlayerData: (playerId: string) => Effect.Effect<Player, NetworkError | ValidationError>
  readonly fetchWorldData: (worldId: string) => Effect.Effect<WorldData, NetworkError | TimeoutError>
  readonly retryableFetch: <T>(operation: Effect.Effect<T, NetworkError>) => Effect.Effect<T, NetworkError>
}

export const ApiService = Context.GenericTag<ApiService>("@minecraft/ApiService")

type WorldData = {
  id: string
  name: string
  seed: bigint
  players: readonly string[]
  chunks: number
}

// テスト用ネットワークサービス実装（エラーシミュレーション）
const TestNetworkServiceLive = Layer.effect(
  NetworkService,
  Effect.gen(function* () {
    const failureConfig = yield* Ref.make({
      shouldFail: false,
      failureType: "network" as "network" | "timeout",
      failureCount: 0,
      maxFailures: 2
    })

    return {
      fetch: <T>(url: string, options?: RequestOptions): Effect.Effect<T, NetworkError | TimeoutError> =>
        pipe(
          Ref.get(failureConfig),
          Effect.flatMap(config => {
            if (config.shouldFail && config.failureCount < config.maxFailures) {
              return pipe(
                Ref.update(failureConfig, cfg => ({ ...cfg, failureCount: cfg.failureCount + 1 })),
                Effect.zipRight(
                  config.failureType === "network"
                    ? Effect.fail(new NetworkError({
                        url,
                        statusCode: 503,
                        message: "Service Temporarily Unavailable",
                        retryAfter: 1000
                      }))
                    : Effect.fail(new TimeoutError({
                        operation: `fetch ${url}`,
                        timeoutMs: options?.timeout ? Duration.toMillis(options.timeout) : 5000,
                        elapsed: 6000
                      }))
                )
              )
            }

            // 成功レスポンスをシミュレート
            return pipe(
              Effect.sync(() => {
                if (url.includes("/player/")) {
                  return { id: "test-player", name: "TestPlayer" } as T
                }
                if (url.includes("/world/")) {
                  return {
                    id: "test-world",
                    name: "TestWorld",
                    seed: BigInt(12345),
                    players: ["player1", "player2"],
                    chunks: 100
                  } as T
                }
                return {} as T
              }),
              Effect.delay(Duration.millis(100)) // ネットワーク遅延をシミュレート
            )
          })
        ),

      upload: (url: string, data: Uint8Array): Effect.Effect<UploadResponse, NetworkError> =>
        Effect.gen(function* () {
          const config = yield* Ref.get(failureConfig)

          if (config.shouldFail && config.failureCount < config.maxFailures) {
            yield* Ref.update(failureConfig, cfg => ({ ...cfg, failureCount: cfg.failureCount + 1 }))
            return yield* Effect.fail(new NetworkError({
              url,
              statusCode: 413,
              message: "Payload Too Large"
            }))
          }

          return {
            success: true,
            bytesTransferred: data.length,
            url
          }
        }),

      healthCheck: (): Effect.Effect<boolean, NetworkError> =>
        pipe(
          Ref.get(failureConfig),
          Effect.map(config => !config.shouldFail || config.failureCount >= config.maxFailures)
        )
    }
  })
)

// APIサービス実装（リトライ戦略付き）
const TestApiServiceLive = Layer.effect(
  ApiService,
  Effect.gen(function* () {
    const network = yield* NetworkService

    const retrySchedule = pipe(
      Schedule.exponential(Duration.millis(100)),
      Schedule.intersect(Schedule.recurs(3)),
      Schedule.whileInput((error: NetworkError | TimeoutError) =>
        error._tag === "NetworkError" && [502, 503, 504].includes(error.statusCode)
      )
    )

    return {
      fetchPlayerData: (playerId: string): Effect.Effect<Player, NetworkError | ValidationError> =>
        pipe(
          network.fetch<any>(`/api/player/${playerId}`),
          Effect.flatMap(data =>
            pipe(
              Schema.decodeUnknown(PlayerSchema)(data),
              Effect.mapError(error => new ValidationError({
                field: "player",
                expected: "Player",
                received: data,
                path: []
              }))
            )
          )
        ),

      fetchWorldData: (worldId: string): Effect.Effect<WorldData, NetworkError | TimeoutError> =>
        network.fetch<WorldData>(`/api/world/${worldId}`, {
          timeout: Duration.seconds(5)
        }),

      retryableFetch: <T>(operation: Effect.Effect<T, NetworkError>): Effect.Effect<T, NetworkError> =>
        pipe(
          operation,
          Effect.retry(retrySchedule)
        )
    }
  })
)

// エラージェネレーター
const networkErrorArbitrary = fc.record({
  url: fc.webUrl(),
  statusCode: fc.integer({ min: 400, max: 599 }),
  message: fc.string(),
  retryAfter: fc.option(fc.nat()),
  headers: fc.option(fc.dictionary(fc.string(), fc.string()))
})

const timeoutErrorArbitrary = fc.record({
  operation: fc.string(),
  timeoutMs: fc.integer({ min: 1000, max: 10000 }),
  elapsed: fc.integer({ min: 5000, max: 15000 })
})

// テスト実装
layer(Layer.provide(TestApiServiceLive, TestNetworkServiceLive))("Error Handling Patterns", (it) => {
  it.effect("should handle network errors with proper error types", () =>
    Effect.gen(function* () {
      const apiService = yield* ApiService
      const networkService = yield* NetworkService

      // ネットワークエラーを強制的に発生させる設定
      const failureConfig = { shouldFail: true, failureType: "network" as const, failureCount: 0, maxFailures: 1 }

      const result = yield* Effect.either(
        apiService.fetchPlayerData("test-player")
      )

      return pipe(
        result,
        Either.match({
          onLeft: (error) => pipe(
            Match.value(error),
            Match.when(
              (err): err is NetworkError => err._tag === "NetworkError",
              (netError) => netError.statusCode === 503
                ? Effect.void
                : Effect.fail(`Unexpected status code: ${netError.statusCode}`)
            ),
            Match.orElse(() => Effect.fail("Expected NetworkError"))
          ),
          onRight: () => Effect.fail("Expected error but got success")
        })
      )
    })
  )

  it.prop("retry logic respects exponential backoff", [fc.nat({ max: 5 })], (maxRetries) =>
    Effect.gen(function* () {
      const apiService = yield* ApiService
      const startTime = yield* Effect.sync(() => Date.now())
      const attempts = yield* Ref.make(0)

      const flakyOperation = pipe(
        Ref.updateAndGet(attempts, n => n + 1),
        Effect.flatMap(attempt =>
          attempt <= maxRetries
            ? Effect.fail(new NetworkError({
                url: "test-url",
                statusCode: 503,
                message: "Service Unavailable"
              }))
            : Effect.succeed("success")
        )
      )

      const result = yield* Effect.either(
        apiService.retryableFetch(flakyOperation)
      )

      const endTime = yield* Effect.sync(() => Date.now())
      const duration = endTime - startTime
      const finalAttempts = yield* Ref.get(attempts)

      return pipe(
        Match.value([result, finalAttempts]),
        Match.when(
          ([res, attmpts]) => Either.isRight(res) && attmpts === maxRetries + 1,
          () => duration >= (maxRetries * 100) // 最低限の遅延時間確認
            ? Effect.void
            : Effect.fail("Retry timing too fast")
        ),
        Match.orElse(() => Effect.fail("Retry pattern failed"))
      )
    })
  )

  it.effect("should accumulate and categorize multiple error types", () =>
    Effect.gen(function* () {
      const apiService = yield* ApiService

      const operations = [
        Effect.fail(new NetworkError({ url: "url1", statusCode: 404, message: "Not Found" })),
        Effect.fail(new TimeoutError({ operation: "op1", timeoutMs: 5000, elapsed: 6000 })),
        Effect.fail(new ValidationError({ field: "name", expected: "string", received: 123, path: ["player", "name"] })),
        Effect.succeed("success")
      ]

      const results = yield* Effect.all(
        operations.map(op => Effect.either(op))
      )

      const errors = results.filter(Either.isLeft).map(result => result.left)
      const successes = results.filter(Either.isRight).map(result => result.right)

      const errorsByType = {
        network: errors.filter((err): err is NetworkError => err._tag === "NetworkError"),
        timeout: errors.filter((err): err is TimeoutError => err._tag === "TimeoutError"),
        validation: errors.filter((err): err is ValidationError => err._tag === "ValidationError")
      }

      return pipe(
        Match.value(errorsByType),
        Match.when(
          (errors) => errors.network.length === 1 &&
                     errors.timeout.length === 1 &&
                     errors.validation.length === 1 &&
                     successes.length === 1,
          () => Effect.void
        ),
        Match.orElse(() => Effect.fail("Error categorization failed"))
      )
    })
  )

  it.prop("error recovery strategies based on error type", [networkErrorArbitrary], (errorProps) =>
    Effect.gen(function* () {
      const networkError = new NetworkError(errorProps)

      const recoveryStrategy = pipe(
        Match.value(networkError),
        Match.when(
          (err) => err.statusCode >= 500 && err.statusCode < 600,
          () => "retry" as const
        ),
        Match.when(
          (err) => err.statusCode === 429,
          () => "backoff" as const
        ),
        Match.when(
          (err) => err.statusCode >= 400 && err.statusCode < 500,
          () => "fail-fast" as const
        ),
        Match.orElse(() => "unknown" as const)
      )

      const shouldRetry = recoveryStrategy === "retry"
      const shouldBackoff = recoveryStrategy === "backoff"
      const shouldFailFast = recoveryStrategy === "fail-fast"

      // 戦略に基づく検証
      if (networkError.statusCode >= 500 && !shouldRetry) {
        return yield* Effect.fail("5xx errors should retry")
      }
      if (networkError.statusCode === 429 && !shouldBackoff) {
        return yield* Effect.fail("429 errors should backoff")
      }
      if (networkError.statusCode >= 400 && networkError.statusCode < 500 && networkError.statusCode !== 429 && !shouldFailFast) {
        return yield* Effect.fail("4xx errors (except 429) should fail fast")
      }
    })
  )

  it.effect("timeout errors contain accurate timing information", () =>
    Effect.gen(function* () {
      const networkService = yield* NetworkService
      const startTime = yield* Effect.sync(() => Date.now())

      const timeoutOperation = pipe(
        networkService.fetch("/slow-endpoint", { timeout: Duration.millis(1000) }),
        Effect.either
      )

      const result = yield* timeoutOperation
      const endTime = yield* Effect.sync(() => Date.now())
      const actualDuration = endTime - startTime

      return pipe(
        result,
        Either.match({
          onLeft: (error) => pipe(
            Match.value(error),
            Match.when(
              (err): err is TimeoutError => err._tag === "TimeoutError",
              (timeoutErr) => {
                const timingAccurate = Math.abs(timeoutErr.elapsed - actualDuration) < 100
                return timingAccurate
                  ? Effect.void
                  : Effect.fail("Timeout timing inaccurate")
              }
            ),
            Match.orElse(() => Effect.fail("Expected TimeoutError"))
          ),
          onRight: () => Effect.fail("Expected timeout but operation succeeded")
        })
      )
    })
  )
})
```

## Pattern 6: Concurrent Testing with Resource Contention

**使用場面**: 高度な並行処理と競合状態の検証

**実装**:
```typescript
import { Semaphore, Queue, STM, TRef } from "effect"
import { layer } from "@effect/vitest"
import * as fc from "fast-check"

// リソース管理サービス定義
export interface ResourcePool {
  readonly acquire: (resourceId: string) => Effect.Effect<Resource, ResourceError>
  readonly release: (resourceId: string, resource: Resource) => Effect.Effect<void>
  readonly getStats: () => Effect.Effect<PoolStats>
}

export const ResourcePool = Context.GenericTag<ResourcePool>("@minecraft/ResourcePool")

type Resource = {
  id: string
  type: "chunk" | "player" | "world"
  data: unknown
  acquiredAt: number
  lastAccessed: number
}

type PoolStats = {
  totalResources: number
  acquiredResources: number
  waitingRequests: number
  averageWaitTime: number
}

const ResourceErrorSchema = Schema.TaggedError("ResourceError", {
  resourceId: Schema.String,
  reason: Schema.Literal("not_found", "timeout", "exhausted", "corrupted"),
  metadata: Schema.Record(Schema.String, Schema.Unknown)
})

class ResourceError extends Schema.TaggedError(ResourceErrorSchema)("ResourceError") {}

// セマフォベースのリソースプール実装
const TestResourcePoolLive = Layer.effect(
  ResourcePool,
  Effect.gen(function* () {
    const maxResources = 10
    const semaphore = yield* Semaphore.make(maxResources)
    const resources = yield* Ref.make(new Map<string, Resource>())
    const waitTimes = yield* Ref.make<number[]>([])

    return {
      acquire: (resourceId: string): Effect.Effect<Resource, ResourceError> =>
        pipe(
          Effect.sync(() => Date.now()),
          Effect.flatMap(startTime =>
            pipe(
              Semaphore.take(semaphore),
              Effect.timeout(Duration.seconds(5)),
              Effect.flatMap(() =>
                pipe(
                  Effect.sync(() => Date.now()),
                  Effect.flatMap(endTime => {
                    const waitTime = endTime - startTime
                    const resource: Resource = {
                      id: resourceId,
                      type: "chunk",
                      data: { loaded: true },
                      acquiredAt: endTime,
                      lastAccessed: endTime
                    }

                    return pipe(
                      Ref.update(resources, map => new Map(map).set(resourceId, resource)),
                      Effect.zipRight(Ref.update(waitTimes, times => [...times, waitTime])),
                      Effect.as(resource)
                    )
                  })
                )
              ),
              Effect.mapError(() => new ResourceError({
                resourceId,
                reason: "timeout",
                metadata: { maxWaitSeconds: 5 }
              }))
            )
          )
        ),

      release: (resourceId: string, resource: Resource): Effect.Effect<void> =>
        pipe(
          Ref.update(resources, map => {
            const newMap = new Map(map)
            newMap.delete(resourceId)
            return newMap
          }),
          Effect.zipRight(Semaphore.release(semaphore))
        ),

      getStats: (): Effect.Effect<PoolStats> =>
        pipe(
          Effect.all([
            Ref.get(resources),
            Ref.get(waitTimes),
            Semaphore.available(semaphore)
          ]),
          Effect.map(([resourceMap, times, available]) => ({
            totalResources: maxResources,
            acquiredResources: resourceMap.size,
            waitingRequests: maxResources - available - resourceMap.size,
            averageWaitTime: times.length > 0 ? times.reduce((a, b) => a + b) / times.length : 0
          }))
        )
    }
  })
)

// 並行チャンクローダー
export interface ChunkLoader {
  readonly loadChunks: (coordinates: readonly ChunkCoordinate[]) => Effect.Effect<Chunk[]>
  readonly loadChunksConcurrently: (
    coordinates: readonly ChunkCoordinate[],
    concurrency: number
  ) => Effect.Effect<Chunk[]>
}

export const ChunkLoader = Context.GenericTag<ChunkLoader>("@minecraft/ChunkLoader")

const TestChunkLoaderLive = Layer.effect(
  ChunkLoader,
  Effect.gen(function* () {
    const resourcePool = yield* ResourcePool
    const cache = yield* Ref.make(new Map<string, Chunk>())

    return {
      loadChunks: (coordinates: readonly ChunkCoordinate[]): Effect.Effect<Chunk[]> =>
        Effect.all(
          coordinates.map(coord => {
            const cacheKey = `${coord.x}_${coord.z}`

            return pipe(
              Ref.get(cache),
              Effect.flatMap(cacheMap => {
                const cachedChunk = cacheMap.get(cacheKey)
                if (cachedChunk) {
                  return Effect.succeed(cachedChunk)
                }

                return pipe(
                  resourcePool.acquire(cacheKey),
                  Effect.flatMap(resource => {
                    const chunk: Chunk = {
                      id: cacheKey as any,
                      coordinate: coord,
                      blocks: [],
                      entities: [],
                      version: 1
                    }

                    return pipe(
                      Ref.update(cache, map => new Map(map).set(cacheKey, chunk)),
                      Effect.zipRight(resourcePool.release(cacheKey, resource)),
                      Effect.as(chunk)
                    )
                  })
                )
              })
            )
          })
        ),

      loadChunksConcurrently: (
        coordinates: readonly ChunkCoordinate[],
        concurrency: number
      ): Effect.Effect<Chunk[]> =>
        Effect.all(
          coordinates.map(coord => {
            const cacheKey = `${coord.x}_${coord.z}`
            return pipe(
              Effect.sleep(Duration.millis(Math.random() * 100)), // ランダム遅延でレースコンディションを誘発
              Effect.zipRight(resourcePool.acquire(cacheKey)),
              Effect.flatMap(resource => {
                const chunk: Chunk = {
                  id: cacheKey as any,
                  coordinate: coord,
                  blocks: [],
                  entities: [],
                  version: 1
                }

                return pipe(
                  resourcePool.release(cacheKey, resource),
                  Effect.as(chunk)
                )
              })
            )
          }),
          { concurrency }
        )
    }
  })
)

// STMベースのカウンター（アトミック操作）
const createAtomicCounter = (): Effect.Effect<{
  increment: () => STM.STM<number>
  decrement: () => STM.STM<number>
  getValue: () => STM.STM<number>
  reset: () => STM.STM<void>
}> =>
  pipe(
    STM.make(0),
    STM.map(tref => ({
      increment: () => STM.updateAndGet(tref, n => n + 1),
      decrement: () => STM.updateAndGet(tref, n => n - 1),
      getValue: () => STM.get(tref),
      reset: () => STM.set(tref, 0)
    })),
    STM.commit
  )

// プロパティベーステスト用ジェネレーター
const coordinatesArbitrary = fc.array(
  fc.record({
    x: fc.integer({ min: -100, max: 100 }),
    z: fc.integer({ min: -100, max: 100 })
  }),
  { minLength: 5, maxLength: 50 }
)

const concurrencyArbitrary = fc.integer({ min: 1, max: 20 })

// テスト実装
layer(Layer.provide(TestChunkLoaderLive, TestResourcePoolLive))("Concurrent Testing", (it) => {
  it.effect("should handle resource contention without deadlocks", () =>
    Effect.gen(function* () {
      const resourcePool = yield* ResourcePool
      const chunkLoader = yield* ChunkLoader

      const coordinates: ChunkCoordinate[] = Array.from({ length: 20 }, (_, i) => ({
        x: Math.floor(i / 5),
        z: i % 5
      }))

      // 複数の並行ローダー
      const loaders = Array.from({ length: 5 }, () =>
        chunkLoader.loadChunksConcurrently(coordinates, 10)
      )

      const startTime = yield* Effect.sync(() => Date.now())
      const results = yield* Effect.all(loaders, { concurrency: "unbounded" })
      const endTime = yield* Effect.sync(() => Date.now())

      const stats = yield* resourcePool.getStats()

      return pipe(
        Match.value([results, stats, endTime - startTime]),
        Match.when(
          ([res, stat, duration]) =>
            res.every(chunks => chunks.length === coordinates.length) &&
            stat.acquiredResources === 0 && // 全リソース解放済み
            duration < 10000, // 10秒以内に完了
          () => Effect.void
        ),
        Match.orElse(() => Effect.fail("Resource contention test failed"))
      )
    })
  )

  it.prop("concurrent operations maintain data integrity", [coordinatesArbitrary, concurrencyArbitrary], (coordinates, concurrency) =>
    Effect.gen(function* () {
      const chunkLoader = yield* ChunkLoader
      const counter = yield* createAtomicCounter()

      // 各チャンクローダーが完了時にカウンターを更新
      const trackingLoaders = coordinates.map(coord =>
        pipe(
          chunkLoader.loadChunks([coord]),
          Effect.flatMap(() => STM.commit(counter.increment()))
        )
      )

      yield* Effect.all(trackingLoaders, { concurrency })

      const finalCount = yield* STM.commit(counter.getValue())

      if (finalCount !== coordinates.length) {
        return yield* Effect.fail(`Counter mismatch: expected ${coordinates.length}, got ${finalCount}`)
      }
    })
  )

  it.effect("should detect race conditions in concurrent updates", () =>
    Effect.gen(function* () {
      const sharedState = yield* Ref.make({ counter: 0, operations: [] as string[] })
      const operationCount = 100

      // レースコンディションを意図的に引き起こす操作
      const racyOperations = Array.from({ length: operationCount }, (_, i) =>
        pipe(
          Ref.get(sharedState),
          Effect.flatMap(state =>
            pipe(
              Effect.sleep(Duration.millis(Math.random() * 5)), // ランダム遅延
              Effect.zipRight(
                Ref.set(sharedState, {
                  counter: state.counter + 1,
                  operations: [...state.operations, `op-${i}`]
                })
              )
            )
          )
        )
      )

      yield* Effect.all(racyOperations, { concurrency: "unbounded" })

      const finalState = yield* Ref.get(sharedState)

      // レースコンディションにより、期待値と異なる可能性がある
      const hasRaceCondition =
        finalState.counter !== operationCount ||
        finalState.operations.length !== operationCount

      if (!hasRaceCondition) {
        return yield* Effect.fail("Expected race condition was not detected")
      }

      // STMを使った安全な実装で比較
      const atomicCounter = yield* createAtomicCounter()
      const atomicOperations = Array.from({ length: operationCount }, () =>
        STM.commit(atomicCounter.increment())
      )

      yield* Effect.all(atomicOperations, { concurrency: "unbounded" })
      const atomicResult = yield* STM.commit(atomicCounter.getValue())

      if (atomicResult !== operationCount) {
        return yield* Effect.fail("STM operations should be atomic")
      }
    })
  )

  it.effect("should handle queue-based concurrent processing", () =>
    Effect.gen(function* () {
      const queue = yield* Queue.bounded<ChunkCoordinate>(50)
      const results = yield* Ref.make<Chunk[]>([])

      // プロデューサー: チャンク座標をキューに追加
      const producer = pipe(
        Effect.iterate(0, {
          while: n => n < 30,
          body: n => pipe(
            Queue.offer(queue, { x: Math.floor(n / 10), z: n % 10 }),
            Effect.as(n + 1)
          )
        }),
        Effect.zipRight(Queue.shutdown(queue))
      )

      // コンシューマー: キューからチャンクを処理
      const consumer = (id: number) =>
        pipe(
          Queue.take(queue),
          Effect.flatMap(coord => {
            const chunk: Chunk = {
              id: `${coord.x}_${coord.z}` as any,
              coordinate: coord,
              blocks: [],
              entities: [],
              version: 1
            }

            return pipe(
              Ref.update(results, chunks => [...chunks, chunk]),
              Effect.as(chunk)
            )
          }),
          Effect.forever,
          Effect.catchSomeDefect(defect =>
            defect._tag === "InterruptedException" ? Option.some(Effect.void) : Option.none()
          ),
          Effect.scoped
        )

      // 3つのコンシューマーを並行実行
      const consumers = [consumer(1), consumer(2), consumer(3)]

      const producerFiber = yield* Effect.fork(producer)
      const consumerFibers = yield* Effect.all(
        consumers.map(Effect.fork)
      )

      yield* Fiber.await(producerFiber)
      yield* Effect.all(consumerFibers.map(Fiber.interrupt))

      const processedChunks = yield* Ref.get(results)

      if (processedChunks.length !== 30) {
        return yield* Effect.fail(`Expected 30 chunks, processed ${processedChunks.length}`)
      }

      // 重複処理がないことを確認
      const uniqueChunks = new Set(processedChunks.map(chunk => chunk.id))
      if (uniqueChunks.size !== processedChunks.length) {
        return yield* Effect.fail("Duplicate chunk processing detected")
      }
    })
  )

  it.effect("should measure concurrent performance characteristics", () =>
    Effect.gen(function* () {
      const chunkLoader = yield* ChunkLoader
      const resourcePool = yield* ResourcePool

      const testSizes = [1, 5, 10, 25, 50]
      const concurrencyLevels = [1, 5, 10, 20]

      const performanceMetrics = yield* Effect.all(
        testSizes.flatMap(size =>
          concurrencyLevels.map(concurrency =>
            pipe(
              Effect.sync(() => Date.now()),
              Effect.flatMap(startTime =>
                pipe(
                  chunkLoader.loadChunksConcurrently(
                    Array.from({ length: size }, (_, i) => ({ x: i, z: 0 })),
                    concurrency
                  ),
                  Effect.flatMap(() => Effect.sync(() => Date.now())),
                  Effect.map(endTime => ({
                    size,
                    concurrency,
                    duration: endTime - startTime,
                    throughput: size / ((endTime - startTime) / 1000)
                  }))
                )
              )
            )
          )
        )
      )

      // パフォーマンス回帰チェック
      const maxThroughput = Math.max(...performanceMetrics.map(m => m.throughput))
      const avgDuration = performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / performanceMetrics.length

      if (maxThroughput < 5) { // 最低5chunks/sec
        return yield* Effect.fail(`Low throughput: ${maxThroughput} chunks/sec`)
      }

      if (avgDuration > 5000) { // 平均5秒以内
        return yield* Effect.fail(`High average duration: ${avgDuration}ms`)
      }

      const finalStats = yield* resourcePool.getStats()
      if (finalStats.acquiredResources > 0) {
        return yield* Effect.fail("Resource leak detected")
      }
    })
  )
})
```

## Pattern 7: Test Utilities with Schema-Based Factories

**使用場面**: 型安全なテストヘルパー関数とファクトリー

**実装**:
```typescript
import { Gen, Random } from "effect"
import { it } from "@effect/vitest"
import * as fc from "fast-check"

// スキーマベースファクトリー
export const TestFactories = {
  // スキーマを使った安全なファクトリー
  createChunk: (overrides: Partial<Chunk> = {}): Effect.Effect<Chunk> =>
    pipe(
      Gen.struct({
        id: Gen.string,
        coordinate: Gen.struct({
          x: Gen.int({ min: -1000, max: 1000 }),
          z: Gen.int({ min: -1000, max: 1000 })
        }),
        blocks: Gen.array(Gen.struct({
          position: Gen.struct({
            x: Gen.int({ min: 0, max: 15 }),
            y: Gen.int({ min: 0, max: 255 }),
            z: Gen.int({ min: 0, max: 15 })
          }),
          material: Gen.oneOf(
            Gen.constant("stone" as const),
            Gen.constant("dirt" as const),
            Gen.constant("grass" as const)
          ),
          biome: Gen.struct({
            id: Gen.string.pipe(Gen.map(s => s as BiomeId)),
            name: Gen.string,
            temperature: Gen.number({ min: -2, max: 2 }),
            humidity: Gen.number({ min: 0, max: 1 }),
            supportedMaterials: Gen.array(Gen.int().pipe(Gen.map(n => n as MaterialId)))
          }),
          metadata: Gen.record(Gen.string, Gen.oneOf(Gen.string, Gen.number, Gen.boolean))
        }), { maxLength: 50 }),
        entities: Gen.array(Gen.string, { maxLength: 10 }),
        version: Gen.int({ min: 1, max: 10 })
      }),
      Effect.map(generated => ({ ...generated, ...overrides }))
    ),

  createPlayer: (overrides: Partial<Player> = {}): Effect.Effect<Player> =>
    pipe(
      Gen.struct({
        id: Gen.string.pipe(Gen.map(s => s as PlayerId)),
        name: Gen.string.pipe(Gen.minLength(1), Gen.maxLength(16)),
        position: Gen.struct({
          x: Gen.number({ min: -30000000, max: 30000000 }),
          y: Gen.number({ min: 0, max: 255 }),
          z: Gen.number({ min: -30000000, max: 30000000 })
        }),
        health: Gen.int({ min: 0, max: 20 }),
        inventory: Gen.array(Gen.string.pipe(Gen.map(s => s as InventoryId)), { maxLength: 36 }),
        lastLogin: Gen.date,
        experience: Gen.int({ min: 0, max: 1000000 }),
        gameMode: Gen.oneOf(
          Gen.constant("survival" as const),
          Gen.constant("creative" as const),
          Gen.constant("adventure" as const),
          Gen.constant("spectator" as const)
        )
      }),
      Effect.map(generated => ({ ...generated, ...overrides }))
    ),

  // Fast-Check統合ファクトリー
  createRandomChunks: (count: number): Effect.Effect<Chunk[]> =>
    Effect.sync(() => fc.sample(chunkArbitrary, count)),

  createRandomPlayers: (count: number): Effect.Effect<Player[]> =>
    Effect.sync(() => fc.sample(playerArbitrary, count)),

  // 特定条件のファクトリー
  createEmptyChunk: (coordinate: ChunkCoordinate): Effect.Effect<Chunk> =>
    TestFactories.createChunk({
      coordinate,
      blocks: [],
      entities: []
    }),

  createPlayerWithInventory: (items: InventoryId[]): Effect.Effect<Player> =>
    TestFactories.createPlayer({ inventory: items }),

  createDamagedPlayer: (health: number): Effect.Effect<Player> =>
    TestFactories.createPlayer({ health: Math.max(0, Math.min(20, health)) })
}

// Effect-TSネイティブなアサーション
export const TestAssertions = {
  expectChunkValid: (chunk: Chunk): Effect.Effect<void> =>
    pipe(
      Schema.decodeUnknown(ChunkSchema)(chunk),
      Effect.mapError(() => "Invalid chunk schema"),
      Effect.asVoid
    ),

  expectPlayerValid: (player: Player): Effect.Effect<void> =>
    pipe(
      Schema.decodeUnknown(PlayerSchema)(player),
      Effect.mapError(() => "Invalid player schema"),
      Effect.asVoid
    ),

  expectErrorMatches: <E>(
    result: Either.Either<unknown, E>,
    predicate: (error: E) => boolean
  ): Effect.Effect<void> =>
    pipe(
      Match.value(result),
      Match.when(Either.isLeft, ({ left }) =>
        predicate(left)
          ? Effect.void
          : Effect.fail("Error doesn't match predicate")
      ),
      Match.orElse(() => Effect.fail("Expected error but got success"))
    ),

  expectArrayEqual: <T>(
    actual: readonly T[],
    expected: readonly T[],
    compareFn?: (a: T, b: T) => boolean
  ): Effect.Effect<void> => {
    if (actual.length !== expected.length) {
      return Effect.fail(`Array length mismatch: ${actual.length} vs ${expected.length}`)
    }

    const compare = compareFn || ((a, b) => a === b)
    const mismatches = actual.filter((item, index) => !compare(item, expected[index]))

    return mismatches.length === 0
      ? Effect.void
      : Effect.fail(`Array content mismatch at ${mismatches.length} positions`)
  },

  expectEffectualValue: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    predicate: (value: A) => boolean | Effect.Effect<boolean, unknown, unknown>
  ): Effect.Effect<void, E, R> =>
    pipe(
      effect,
      Effect.flatMap(value =>
        typeof predicate === "function"
          ? pipe(
              predicate(value),
              Effect.flatMap(result =>
                result
                  ? Effect.void
                  : Effect.fail("Predicate failed" as E)
              )
            )
          : predicate(value)
            ? Effect.void
            : Effect.fail("Predicate failed" as E)
      )
    )
}

// 高度なテストセットアップユーティリティ
export const TestSetup = {
  withIsolatedEnvironment: <R, E, A>(
    setup: Effect.Effect<void, E>,
    teardown: Effect.Effect<void, E>,
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R> =>
    pipe(
      Effect.acquireUseRelease(
        setup,
        () => effect,
        () => teardown
      )
    ),

  withTestData: <T>(
    dataGenerator: Effect.Effect<T>,
    test: (data: T) => Effect.Effect<void>
  ): Effect.Effect<void> =>
    pipe(
      dataGenerator,
      Effect.flatMap(test)
    ),

  withConcurrentTest: <A>(
    operations: Effect.Effect<A>[],
    concurrency: number,
    validator: (results: A[]) => Effect.Effect<void>
  ): Effect.Effect<void> =>
    pipe(
      Effect.all(operations, { concurrency }),
      Effect.flatMap(validator)
    ),

  withPerformanceMeasurement: <A, E, R>(
    operation: Effect.Effect<A, E, R>,
    thresholds: {
      maxDuration?: Duration.Duration
      minThroughput?: number
    }
  ): Effect.Effect<{ result: A; metrics: PerformanceMetrics }, E, R> =>
    pipe(
      Effect.sync(() => performance.now()),
      Effect.flatMap(startTime =>
        pipe(
          operation,
          Effect.flatMap(result =>
            pipe(
              Effect.sync(() => performance.now()),
              Effect.map(endTime => {
                const duration = endTime - startTime
                const metrics: PerformanceMetrics = {
                  duration,
                  startTime,
                  endTime
                }

                if (thresholds.maxDuration && duration > Duration.toMillis(thresholds.maxDuration)) {
                  throw new Error(`Operation took too long: ${duration}ms`)
                }

                return { result, metrics }
              })
            )
          )
        )
      )
    ),

  withRetryableTest: <A, E, R>(
    operation: Effect.Effect<A, E, R>,
    maxAttempts: number = 3
  ): Effect.Effect<A, E, R> =>
    pipe(
      operation,
      Effect.retry(Schedule.recurs(maxAttempts - 1))
    )
}

type PerformanceMetrics = {
  duration: number
  startTime: number
  endTime: number
}

// テスト環境バリデーター
export const TestValidators = {
  validateTestEnvironment: (): Effect.Effect<void> =>
    Effect.gen(function* () {
      // メモリ使用量チェック
      const memoryUsage = process.memoryUsage()
      if (memoryUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
        yield* Effect.logWarning("High memory usage detected in test environment")
      }

      // ファイルシステムアクセスチェック
      yield* Effect.sync(() => {
        if (!process.env.NODE_ENV || process.env.NODE_ENV !== "test") {
          throw new Error("Tests should run in NODE_ENV=test")
        }
      })
    }),

  validateNoResourceLeaks: (
    initialStats: ResourceStats,
    finalStats: ResourceStats
  ): Effect.Effect<void> =>
    pipe(
      Match.value([initialStats, finalStats]),
      Match.when(
        ([initial, final]) =>
          final.openConnections === initial.openConnections &&
          final.allocatedMemory <= initial.allocatedMemory * 1.1, // 10%の増加は許容
        () => Effect.void
      ),
      Match.orElse(() => Effect.fail("Resource leak detected"))
    )
}

type ResourceStats = {
  openConnections: number
  allocatedMemory: number
  activeTimers: number
}

// 使用例
describe("Advanced Test Utilities", () => {
  it.effect("should demonstrate comprehensive testing utilities", () =>
    TestSetup.withIsolatedEnvironment(
      TestValidators.validateTestEnvironment(),
      Effect.void,
      TestSetup.withTestData(
        TestFactories.createRandomChunks(10),
        (chunks) =>
          TestSetup.withPerformanceMeasurement(
            Effect.all(chunks.map(TestAssertions.expectChunkValid)),
            { maxDuration: Duration.seconds(1) }
          ).pipe(
            Effect.flatMap(({ result, metrics }) =>
              Effect.gen(function* () {
                yield* Effect.logInfo(`Validation completed in ${metrics.duration}ms`)

                return yield* TestAssertions.expectArrayEqual(
                  result,
                  Array(chunks.length).fill(undefined),
                  () => true // すべてのバリデーションが成功
                )
              })
            )
          )
      )
    )
  )

  it.prop("property-based testing with utilities", [fc.array(chunkArbitrary, { minLength: 1, maxLength: 20 })], (chunks) =>
    TestSetup.withConcurrentTest(
      chunks.map(chunk => TestAssertions.expectChunkValid(chunk)),
      5, // 並行度5
      (results) =>
        TestAssertions.expectArrayEqual(
          results,
          Array(chunks.length).fill(undefined)
        )
    )
  )

  it.effect("should handle flaky operations with retry", () =>
    TestSetup.withRetryableTest(
      Effect.gen(function* () {
        const randomFailure = yield* Random.nextBoolean
        if (randomFailure) {
          return yield* Effect.fail("Random failure for retry test")
        }
        return "success"
      }),
      5
    ).pipe(
      Effect.flatMap(result =>
        result === "success"
          ? Effect.void
          : Effect.fail("Retry test failed")
      )
    )
  )
})
```

## Pattern 8: Performance Testing with Statistical Analysis

**使用場面**: パフォーマンス回帰の検出と統計的分析

**実装**:
```typescript
import { Metric, MetricLabel } from "effect"
import { layer } from "@effect/vitest"
import * as fc from "fast-check"

// パフォーマンスメトリクス定義
const ChunkLoadDuration = Metric.histogram({
  name: "chunk_load_duration",
  description: "Time taken to load chunks",
  boundaries: [10, 50, 100, 500, 1000, 5000]
})

const ThroughputMetric = Metric.gauge({
  name: "chunk_throughput",
  description: "Chunks processed per second"
})

const ConcurrentOperationsCounter = Metric.counter({
  name: "concurrent_operations",
  description: "Number of concurrent operations"
})

// パフォーマンステストサービス
export interface PerformanceTestService {
  readonly measureChunkLoading: (
    chunkCount: number,
    concurrency: number
  ) => Effect.Effect<PerformanceReport>
  readonly benchmarkOperations: <A>(
    operations: Effect.Effect<A>[],
    baseline: number
  ) => Effect.Effect<BenchmarkResult<A>>
  readonly detectPerformanceRegression: (
    currentMetrics: PerformanceMetrics,
    historicalBaseline: PerformanceMetrics
  ) => Effect.Effect<RegressionReport>
}

export const PerformanceTestService = Context.GenericTag<PerformanceTestService>("@minecraft/PerformanceTestService")

type PerformanceReport = {
  totalDuration: number
  averageDuration: number
  throughput: number
  concurrency: number
  percentiles: {
    p50: number
    p95: number
    p99: number
  }
  memoryUsage: {
    initial: number
    peak: number
    final: number
  }
}

type BenchmarkResult<A> = {
  results: A[]
  stats: {
    mean: number
    median: number
    stddev: number
    min: number
    max: number
  }
  comparison: {
    fasterThanBaseline: boolean
    improvementPercent: number
  }
}

type RegressionReport = {
  hasRegression: boolean
  degradedMetrics: string[]
  improvements: string[]
  summary: string
}

// テスト用実装
const TestPerformanceServiceLive = Layer.effect(
  PerformanceTestService,
  Effect.gen(function* () {
    const chunkLoader = yield* ChunkLoader

    return {
      measureChunkLoading: (chunkCount: number, concurrency: number): Effect.Effect<PerformanceReport> =>
        Effect.gen(function* () {
          const coordinates = Array.from({ length: chunkCount }, (_, i) => ({
            x: Math.floor(i / 10),
            z: i % 10
          }))

          const initialMemory = process.memoryUsage().heapUsed
          let peakMemory = initialMemory

          const durations: number[] = []

          const startTime = yield* Effect.sync(() => performance.now())

          // 各チャンク読み込みの個別計測
          const operations = coordinates.map(coord =>
            pipe(
              Effect.sync(() => performance.now()),
              Effect.flatMap(opStart =>
                pipe(
                  chunkLoader.loadChunks([coord]),
                  Effect.flatMap(() => Effect.sync(() => {
                    const currentMemory = process.memoryUsage().heapUsed
                    peakMemory = Math.max(peakMemory, currentMemory)
                    const duration = performance.now() - opStart
                    durations.push(duration)
                    return duration
                  })),
                  Effect.tap(duration => Metric.increment(ChunkLoadDuration, duration))
                )
              )
            )
          )

          yield* Effect.all(operations, { concurrency })
          yield* Metric.increment(ConcurrentOperationsCounter, concurrency)

          const endTime = yield* Effect.sync(() => performance.now())
          const totalDuration = endTime - startTime
          const finalMemory = process.memoryUsage().heapUsed

          durations.sort((a, b) => a - b)
          const throughput = chunkCount / (totalDuration / 1000)

          yield* Metric.set(ThroughputMetric, throughput)

          return {
            totalDuration,
            averageDuration: durations.reduce((a, b) => a + b) / durations.length,
            throughput,
            concurrency,
            percentiles: {
              p50: durations[Math.floor(durations.length * 0.5)],
              p95: durations[Math.floor(durations.length * 0.95)],
              p99: durations[Math.floor(durations.length * 0.99)]
            },
            memoryUsage: {
              initial: initialMemory,
              peak: peakMemory,
              final: finalMemory
            }
          }
        }),

      benchmarkOperations: <A>(
        operations: Effect.Effect<A>[],
        baseline: number
      ): Effect.Effect<BenchmarkResult<A>> =>
        Effect.gen(function* () {
          const durations: number[] = []
          const results: A[] = []

          for (const operation of operations) {
            const start = yield* Effect.sync(() => performance.now())
            const result = yield* operation
            const end = yield* Effect.sync(() => performance.now())

            durations.push(end - start)
            results.push(result)
          }

          durations.sort((a, b) => a - b)

          const mean = durations.reduce((a, b) => a + b) / durations.length
          const median = durations[Math.floor(durations.length / 2)]
          const variance = durations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / durations.length
          const stddev = Math.sqrt(variance)

          const improvementPercent = baseline > 0 ? ((baseline - mean) / baseline) * 100 : 0

          return {
            results,
            stats: {
              mean,
              median,
              stddev,
              min: durations[0],
              max: durations[durations.length - 1]
            },
            comparison: {
              fasterThanBaseline: mean < baseline,
              improvementPercent
            }
          }
        }),

      detectPerformanceRegression: (
        currentMetrics: PerformanceMetrics,
        historicalBaseline: PerformanceMetrics
      ): Effect.Effect<RegressionReport> =>
        Effect.sync(() => {
          const degradedMetrics: string[] = []
          const improvements: string[] = []

          // 許容可能な変動範囲（10%）
          const tolerance = 0.1

          if (currentMetrics.duration > historicalBaseline.duration * (1 + tolerance)) {
            degradedMetrics.push(`Duration increased by ${((currentMetrics.duration / historicalBaseline.duration - 1) * 100).toFixed(1)}%`)
          } else if (currentMetrics.duration < historicalBaseline.duration * (1 - tolerance)) {
            improvements.push(`Duration improved by ${((1 - currentMetrics.duration / historicalBaseline.duration) * 100).toFixed(1)}%`)
          }

          return {
            hasRegression: degradedMetrics.length > 0,
            degradedMetrics,
            improvements,
            summary: degradedMetrics.length > 0
              ? `Performance regression detected: ${degradedMetrics.join(", ")}`
              : improvements.length > 0
                ? `Performance improved: ${improvements.join(", ")}`
                : "Performance stable within tolerance"
          }
        })
    }
  })
)

// プロパティベース負荷テスト用ジェネレーター
const loadTestConfigArbitrary = fc.record({
  chunkCount: fc.integer({ min: 10, max: 500 }),
  concurrency: fc.integer({ min: 1, max: 50 }),
  operationComplexity: fc.constantFrom("simple" as const, "medium" as const, "complex" as const)
})

const performanceThresholdArbitrary = fc.record({
  maxDuration: fc.float({ min: 100, max: 10000 }),
  minThroughput: fc.float({ min: 1, max: 1000 }),
  maxMemoryIncrease: fc.float({ min: 1.1, max: 3.0 })
})

// テスト実装
layer(
  Layer.provide(
    TestPerformanceServiceLive,
    Layer.provide(TestChunkLoaderLive, TestResourcePoolLive)
  )
)("Performance Testing", (it) => {
  it.effect("should maintain consistent performance under various load conditions", () =>
    Effect.gen(function* () {
      const perfService = yield* PerformanceTestService

      const testScenarios = [
        { chunks: 10, concurrency: 1, name: "low-load" },
        { chunks: 50, concurrency: 5, name: "medium-load" },
        { chunks: 100, concurrency: 10, name: "high-load" }
      ]

      const reports = yield* Effect.all(
        testScenarios.map(scenario =>
          pipe(
            perfService.measureChunkLoading(scenario.chunks, scenario.concurrency),
            Effect.map(report => ({ ...report, scenario: scenario.name }))
          )
        )
      )

      // スケーラビリティ検証
      const lowLoadThroughput = reports[0].throughput
      const highLoadThroughput = reports[2].throughput

      // 高負荷でもスループットが50%以下に低下しないことを確認
      if (highLoadThroughput < lowLoadThroughput * 0.5) {
        return yield* Effect.fail(`Poor scalability: throughput dropped from ${lowLoadThroughput} to ${highLoadThroughput}`)
      }

      // メモリ使用量の検証
      for (const report of reports) {
        const memoryGrowth = (report.memoryUsage.peak - report.memoryUsage.initial) / report.memoryUsage.initial
        if (memoryGrowth > 2.0) { // 200%以上の増加は異常
          return yield* Effect.fail(`Excessive memory growth in ${report.scenario}: ${(memoryGrowth * 100).toFixed(1)}%`)
        }
      }

      // レスポンス時間のばらつき検証
      for (const report of reports) {
        const p99Latency = report.percentiles.p99
        const avgLatency = report.averageDuration

        if (p99Latency > avgLatency * 5) { // P99が平均の5倍を超えると不安定
          return yield* Effect.fail(`High latency variance in ${report.scenario}: P99=${p99Latency}ms, Avg=${avgLatency}ms`)
        }
      }
    })
  )

  it.prop("performance remains within bounds across random configurations", [loadTestConfigArbitrary, performanceThresholdArbitrary], (config, thresholds) =>
    Effect.gen(function* () {
      const perfService = yield* PerformanceTestService

      const report = yield* perfService.measureChunkLoading(config.chunkCount, config.concurrency)

      // 動的閾値チェック
      if (report.totalDuration > thresholds.maxDuration) {
        return yield* Effect.fail(`Duration ${report.totalDuration}ms exceeds threshold ${thresholds.maxDuration}ms`)
      }

      if (report.throughput < thresholds.minThroughput) {
        return yield* Effect.fail(`Throughput ${report.throughput} below threshold ${thresholds.minThroughput}`)
      }

      const memoryIncrease = report.memoryUsage.peak / report.memoryUsage.initial
      if (memoryIncrease > thresholds.maxMemoryIncrease) {
        return yield* Effect.fail(`Memory increase ${memoryIncrease}x exceeds threshold ${thresholds.maxMemoryIncrease}x`)
      }
    })
  )

  it.effect("should detect performance regression accurately", () =>
    Effect.gen(function* () {
      const perfService = yield* PerformanceTestService

      const baselineMetrics: PerformanceMetrics = {
        duration: 1000,
        startTime: 0,
        endTime: 1000
      }

      // 回帰テストケース
      const regressionMetrics: PerformanceMetrics = {
        duration: 1200, // 20%増加
        startTime: 0,
        endTime: 1200
      }

      const regressionReport = yield* perfService.detectPerformanceRegression(
        regressionMetrics,
        baselineMetrics
      )

      if (!regressionReport.hasRegression) {
        return yield* Effect.fail("Failed to detect performance regression")
      }

      // 改善テストケース
      const improvedMetrics: PerformanceMetrics = {
        duration: 800, // 20%改善
        startTime: 0,
        endTime: 800
      }

      const improvementReport = yield* perfService.detectPerformanceRegression(
        improvedMetrics,
        baselineMetrics
      )

      if (improvementReport.hasRegression || improvementReport.improvements.length === 0) {
        return yield* Effect.fail("Failed to detect performance improvement")
      }
    })
  )

  it.effect("should handle stress testing with resource monitoring", () =>
    Effect.gen(function* () {
      const perfService = yield* PerformanceTestService
      const resourcePool = yield* ResourcePool

      // ストレステスト: リソースプールの限界まで負荷をかける
      const stressOperations = Array.from({ length: 200 }, (_, i) =>
        Effect.gen(function* () {
          const chunkLoader = yield* ChunkLoader
          return yield* chunkLoader.loadChunksConcurrently([{ x: i, z: 0 }], 1)
        })
      )

      const benchmarkResult = yield* perfService.benchmarkOperations(
        stressOperations,
        100 // 100ms baseline
      )

      const finalStats = yield* resourcePool.getStats()

      // ストレステスト後のリソース状態確認
      if (finalStats.acquiredResources > 0) {
        return yield* Effect.fail("Resource leak detected after stress test")
      }

      // パフォーマンス特性の確認
      if (benchmarkResult.stats.stddev > benchmarkResult.stats.mean * 0.5) {
        return yield* Effect.fail("High performance variance under stress")
      }

      // 極端な遅延の検出
      if (benchmarkResult.stats.max > benchmarkResult.stats.mean * 10) {
        return yield* Effect.fail("Extreme latency outliers detected")
      }
    })
  )

  it.effect("should provide comprehensive performance profiling", () =>
    Effect.gen(function* () {
      const perfService = yield* PerformanceTestService

      // 複数のロードパターンでプロファイリング
      const profiles = yield* Effect.all([
        perfService.measureChunkLoading(20, 1),   // シーケンシャル
        perfService.measureChunkLoading(20, 5),   // 中並行
        perfService.measureChunkLoading(20, 20)   // 高並行
      ])

      const [sequential, medium, high] = profiles

      // 並行性の効果を分析
      const concurrencyGain = sequential.totalDuration / medium.totalDuration
      if (concurrencyGain < 2) {
        yield* Effect.logWarning(`Low concurrency gain: ${concurrencyGain.toFixed(2)}x`)
      }

      // 並行性の限界点を検出
      const highConcurrencyEfficiency = high.throughput / (high.concurrency / medium.concurrency) / medium.throughput
      if (highConcurrencyEfficiency < 0.8) {
        yield* Effect.logWarning(`Concurrency saturation detected at level ${high.concurrency}`)
      }

      // メモリ効率の分析
      const memoryEfficiencyScores = profiles.map(profile => {
        const memoryPerChunk = (profile.memoryUsage.peak - profile.memoryUsage.initial) / 20
        const timePerChunk = profile.averageDuration
        return memoryPerChunk / timePerChunk // メモリ/時間効率
      })

      const bestEfficiency = Math.min(...memoryEfficiencyScores)
      const worstEfficiency = Math.max(...memoryEfficiencyScores)

      if (worstEfficiency > bestEfficiency * 3) {
        yield* Effect.logWarning("Significant memory efficiency variance across concurrency levels")
      }

      return yield* Effect.logInfo(`Performance profiling completed: Sequential=${sequential.throughput.toFixed(1)} chunks/s, High concurrency=${high.throughput.toFixed(1)} chunks/s`)
    })
  )
})
```