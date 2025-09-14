---
title: "Effect-TS テスティング実践ガイド"
description: "Effect-TS 3.17+とVitestを使用したTypeScript Minecraftプロジェクトの包括的テスト戦略。Schema-basedバリデーション、Property-Based Testing、高度なテストパターンを実装"
category: "guide"
difficulty: "intermediate"
tags: ["testing", "effect-ts", "vitest", "property-based-testing", "schema-validation", "test-automation"]
prerequisites: ["basic-typescript", "effect-ts-fundamentals", "development-conventions"]
estimated_reading_time: "20分"
related_patterns: ["effect-ts-test-patterns", "service-patterns-catalog", "error-handling-patterns"]
related_docs: ["./00-development-conventions.md", "./05-comprehensive-testing-strategy.md"]
---

# Effect-TS テスティング実践ガイド

## 🎯 Problem Statement

大規模なTypeScriptゲームプロジェクトにおけるテストでは以下の課題が発生します：

- **非同期処理の複雑さ**: Effect-TSの非同期パターンのテストが困難
- **型安全性の検証**: 実行時のスキーマバリデーションのテスト不足
- **依存関係の管理**: モックとテスト用サービスの適切な構築が困難
- **統合テストの複雑さ**: 複数レイヤーにまたがるテストの実装が煩雑
- **パフォーマンステスト**: リアルタイムゲームに必要な性能要件の検証

## 🚀 Solution Approach

Effect-TS 3.17+とVitestの統合により、以下を実現：

1. **Schema-first Testing** - 実行時バリデーションの確実なテスト
2. **Layer-based Mocking** - 依存関係の完全な制御
3. **Property-based Testing** - Fast-Checkによる網羅的テスト
4. **Effect-aware Assertions** - 非同期処理の適切な検証
5. **Performance Integration** - パフォーマンス要件の自動テスト

## ⚡ Quick Guide (5分)

### テスト環境セットアップチェックリスト

- [ ] **Vitest + @effect/vitest** - Effect-TS統合テストランナー
- [ ] **Fast-Check** - Property-based testing
- [ ] **Happy-DOM/JSDOM** - DOM環境シミュレーション
- [ ] **テストLayer** - モックサービスの実装
- [ ] **Schema検証** - 実行時バリデーションテスト

### 基本テストパターン

```typescript
// 1. Schema-based バリデーションテスト
const PlayerSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("PlayerId")),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number.pipe(Schema.between(0, 320)),
    z: Schema.Number
  }),
  health: Schema.Number.pipe(Schema.clamp(0, 100))
})

// 2. Effect-aware テストの実行
describe("PlayerService", () => {
  it("should create player with valid data", async () => {
    const program = Effect.gen(function* () {
      const service = yield* PlayerService
      const player = yield* service.create({
        name: "TestPlayer",
        position: { x: 0, y: 64, z: 0 }
      })
      return player
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestPlayerServiceLive))
    )

    expect(result).toMatchObject({
      name: "TestPlayer",
      position: { x: 0, y: 64, z: 0 },
      health: 100
    })
  })
})
```

### エラーハンドリングのテスト

```typescript
// 3. TaggedError のテスト
it("should handle validation errors properly", async () => {
  const program = Effect.gen(function* () {
    const service = yield* PlayerService
    return yield* service.create({ name: "" }) // 無効なデータ
  })

  const exit = await Effect.runPromiseExit(
    program.pipe(Effect.provide(TestPlayerServiceLive))
  )

  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) {
    const error = Exit.unannotate(exit.cause)
    expect(error._tag).toBe("ValidationError")
  }
})
```

## 📋 Detailed Instructions

### Step 1: テスト環境の構築

プロジェクトのテスト環境をセットアップします：

```bash
# 必要なパッケージのインストール
npm install -D vitest @vitest/ui happy-dom
npm install -D @effect/vitest fast-check
npm install -D @types/node
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom', // DOM APIのシミュレーション
    globals: true,           // describe, it, expect をグローバルで使用
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/',
      ]
    },
    // Effect-TSに最適化された設定
    testTimeout: 10000,      // 非同期処理を考慮
    hookTimeout: 10000,
    teardownTimeout: 10000,
  },
  // Import aliasの設定
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@test': new URL('./src/test', import.meta.url).pathname,
    }
  }
})
```

### Step 2: Schema-based テストデータの作成

型安全なテストデータ生成システムを構築：

```typescript
// src/test/fixtures/player-fixtures.ts
import { Schema, Effect } from "effect"

// プレイヤースキーマの定義
const PlayerId = Schema.String.pipe(Schema.brand("PlayerId"))
const Health = Schema.Number.pipe(Schema.clamp(0, 100), Schema.brand("Health"))

const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number.pipe(Schema.between(-64, 320)),
  z: Schema.Number
})

const Player = Schema.Struct({
  id: PlayerId,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
  position: Position,
  health: Health,
  gameMode: Schema.Literal("CREATIVE", "SURVIVAL", "ADVENTURE"),
  inventory: Schema.Array(ItemSchema),
  level: Schema.Number.pipe(Schema.int(), Schema.positive()),
  experience: Schema.Number.pipe(Schema.int(), Schema.nonNegative())
})

export type Player = Schema.Schema.Type<typeof Player>
export type PlayerId = Schema.Schema.Type<typeof PlayerId>
export type Position = Schema.Schema.Type<typeof Position>

// テストデータファクトリー
export const createTestPlayer = (overrides: Partial<Player> = {}): Player => {
  const timestamp = Date.now()
  const basePlayer: Player = {
    id: `test-player-${timestamp}` as PlayerId,
    name: "TestPlayer",
    position: { x: 0, y: 64, z: 0 },
    health: 100 as Health,
    gameMode: "CREATIVE",
    inventory: [],
    level: 1,
    experience: 0,
    ...overrides
  }

  // Schemaバリデーションを実行
  const result = Schema.decodeUnknownSync(Player)(basePlayer)
  return result
}

// バリアント生成関数
export const createPlayerVariants = {
  // 新規プレイヤー
  newPlayer: () => createTestPlayer({
    level: 1,
    experience: 0,
    health: 100 as Health
  }),

  // 経験豊富なプレイヤー
  veteranPlayer: () => createTestPlayer({
    level: 50,
    experience: 12500,
    inventory: [/* アイテムのテストデータ */]
  }),

  // ダメージを受けたプレイヤー
  damagedPlayer: () => createTestPlayer({
    health: 20 as Health
  }),

  // 高い場所にいるプレイヤー
  skyPlayer: () => createTestPlayer({
    position: { x: 0, y: 300, z: 0 }
  })
}

// エラーケース用のデータ
export const createInvalidPlayerData = {
  emptyName: () => ({ ...createTestPlayer(), name: "" }),
  invalidHealth: () => ({ ...createTestPlayer(), health: 150 }),
  outOfBoundsY: () => ({
    ...createTestPlayer(),
    position: { x: 0, y: -100, z: 0 }
  }),
  negativeLevel: () => ({ ...createTestPlayer(), level: -1 })
}
```

### Step 3: テスト用Layerシステムの構築

効率的なモックとテスト用サービスの実装：

```typescript
// src/test/layers/test-player-service.ts
import { Effect, Context, Layer } from "effect"

// テスト用エラー定義
export class TestPlayerError extends Schema.TaggedError("TestPlayerError")<{
  readonly operation: string
  readonly playerId?: PlayerId
  readonly reason: string
  readonly timestamp: number
}> {}

// プレイヤーサービスのインターフェース
export interface PlayerService {
  readonly create: (data: CreatePlayerData) => Effect.Effect<Player, TestPlayerError>
  readonly findById: (id: PlayerId) => Effect.Effect<Player | null, TestPlayerError>
  readonly update: (id: PlayerId, data: UpdatePlayerData) => Effect.Effect<Player, TestPlayerError>
  readonly delete: (id: PlayerId) => Effect.Effect<void, TestPlayerError>
  readonly move: (id: PlayerId, position: Position) => Effect.Effect<void, TestPlayerError>
  readonly takeDamage: (id: PlayerId, damage: number) => Effect.Effect<Player, TestPlayerError>
}

export const PlayerService = Context.GenericTag<PlayerService>("@minecraft/PlayerService")

// テスト用PlayerService実装
const makeTestPlayerService = Effect.gen(function* () {
  // インメモリストレージ
  const players = new Map<PlayerId, Player>()

  return PlayerService.of({
    create: (data) => Effect.gen(function* () {
      // バリデーション
      const validatedData = yield* Schema.decodeUnknown(CreatePlayerDataSchema)(data).pipe(
        Effect.mapError(error => new TestPlayerError({
          operation: "create",
          reason: `Validation failed: ${error.message}`,
          timestamp: Date.now()
        }))
      )

      // プレイヤー作成
      const player = createTestPlayer({
        name: validatedData.name,
        position: validatedData.position || { x: 0, y: 64, z: 0 },
        gameMode: validatedData.gameMode || "SURVIVAL"
      })

      players.set(player.id, player)

      yield* Effect.logDebug(`Test player created: ${player.id}`)
      return player
    }),

    findById: (id) => Effect.gen(function* () {
      const player = players.get(id)

      if (!player) {
        yield* Effect.logDebug(`Player not found: ${id}`)
        return null
      }

      return player
    }),

    update: (id, data) => Effect.gen(function* () {
      const existingPlayer = players.get(id)

      if (!existingPlayer) {
        return yield* Effect.fail(new TestPlayerError({
          operation: "update",
          playerId: id,
          reason: "Player not found",
          timestamp: Date.now()
        }))
      }

      // 更新データのバリデーション
      const validatedData = yield* Schema.decodeUnknown(UpdatePlayerDataSchema)(data).pipe(
        Effect.mapError(error => new TestPlayerError({
          operation: "update",
          playerId: id,
          reason: `Update validation failed: ${error.message}`,
          timestamp: Date.now()
        }))
      )

      const updatedPlayer = { ...existingPlayer, ...validatedData }
      players.set(id, updatedPlayer)

      yield* Effect.logDebug(`Player updated: ${id}`)
      return updatedPlayer
    }),

    delete: (id) => Effect.gen(function* () {
      const existed = players.delete(id)

      if (!existed) {
        return yield* Effect.fail(new TestPlayerError({
          operation: "delete",
          playerId: id,
          reason: "Player not found",
          timestamp: Date.now()
        }))
      }

      yield* Effect.logDebug(`Player deleted: ${id}`)
    }),

    move: (id, newPosition) => Effect.gen(function* () {
      const player = players.get(id)

      if (!player) {
        return yield* Effect.fail(new TestPlayerError({
          operation: "move",
          playerId: id,
          reason: "Player not found",
          timestamp: Date.now()
        }))
      }

      // 位置バリデーション
      const validatedPosition = yield* Schema.decodeUnknown(Position)(newPosition).pipe(
        Effect.mapError(error => new TestPlayerError({
          operation: "move",
          playerId: id,
          reason: `Invalid position: ${error.message}`,
          timestamp: Date.now()
        }))
      )

      const updatedPlayer = { ...player, position: validatedPosition }
      players.set(id, updatedPlayer)

      yield* Effect.logDebug(`Player moved: ${id} to (${newPosition.x}, ${newPosition.y}, ${newPosition.z})`)
    }),

    takeDamage: (id, damage) => Effect.gen(function* () {
      const player = players.get(id)

      if (!player) {
        return yield* Effect.fail(new TestPlayerError({
          operation: "takeDamage",
          playerId: id,
          reason: "Player not found",
          timestamp: Date.now()
        }))
      }

      if (damage < 0) {
        return yield* Effect.fail(new TestPlayerError({
          operation: "takeDamage",
          playerId: id,
          reason: "Damage cannot be negative",
          timestamp: Date.now()
        }))
      }

      const newHealth = Math.max(0, player.health - damage) as Health
      const updatedPlayer = { ...player, health: newHealth }
      players.set(id, updatedPlayer)

      yield* Effect.logDebug(`Player ${id} took ${damage} damage, health: ${newHealth}`)
      return updatedPlayer
    })
  })
})

export const TestPlayerServiceLive = Layer.effect(PlayerService, makeTestPlayerService)

// 特定の動作をするテスト用サービス
export const createMockPlayerService = (customBehavior: Partial<PlayerService> = {}) => {
  const makeCustomService = Effect.gen(function* () {
    const defaultService = yield* makeTestPlayerService

    return PlayerService.of({
      ...defaultService,
      ...customBehavior
    })
  })

  return Layer.effect(PlayerService, makeCustomService)
}
```

### Step 4: Property-based テスティングの実装

Fast-Checkを使用した包括的なテスト：

```typescript
// src/test/properties/player-properties.test.ts
import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'

// Arbitraryジェネレータ
const positionArbitrary = fc.record({
  x: fc.float({ min: -30000000, max: 30000000, noNaN: true }),
  y: fc.float({ min: -64, max: 320, noNaN: true }),
  z: fc.float({ min: -30000000, max: 30000000, noNaN: true })
})

const healthArbitrary = fc.integer({ min: 0, max: 100 })

const playerNameArbitrary = fc.string({ minLength: 1, maxLength: 16 })
  .filter(name => name.trim().length > 0)

const gameModeArbitrary = fc.oneof(
  fc.constant("CREATIVE" as const),
  fc.constant("SURVIVAL" as const),
  fc.constant("ADVENTURE" as const)
)

const playerArbitrary = fc.record({
  name: playerNameArbitrary,
  position: positionArbitrary,
  health: healthArbitrary,
  gameMode: gameModeArbitrary
})

describe("Player Properties", () => {
  it("distance calculation should be commutative", () => {
    fc.assert(
      fc.property(
        positionArbitrary,
        positionArbitrary,
        (pos1, pos2) => {
          const distance1 = calculateDistance(pos1, pos2)
          const distance2 = calculateDistance(pos2, pos1)

          expect(distance1).toBeCloseTo(distance2, 5)
        }
      ),
      { seed: 12345, numRuns: 1000 }
    )
  })

  it("moving and returning should preserve original position", () => {
    fc.assert(
      fc.property(
        positionArbitrary,
        fc.record({
          x: fc.float({ min: -100, max: 100 }),
          y: fc.float({ min: -50, max: 50 }),
          z: fc.float({ min: -100, max: 100 })
        }),
        (originalPos, offset) => {
          const moved = movePosition(originalPos, offset)
          const returned = movePosition(moved, negateOffset(offset))

          expect(returned.x).toBeCloseTo(originalPos.x, 5)
          expect(returned.y).toBeCloseTo(originalPos.y, 5)
          expect(returned.z).toBeCloseTo(originalPos.z, 5)
        }
      ),
      { seed: 67890, numRuns: 500 }
    )
  })

  it("health changes should maintain bounds", async () => {
    await fc.assert(
      fc.asyncProperty(
        playerArbitrary,
        fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 10 }),
        async (initialPlayer, healthChanges) => {
          const program = Effect.gen(function* () {
            const service = yield* PlayerService

            // プレイヤー作成
            const player = yield* service.create({
              name: initialPlayer.name,
              position: initialPlayer.position,
              gameMode: initialPlayer.gameMode
            })

            // 複数のヘルス変更を適用
            let currentPlayer = player
            for (const change of healthChanges) {
              if (change > 0) {
                // 回復処理（実装が必要）
                currentPlayer = yield* service.heal(currentPlayer.id, change)
              } else {
                // ダメージ処理
                currentPlayer = yield* service.takeDamage(currentPlayer.id, -change)
              }
            }

            return currentPlayer
          })

          const result = await Effect.runPromise(
            program.pipe(Effect.provide(TestPlayerServiceLive))
          )

          // ヘルスは常に0-100の範囲内
          expect(result.health).toBeGreaterThanOrEqual(0)
          expect(result.health).toBeLessThanOrEqual(100)
        }
      ),
      { seed: 13579, numRuns: 200 }
    )
  })

  it("player creation should always produce valid players", async () => {
    await fc.assert(
      fc.asyncProperty(
        playerArbitrary,
        async (playerData) => {
          const program = Effect.gen(function* () {
            const service = yield* PlayerService
            return yield* service.create(playerData)
          })

          const result = await Effect.runPromise(
            program.pipe(Effect.provide(TestPlayerServiceLive))
          )

          // 作成されたプレイヤーは常に有効
          expect(result.name).toBe(playerData.name)
          expect(result.health).toBeGreaterThanOrEqual(0)
          expect(result.health).toBeLessThanOrEqual(100)
          expect(result.position.y).toBeGreaterThanOrEqual(-64)
          expect(result.position.y).toBeLessThanOrEqual(320)
          expect(result.id).toBeDefined()
          expect(typeof result.id).toBe("string")
        }
      ),
      { seed: 24680, numRuns: 300 }
    )
  })
})
```

### Step 5: 統合テストとパフォーマンステスト

```typescript
// src/test/integration/game-integration.test.ts
describe("Game Integration Tests", () => {
  const IntegrationLayers = Layer.mergeAll(
    TestPlayerServiceLive,
    TestWorldServiceLive,
    TestPhysicsServiceLive,
    TestRenderServiceLive
  )

  it("should handle complete game tick cycle", async () => {
    const program = Effect.gen(function* () {
      // サービスの取得
      const playerService = yield* PlayerService
      const worldService = yield* WorldService
      const physicsService = yield* PhysicsService

      // プレイヤー作成
      const player = yield* playerService.create({
        name: "IntegrationTest",
        position: { x: 0, y: 64, z: 0 },
        gameMode: "SURVIVAL"
      })

      // 初期状態の記録
      const initialState = yield* worldService.getGameState()

      // ゲームティック実行（16ms ≈ 60fps）
      yield* physicsService.update(0.016)
      yield* worldService.tick(0.016)

      // 状態変化の確認
      const finalState = yield* worldService.getGameState()

      return { player, initialState, finalState }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(IntegrationLayers))
    )

    expect(result.player).toBeDefined()
    expect(result.finalState.timestamp).toBeGreaterThan(result.initialState.timestamp)
  })

  it("should handle concurrent player actions", async () => {
    const program = Effect.gen(function* () {
      const playerService = yield* PlayerService

      // 複数プレイヤーの同時作成
      const playerActions = Array.from({ length: 10 }, (_, i) =>
        playerService.create({
          name: `Player${i}`,
          position: { x: i * 10, y: 64, z: 0 },
          gameMode: "SURVIVAL"
        })
      )

      // 並列実行
      const players = yield* Effect.all(playerActions, { concurrency: "unbounded" })

      // 同時移動
      const moveActions = players.map(player =>
        playerService.move(player.id, {
          x: player.position.x + 10,
          y: player.position.y,
          z: player.position.z + 10
        })
      )

      yield* Effect.all(moveActions, { concurrency: "unbounded" })

      // 状態確認
      const updatedPlayers = yield* Effect.all(
        players.map(player => playerService.findById(player.id)),
        { concurrency: "unbounded" }
      )

      return updatedPlayers.filter((p): p is Player => p !== null)
    })

    const startTime = performance.now()

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(IntegrationLayers))
    )

    const duration = performance.now() - startTime

    // 結果検証
    expect(result).toHaveLength(10)
    expect(duration).toBeLessThan(100) // 100ms以内で完了

    // すべてのプレイヤーが正しく移動されている
    result.forEach((player, index) => {
      expect(player.position.x).toBe(index * 10 + 10)
      expect(player.position.z).toBe(10)
    })
  })
})

// パフォーマンステスト
describe("Performance Tests", () => {
  it("should process large number of entities efficiently", async () => {
    const ENTITY_COUNT = 1000
    const MAX_PROCESSING_TIME = 200 // ms

    const program = Effect.gen(function* () {
      const entityService = yield* EntityService

      // 大量のエンティティ作成
      const createTasks = Array.from({ length: ENTITY_COUNT }, (_, i) =>
        entityService.create({
          type: "test-entity",
          position: {
            x: Math.random() * 1000,
            y: 64,
            z: Math.random() * 1000
          }
        })
      )

      const entities = yield* Effect.all(createTasks, { concurrency: 10 })

      // 一括処理
      const processAllEntities = yield* entityService.processBatch(entities)

      return processAllEntities
    })

    const startTime = performance.now()

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestEntityServiceLive))
    )

    const duration = performance.now() - startTime

    expect(result).toHaveLength(ENTITY_COUNT)
    expect(duration).toBeLessThan(MAX_PROCESSING_TIME)
  })

  it("should maintain consistent frame times under load", async () => {
    const FRAME_COUNT = 100
    const TARGET_FRAME_TIME = 16 // ms (60fps)
    const TOLERANCE = 5 // ms

    const frameTimes: number[] = []

    const program = Effect.gen(function* () {
      const gameLoop = yield* GameLoopService

      for (let i = 0; i < FRAME_COUNT; i++) {
        const frameStart = performance.now()

        yield* gameLoop.tick(TARGET_FRAME_TIME / 1000)

        const frameTime = performance.now() - frameStart
        frameTimes.push(frameTime)
      }

      return frameTimes
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestGameLoopServiceLive))
    )

    // フレーム時間の統計
    const avgFrameTime = result.reduce((a, b) => a + b, 0) / result.length
    const maxFrameTime = Math.max(...result)
    const minFrameTime = Math.min(...result)

    expect(avgFrameTime).toBeLessThan(TARGET_FRAME_TIME + TOLERANCE)
    expect(maxFrameTime).toBeLessThan(TARGET_FRAME_TIME * 2) // 最大でも2倍まで
    expect(minFrameTime).toBeGreaterThan(1) // 最低限の処理時間

    // フレーム時間の分散確認（一貫性）
    const variance = result.reduce((acc, time) => {
      return acc + Math.pow(time - avgFrameTime, 2)
    }, 0) / result.length

    expect(Math.sqrt(variance)).toBeLessThan(TOLERANCE) // 標準偏差が許容範囲内
  })
})
```

## 💡 Best Practices

### 1. テストデータ管理

```typescript
// ✅ テストデータのバージョン管理
const TEST_DATA_VERSION = "1.2.0"

const createVersionedTestData = (version: string = TEST_DATA_VERSION) => {
  switch (version) {
    case "1.0.0":
      return createLegacyTestPlayer()
    case "1.2.0":
      return createCurrentTestPlayer()
    default:
      throw new Error(`Unsupported test data version: ${version}`)
  }
}

// ✅ テスト間の独立性確保
beforeEach(async () => {
  await cleanupTestEnvironment()
  await setupFreshTestData()
})
```

### 2. 効率的なアサーション

```typescript
// ✅ Schema-aware アサーション
const assertValidPlayer = (player: unknown): asserts player is Player => {
  const result = Schema.decodeUnknownSync(Player)(player)
  expect(result).toBeDefined()
}

// ✅ カスタムマッチャー
expect.extend({
  toBeValidPosition(received: unknown) {
    const isValid = Schema.is(Position)(received)

    return {
      pass: isValid,
      message: () => `Expected ${received} to be a valid Position`
    }
  }
})
```

### 3. テストの並列化最適化

```typescript
// ✅ CPUバウンドなテストの分離
describe("CPU Intensive Tests", () => {
  // これらのテストは並列実行から除外
  it.concurrent.skip("heavy computation test", async () => {
    // 重い処理のテスト
  })
})

// ✅ リソースプールの適切な管理
const testResourcePool = new Semaphore(4) // 最大4つの同時テスト

const runWithResourceLimit = <T>(test: () => Promise<T>) =>
  testResourcePool.withPermit(test)
```

## ⚠️ Common Pitfalls

### 1. 非同期処理の適切な待機

```typescript
// ❌ 不完全な非同期処理のテスト
const badTest = async () => {
  const service = getService()
  service.asyncOperation() // awaitしていない
  expect(service.getState()).toBe("completed") // 失敗する可能性
}

// ✅ 適切な非同期処理のテスト
const goodTest = async () => {
  const program = Effect.gen(function* () {
    const service = yield* Service
    yield* service.asyncOperation()
    const state = yield* service.getState()
    return state
  })

  const result = await Effect.runPromise(
    program.pipe(Effect.provide(TestServiceLive))
  )

  expect(result).toBe("completed")
}
```

### 2. テスト状態の汚染

```typescript
// ❌ グローバル状態に依存するテスト
let globalCounter = 0

const unreliableTest = () => {
  globalCounter++
  expect(globalCounter).toBe(1) // 他のテストの影響を受ける
}

// ✅ 状態が独立したテスト
const reliableTest = async () => {
  const program = Effect.gen(function* () {
    const counter = yield* CounterService
    yield* counter.increment()
    const value = yield* counter.getValue()
    return value
  })

  const result = await Effect.runPromise(
    program.pipe(Effect.provide(createFreshCounterService()))
  )

  expect(result).toBe(1)
}
```

## 🔧 Advanced Techniques

### 1. 時間制御テスト

```typescript
// TestClockを使用した決定論的時間制御
describe("Time-dependent Operations", () => {
  it("should handle scheduled tasks correctly", async () => {
    const program = Effect.gen(function* () {
      const scheduler = yield* TaskScheduler
      const clock = yield* Clock

      // 10秒後にタスクをスケジュール
      const task = scheduler.scheduleIn("10 seconds", performTask)

      // 時間を9秒進める
      yield* TestClock.adjust("9 seconds")
      let isCompleted = yield* task.isCompleted()
      expect(isCompleted).toBe(false)

      // さらに2秒進める（合計11秒）
      yield* TestClock.adjust("2 seconds")
      isCompleted = yield* task.isCompleted()
      expect(isCompleted).toBe(true)
    })

    await Effect.runPromise(
      program.pipe(
        Effect.provide(TestTaskSchedulerLive),
        Effect.provide(TestClock.layer)
      )
    )
  })
})
```

### 2. エラー注入テスト

```typescript
// 意図的なエラー発生によるロバストネステスト
const createFaultInjectionService = (failureRate: number = 0.1) => {
  const makeService = Effect.gen(function* () {
    return Service.of({
      operation: (data) => Effect.gen(function* () {
        // 指定された確率でエラーを発生
        const shouldFail = Math.random() < failureRate

        if (shouldFail) {
          return yield* Effect.fail(new TransientError("Injected failure"))
        }

        return yield* normalOperation(data)
      })
    })
  })

  return Layer.effect(Service, makeService)
}

describe("Fault Tolerance", () => {
  it("should handle transient failures gracefully", async () => {
    const program = Effect.gen(function* () {
      const service = yield* Service

      // 失敗を考慮したリトライ戦略
      const result = yield* service.operation(testData).pipe(
        Effect.retry(
          Schedule.exponential("100 millis").pipe(
            Schedule.intersect(Schedule.recurs(5))
          )
        )
      )

      return result
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(createFaultInjectionService(0.7))) // 70%失敗率
    )

    expect(result).toBeDefined()
  })
})
```

### 3. カオスエンジニアリングテスト

```typescript
// システムの予期しない状況での動作テスト
describe("Chaos Engineering", () => {
  it("should survive random service failures", async () => {
    const chaosConfig = {
      networkFailureRate: 0.1,
      serviceLatency: { min: 10, max: 1000 },
      memoryPressure: 0.8
    }

    const program = Effect.gen(function* () {
      const system = yield* GameSystem

      // カオスを注入しながらシステムを実行
      const results = []
      for (let i = 0; i < 100; i++) {
        const result = yield* system.processGameTick().pipe(
          Effect.timeout("5 seconds"),
          Effect.catchAll(() => Effect.succeed("timeout"))
        )
        results.push(result)
      }

      return results
    })

    const results = await Effect.runPromise(
      program.pipe(Effect.provide(createChaosGameSystem(chaosConfig)))
    )

    // システムが完全に停止していないことを確認
    const successCount = results.filter(r => r !== "timeout").length
    expect(successCount).toBeGreaterThan(50) // 最低50%は成功する
  })
})
```

このガイドに従うことで、堅牢で保守性の高いテストスイートを構築し、高品質なゲームエンジンを開発できます。