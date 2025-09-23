---
title: 'TypeScript Minecraft テスティング標準規約'
description: 'テスト配置、命名規則、PBT実装、カバレッジ100%達成のための厳密なガイドライン'
category: 'standards'
difficulty: 'intermediate'
tags: ['testing', 'standards', 'pbt', 'effect-ts', 'coverage']
prerequisites: ['testing-guide', 'effect-ts-patterns']
estimated_reading_time: '15分'
related_docs: ['./testing-guide.md', './comprehensive-testing-strategy.md', '../development/development-conventions.md']
---

# TypeScript Minecraft テスティング標準規約

## 🎯 厳密なテスト配置ルール

### 1. ファイル配置の絶対規則

**すべてのテストは `src/**/**test**/\*.spec.ts` に配置する\*\*

```
src/
├── domain/
│   ├── entity/
│   │   ├── Player.ts
│   │   └── __test__/
│   │       └── Player.spec.ts      # ✅ 必須
├── infrastructure/
│   ├── rendering/
│   │   ├── RendererService.ts
│   │   └── __test__/
│   │       └── RendererService.spec.ts  # ✅ 必須
└── shared/
    ├── services/
    │   ├── LoggerService.ts
    │   └── __test__/
    │       └── LoggerService.spec.ts    # ✅ 必須
```

### 2. 1対1対応の原則

```typescript
// ❌ 禁止: 複数実装ファイルを1つのテストでカバー
// ❌ 禁止: テストファイルなしの実装ファイル
// ✅ 必須: 実装ファイルごとに専用のテストファイル

// src/domain/block/Block.ts に対して
// src/domain/block/__test__/Block.spec.ts が必須
```

## 📝 Effect-TS + Schema による型安全テスト実装

### 1. Schema-First Testing Pattern

```typescript
// src/domain/entity/__test__/Player.spec.ts
import { describe, it, expect } from '@effect/vitest'
import { Schema, Effect, pipe } from 'effect'
import * as fc from 'fast-check'

// 厳密な型定義（as anyを一切使用しない）
const PlayerPositionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite(), Schema.between(-30_000_000, 30_000_000)),
  y: Schema.Number.pipe(Schema.int(), Schema.between(-64, 320)),
  z: Schema.Number.pipe(Schema.finite(), Schema.between(-30_000_000, 30_000_000)),
})

const PlayerHealthSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 100), Schema.brand('PlayerHealth'))

const PlayerSchema = Schema.Struct({
  _tag: Schema.Literal('Player'),
  id: Schema.String.pipe(Schema.pattern(/^player_[a-f0-9-]{36}$/), Schema.brand('PlayerId')),
  name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(16), Schema.pattern(/^[a-zA-Z0-9_]+$/)),
  position: PlayerPositionSchema,
  health: PlayerHealthSchema,
  maxHealth: PlayerHealthSchema,
  inventory: Schema.Array(
    Schema.Struct({
      itemId: Schema.String.pipe(Schema.brand('ItemId')),
      quantity: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
    })
  ),
})

// 型推論を活用（明示的な型注釈は最小限）
type Player = Schema.Schema.Type<typeof PlayerSchema>
type PlayerEncoded = Schema.Schema.Encoded<typeof PlayerSchema>
```

### 2. Service Layer Testing

```typescript
import { Context, Layer, Effect } from 'effect'

// サービスインターフェース定義
class PlayerService extends Context.Tag('PlayerService')<
  PlayerService,
  {
    readonly create: (data: PlayerCreateData) => Effect.Effect<Player, PlayerServiceError>
    readonly findById: (id: PlayerId) => Effect.Effect<Player, PlayerNotFoundError>
    readonly update: (id: PlayerId, data: Partial<PlayerUpdateData>) => Effect.Effect<Player, PlayerServiceError>
    readonly delete: (id: PlayerId) => Effect.Effect<void, PlayerNotFoundError>
  }
>() {}

// テスト用Layer実装
const TestPlayerServiceLive = Layer.succeed(
  PlayerService,
  PlayerService.of({
    create: (data) =>
      Effect.gen(function* () {
        // Schema validationを必須で実行
        const validated = yield* Schema.decodeUnknown(PlayerCreateDataSchema)(data)

        // エラーハンドリングは明示的に
        if (!validated.name) {
          return yield* Effect.fail(
            new PlayerServiceError({
              message: 'Name is required',
              code: 'INVALID_INPUT',
            })
          )
        }

        // 成功パスも型安全に
        return createPlayer(validated)
      }),

    findById: (id) =>
      Effect.gen(function* () {
        const player = playersMap.get(id)
        if (!player) {
          return yield* Effect.fail(new PlayerNotFoundError({ playerId: id }))
        }
        return player
      }),

    // 他のメソッドも同様に実装
  })
)
```

## 🔬 Property-Based Testing (PBT) 実装

### 1. Fast-Check Arbitrary 定義

```typescript
// Arbitrary generators（型情報を最大限活用）
const positionArbitrary = fc.record({
  x: fc.float({ min: -30_000_000, max: 30_000_000, noNaN: true }),
  y: fc.integer({ min: -64, max: 320 }),
  z: fc.float({ min: -30_000_000, max: 30_000_000, noNaN: true }),
})

const playerNameArbitrary = fc.stringMatching(/^[a-zA-Z0-9_]{3,16}$/)

const playerHealthArbitrary = fc.integer({ min: 0, max: 100 })

const playerArbitrary = fc
  .record({
    name: playerNameArbitrary,
    position: positionArbitrary,
    health: playerHealthArbitrary,
    maxHealth: playerHealthArbitrary,
  })
  .filter((p) => p.health <= p.maxHealth) // 不変条件の保証

// ItemのArbitrary
const itemArbitrary = fc.record({
  itemId: fc.constantFrom(...VALID_ITEM_IDS),
  quantity: fc.integer({ min: 1, max: 64 }),
})

const inventoryArbitrary = fc.array(itemArbitrary, { maxLength: 36 })
```

### 2. PBTテストケース実装

```typescript
describe('Player Properties', () => {
  it('player creation invariants', async () => {
    await fc.assert(
      fc.asyncProperty(playerArbitrary, async (playerData) => {
        const program = Effect.gen(function* () {
          const service = yield* PlayerService
          return yield* service.create(playerData)
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(TestPlayerServiceLive)))

        // 不変条件の検証
        expect(result.health).toBeGreaterThanOrEqual(0)
        expect(result.health).toBeLessThanOrEqual(100)
        expect(result.health).toBeLessThanOrEqual(result.maxHealth)

        // 位置の有効性
        expect(result.position.y).toBeGreaterThanOrEqual(-64)
        expect(result.position.y).toBeLessThanOrEqual(320)

        // 名前の形式
        expect(result.name).toMatch(/^[a-zA-Z0-9_]{3,16}$/)
      }),
      {
        numRuns: 1000,
        seed: 42,
        endOnFailure: true,
      }
    )
  })

  it('distance calculation properties', () => {
    fc.assert(
      fc.property(positionArbitrary, positionArbitrary, (pos1, pos2) => {
        const distance = calculateDistance(pos1, pos2)

        // 距離の性質
        expect(distance).toBeGreaterThanOrEqual(0)

        // 交換法則
        const reverseDistance = calculateDistance(pos2, pos1)
        expect(distance).toBeCloseTo(reverseDistance, 10)

        // 三角不等式
        const origin = { x: 0, y: 0, z: 0 }
        const d1 = calculateDistance(origin, pos1)
        const d2 = calculateDistance(origin, pos2)
        const d12 = calculateDistance(pos1, pos2)
        expect(d12).toBeLessThanOrEqual(d1 + d2 + 0.0001) // 浮動小数点誤差考慮
      }),
      { numRuns: 1000 }
    )
  })

  it('inventory management properties', async () => {
    await fc.assert(
      fc.asyncProperty(inventoryArbitrary, itemArbitrary, async (initialInventory, newItem) => {
        const program = Effect.gen(function* () {
          const service = yield* InventoryService

          // 初期インベントリ設定
          yield* service.setInventory(initialInventory)

          // アイテム追加
          const canAdd = yield* service.canAddItem(newItem)
          if (canAdd) {
            yield* service.addItem(newItem)
          }

          return yield* service.getInventory()
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(TestInventoryServiceLive)))

        // インベントリサイズ制限
        expect(result.length).toBeLessThanOrEqual(36)

        // アイテムスタック制限
        result.forEach((item) => {
          expect(item.quantity).toBeGreaterThanOrEqual(1)
          expect(item.quantity).toBeLessThanOrEqual(64)
        })
      }),
      { numRuns: 500 }
    )
  })
})
```

## ✅ カバレッジ100%達成戦略

### 1. 必須カバレッジ項目

```typescript
describe('Complete Coverage Testing', () => {
  // Effect-TS Layer設定
  const TestLayers = Layer.mergeAll(
    TestPlayerServiceLive,
    TestInventoryServiceLive,
    TestLoggerServiceLive
  )

  // 1. 正常系
  describe('Success paths', () => {
    it('creates player with valid data', async () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* service.create(validPlayerData)
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestLayers))
      )

      expect(result._tag).toBe('Player')
      expect(result.health).toBe(100)
    })
  })

  // 2. 異常系（全エラーパス）
  describe('Error paths', () => {
    it('handles validation errors', async () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* service.create({ name: '' }) // 無効データ
      })

      const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(TestPlayerServiceLive)))

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = Cause.squash(exit.cause)
        expect(error._tag).toBe('ValidationError')
      }
    })

    it('handles not found errors', async () => {
      // 実装
    })

    it('handles concurrent modification', async () => {
      // 実装
    })
  })

  // 3. 境界値
  describe('Boundary conditions', () => {
    it.each([
      [-64, true], // 最小値
      [320, true], // 最大値
      [-65, false], // 最小値-1
      [321, false], // 最大値+1
    ])('validates Y coordinate %i (valid: %s)', (y, isValid) => {
      const result = isValidYCoordinate(y)
      expect(result).toBe(isValid)
    })
  })

  // 4. 状態遷移
  describe('State transitions', () => {
    it('player lifecycle: create -> update -> delete', async () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService

        // Create
        const player = yield* service.create({ name: 'TestPlayer' })
        expect(player.health).toBe(100)

        // Update
        const updated = yield* service.update(player.id, { health: 50 })
        expect(updated.health).toBe(50)

        // Delete
        yield* service.delete(player.id)

        // Verify deletion
        const result = yield* Effect.either(service.findById(player.id))
        expect(Either.isLeft(result)).toBe(true)
      })

      await Effect.runPromise(program.pipe(Effect.provide(TestPlayerServiceLive)))
    })
  })
})
```

### 2. カバレッジ設定

```typescript
// vitest.config.ts
import { defineConfig } from '@effect/vitest/config'

export default defineConfig({
  test: {
    // Effect-TS専用のテスト環境設定
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      enabled: true,
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__test__/**',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/index.ts',
        'src/types/**'
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      watermarks: {
        statements: [95, 100],
        branches: [95, 100],
        functions: [95, 100],
        lines: [95, 100],
      },
    },
  },
  // Effect-TSサポートのためのプラグイン設定
  plugins: [],
})
```

## 🚫 禁止事項

### 型安全性の破壊を防ぐ

```typescript
// ❌ 絶対禁止
const player = data as any
const result = service.create(data as PlayerData)
const mockServiceLayer = Layer.succeed(PlayerService, PlayerService.of({
  create: () => Effect.succeed(mockPlayer),
  findById: () => Effect.succeed(mockPlayer)
}))

// ✅ 必須: 型推論または明示的な型定義
const player = Schema.decodeUnknownSync(PlayerSchema)(data)
const result = await service.create(validatedData)
const mockPlayerService = Layer.succeed(PlayerService, PlayerService.of({
  create: (data: PlayerData) => Effect.succeed(player),
  findById: (id: PlayerId) => Effect.succeed(player)
}))
```

### テスト品質の低下を防ぐ

```typescript
// ❌ 禁止: テストのスキップ
it.skip('important test', () => {})
describe.skip('critical feature', () => {})

// ❌ 禁止: 不完全なアサーション
expect(result).toBeTruthy() // 曖昧

// ✅ 必須: 明確なアサーション
expect(result).toEqual(expectedPlayer)
expect(result.health).toBe(100)
```

## 🔄 実装前チェックリスト

1. **@docs/を確認したか？**
2. **Context7で最新ライブラリ仕様を確認したか？**
3. **既存の実装パターンを確認したか？**
4. **Schemaによる型定義を作成したか？**
5. **PBTのArbitraryを定義したか？**
6. **エラーケースを網羅したか？**
7. **カバレッジ100%を達成したか？**

## 📊 メトリクス目標

- **カバレッジ**: 100%（全項目）
- **PBTテスト実行数**: 最低1000回/プロパティ
- **テスト実行時間**: < 30秒（単体テスト全体）
- **型安全性**: as any使用率 0%

## 🎯 まとめ

この標準規約に従うことで：

1. **完全な型安全性**: Effect-TS + Schemaによる実行時検証
2. **網羅的なテスト**: PBTによる境界値・不変条件の自動検証
3. **保守性の向上**: 1対1対応による明確な責任分離
4. **品質保証**: カバレッジ100%による信頼性確保

すべての開発者とAIエージェントはこの規約を厳守してください。
