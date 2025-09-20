---
title: 'テスティング完全ガイド - 基礎からEffect-TS実践まで'
description: 'TypeScript Minecraft CloneプロジェクトのためのVitestとEffect-TS 3.17+統合テスト戦略。初心者向け基礎からSchema-basedバリデーション、Property-Based Testing、高度なテストパターンまで包括的に解説'
category: 'guide'
difficulty: 'beginner-to-intermediate'
tags: ['testing', 'vitest', 'effect-ts', 'property-based-testing', 'schema-validation', 'test-fundamentals']
prerequisites: ['basic-typescript', 'npm-basics', 'project-setup']
estimated_reading_time: '25分'
related_patterns: ['effect-ts-test-patterns', 'service-patterns-catalog', 'error-handling-patterns']
related_docs:
  [
    './comprehensive-testing-strategy.md',
    './advanced-testing-techniques.md',
    '../development/development-conventions.md',
  ]
---

# テスティング完全ガイド - 基礎からEffect-TS実践まで

## 🎯 このガイドの目標

**⏱️ 学習時間**: 25分 | **👤 対象**: テスト初心者から中級開発者まで

TypeScript Minecraft Cloneプロジェクトでテストを書く基礎から実践まで段階的に学習します。「なぜテストが必要か？」から「Effect-TSを使った高度なテストパターン」まで、実用的なスキルを習得できます。

> 📍 **学習フロー**: **[基本テスト 10分]** → **[Effect-TS統合 10分]** → **[実践パターン 5分]** → [高度戦略 35分]

### 解決する課題

- **テスト作成の基礎**: Vitestの基本からEffect-TSの複雑な非同期パターンまで
- **型安全性の検証**: 実行時のスキーマバリデーションとテストの統合
- **依存関係の管理**: モックとテスト用サービスの適切な構築
- **統合テスト戦略**: 複数レイヤーにまたがるテストの実装
- **実践的パターン**: 実際のMinecraftコンポーネントのテスト手法

## 📚 Part I: テストの基礎

### 1. テストとは何か？

#### 1.1 なぜテストが重要なのか

```typescript
// ❌ テストなしの開発
function calculateDistance(pos1: Position, pos2: Position): number {
  return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2) + Math.pow(pos2.z - pos1.z, 2))
}
// バグがあってもリリース後まで分からない...
```

```typescript
// ✅ テストありの開発
import { describe, it, expect } from 'vitest'

describe('calculateDistance', () => {
  it('正しい距離を計算する', () => {
    const pos1 = { x: 0, y: 0, z: 0 }
    const pos2 = { x: 3, y: 4, z: 0 }

    const result = calculateDistance(pos1, pos2)

    expect(result).toBe(5) // 3-4-5の直角三角形
  })

  it('同じ位置の距離は0', () => {
    const pos = { x: 10, y: 20, z: 30 }

    const result = calculateDistance(pos, pos)

    expect(result).toBe(0)
  })
})
// バグを早期発見！安心してリファクタリング可能
```

#### 1.2 基本的なテスト実行

```bash
# すべてのテストを実行
npm run test

# ファイル監視モードで実行（ファイル変更時に自動実行）
npm run test -- --watch

# 特定のファイルのみテスト
npm run test src/domain/position.test.ts

# パターンマッチでテスト実行
npm run test -- --grep "Position"

# カバレッジ付きで実行
npm run test:coverage
```

### 2. Vitestの基本パターン

#### 2.1 テストファイルの構造

```typescript
// 📁 src/domain/position.test.ts
import { describe, it, expect } from 'vitest'
import { Position, PositionOps } from './position'

// 🏗️ テストスイート（関連するテストをグループ化）
describe('Position', () => {
  // 🧪 個別のテストケース
  it('有効な座標を作成できる', () => {
    // 準備 (Arrange)
    const x = 100
    const y = 64
    const z = -50

    // 実行 (Act)
    const position: Position = { x, y, z }

    // 検証 (Assert)
    expect(position.x).toBe(100)
    expect(position.y).toBe(64)
    expect(position.z).toBe(-50)
  })

  it('距離計算が正しく動作する', () => {
    // AAA パターン（Arrange-Act-Assert）
    const pos1 = { x: 0, y: 0, z: 0 }
    const pos2 = { x: 6, y: 8, z: 0 }

    const distance = PositionOps.distance(pos1, pos2)

    expect(distance).toBe(10)
  })
})
```

#### 2.2 基本的なアサーション

```typescript
describe('Vitestアサーション基本', () => {
  it('等価性の検証', () => {
    // 🔍 値の比較
    expect(2 + 2).toBe(4) // 厳密等価（===）
    expect({ x: 1, y: 2 }).toEqual({ x: 1, y: 2 }) // オブジェクトの内容比較

    // 🔍 真偽値の検証
    expect(true).toBeTruthy() // 真値判定
    expect(false).toBeFalsy() // 偽値判定
    expect(null).toBeNull() // nullチェック
    expect(undefined).toBeUndefined() // undefinedチェック
  })

  it('数値の検証', () => {
    const health = 85

    expect(health).toBeGreaterThan(50) // > 50
    expect(health).toBeGreaterThanOrEqual(85) // >= 85
    expect(health).toBeLessThan(100) // < 100
    expect(health).toBeCloseTo(85.0, 0) // 浮動小数点の近似比較
  })

  it('文字列の検証', () => {
    const playerName = 'Steve'

    expect(playerName).toContain('teve') // 部分文字列を含む
    expect(playerName).toMatch(/^S/) // 正規表現マッチ
    expect(playerName).toHaveLength(5) // 文字列長
  })

  it('配列・オブジェクトの検証', () => {
    const inventory = ['stone', 'wood', 'dirt']

    expect(inventory).toHaveLength(3) // 配列長
    expect(inventory).toContain('wood') // 要素を含む
    expect(inventory).toEqual(
      // 配列の内容全体
      expect.arrayContaining(['stone', 'wood'])
    )

    const player = { name: 'Alex', health: 20 }
    expect(player).toHaveProperty('health') // プロパティ存在
    expect(player).toHaveProperty('health', 20) // プロパティ値
  })
})
```

### 3. 実際のMinecraftコンポーネントをテストする

#### 3.1 Position のテスト

```typescript
// 📁 src/domain/position.test.ts
import { describe, it, expect } from 'vitest'
import { Position, PositionOps } from './position'

describe('Position', () => {
  describe('基本機能', () => {
    it('座標が正しく設定される', () => {
      const pos: Position = { x: 10, y: 64, z: -25 }

      expect(pos.x).toBe(10)
      expect(pos.y).toBe(64)
      expect(pos.z).toBe(-25)
    })
  })

  describe('PositionOps', () => {
    describe('distance', () => {
      it('2点間の距離を正しく計算する', () => {
        const pos1: Position = { x: 0, y: 0, z: 0 }
        const pos2: Position = { x: 3, y: 4, z: 0 }

        const result = PositionOps.distance(pos1, pos2)

        expect(result).toBe(5) // 3-4-5の三角形
      })

      it('同じ位置の距離は0', () => {
        const pos: Position = { x: 100, y: 200, z: 300 }

        const result = PositionOps.distance(pos, pos)

        expect(result).toBe(0)
      })

      it('3次元での距離計算', () => {
        const pos1: Position = { x: 1, y: 2, z: 3 }
        const pos2: Position = { x: 4, y: 6, z: 8 }

        const result = PositionOps.distance(pos1, pos2)

        // √[(4-1)² + (6-2)² + (8-3)²] = √[9 + 16 + 25] = √50 ≈ 7.07
        expect(result).toBeCloseTo(7.07, 2)
      })
    })

    describe('getAdjacent', () => {
      it('北方向の隣接座標を取得', () => {
        const pos: Position = { x: 0, y: 64, z: 0 }

        const result = PositionOps.getAdjacent(pos, 'north')

        expect(result).toEqual({ x: 0, y: 64, z: -1 })
      })

      it('すべての方向で正しい隣接座標を取得', () => {
        const center: Position = { x: 10, y: 20, z: 30 }

        expect(PositionOps.getAdjacent(center, 'north')).toEqual({ x: 10, y: 20, z: 29 })
        expect(PositionOps.getAdjacent(center, 'south')).toEqual({ x: 10, y: 20, z: 31 })
        expect(PositionOps.getAdjacent(center, 'east')).toEqual({ x: 11, y: 20, z: 30 })
        expect(PositionOps.getAdjacent(center, 'west')).toEqual({ x: 9, y: 20, z: 30 })
        expect(PositionOps.getAdjacent(center, 'up')).toEqual({ x: 10, y: 21, z: 30 })
        expect(PositionOps.getAdjacent(center, 'down')).toEqual({ x: 10, y: 19, z: 30 })
      })
    })
  })
})
```

---

## 📖 Part II: Effect-TS統合テスト

### Effect-TSテスト環境の構築

プロジェクトのEffect-TSテスト環境をセットアップします：

```bash
# Effect-TS 3.17+ 対応の最新パッケージインストール
npm install -D vitest @vitest/ui happy-dom
npm install -D @effect/vitest fast-check@^3.15.0
npm install -D @effect/schema @effect/platform
npm install -D @types/node typescript

# Property-Based Testing 統合
npm install -D @effect/schema@latest
npm install -D @fast-check/vitest
```

### Schema-first テストパターン

```typescript
// 1. Schema.Struct による最新バリデーションテスト
const PlayerSchema = Schema.Struct({
  _tag: Schema.Literal('Player'),
  id: Schema.String.pipe(Schema.brand('PlayerId'), Schema.pattern(/^player_[a-f0-9-]{36}$/)),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.finite()),
    y: Schema.Number.pipe(Schema.between(0, 320), Schema.int()),
    z: Schema.Number.pipe(Schema.finite()),
  }),
  health: Schema.Number.pipe(Schema.clamp(0, 100), Schema.int(), Schema.brand('Health')),
  maxHealth: Schema.Number.pipe(Schema.clamp(0, 100), Schema.int(), Schema.brand('Health')),
})

// 2. Effect-aware テストの実行
describe('PlayerService', () => {
  it('should create player with valid data', async () => {
    const program = Effect.gen(function* () {
      const service = yield* PlayerService
      const player = yield* service.create({
        name: 'TestPlayer',
        position: { x: 0, y: 64, z: 0 },
      })
      return player
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(TestPlayerServiceLive)))

    expect(result).toMatchObject({
      name: 'TestPlayer',
      position: { x: 0, y: 64, z: 0 },
      health: 100,
    })
  })
})
```

### Effect-aware エラーハンドリング

```typescript
// 3. TaggedError のテスト
it('should handle validation errors properly', async () => {
  const program = Effect.gen(function* () {
    const service = yield* PlayerService
    return yield* service.create({ name: '' }) // 無効なデータ
  })

  const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(TestPlayerServiceLive)))

  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) {
    const error = Exit.unannotate(exit.cause)
    expect(error._tag).toBe('ValidationError')
  }
})
```

### Layer-based モックシステム

Effect-TSのLayerシステムを活用したテスト用サービス実装：

```typescript
// src/test/layers/test-player-service.ts
import { Effect, Context, Layer } from "effect"

// テスト用エラー定義
export const TestPlayerError = Schema.TaggedError("TestPlayerError")({
  operation: Schema.String,
  readonly playerId?: PlayerId,
  reason: Schema.String,
  timestamp: Schema.Number
})

// プレイヤーサービスのインターフェース
export interface PlayerService {
  readonly create: (data: CreatePlayerData) => Effect.Effect<Player, TestPlayerError>
  readonly findById: (id: PlayerId) => Effect.Effect<Player | null, TestPlayerError>
  readonly update: (id: PlayerId, data: UpdatePlayerData) => Effect.Effect<Player, TestPlayerError>
  readonly delete: (id: PlayerId) => Effect.Effect<void, TestPlayerError>
}

export const PlayerService = Context.GenericTag<PlayerService>("@minecraft/PlayerService")

// テスト用PlayerService実装
const makeTestPlayerService = Effect.gen(function* () {
  const players = new Map<PlayerId, Player>()

  return PlayerService.of({
    create: (data) => Effect.gen(function* () {
      const validatedData = yield* Schema.decodeUnknown(CreatePlayerDataSchema)(data).pipe(
        Effect.mapError(error => new TestPlayerError({
          operation: "create",
          reason: `Validation failed: ${error.message}`,
          timestamp: Date.now()
        }))
      )

      const player = createTestPlayer({
        name: validatedData.name,
        position: validatedData.position || { x: 0, y: 64, z: 0 }
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

    // ... 他のメソッド実装
  })
})

export const TestPlayerServiceLive = Layer.effect(PlayerService, makeTestPlayerService)
```

### Property-Based Testing統合

Fast-Checkを使用した包括的なテスト：

```typescript
import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'

// Arbitraryジェネレータ
const positionArbitrary = fc.record({
  x: fc.float({ min: -30000000, max: 30000000, noNaN: true }),
  y: fc.float({ min: -64, max: 320, noNaN: true }),
  z: fc.float({ min: -30000000, max: 30000000, noNaN: true }),
})

const playerArbitrary = fc.record({
  name: fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/),
  health: fc.integer({ min: 0, max: 100 }),
  position: positionArbitrary,
})

describe('Player Properties', () => {
  it('距離計算の交換法則', () => {
    fc.assert(
      fc.property(positionArbitrary, positionArbitrary, (pos1, pos2) => {
        const distance1 = calculateDistance(pos1, pos2)
        const distance2 = calculateDistance(pos2, pos1)

        expect(distance1).toBeCloseTo(distance2, 5)
      }),
      { seed: 12345, numRuns: 1000 }
    )
  })

  it('プレイヤー作成の不変条件', async () => {
    await fc.assert(
      fc.asyncProperty(playerArbitrary, async (playerData) => {
        const program = Effect.gen(function* () {
          const service = yield* PlayerService
          return yield* service.create(playerData)
        })

        const result = await Effect.runPromise(program.pipe(Effect.provide(TestPlayerServiceLive)))

        // 不変条件1: ヘルスは0-100の範囲内
        expect(result.health).toBeGreaterThanOrEqual(0)
        expect(result.health).toBeLessThanOrEqual(100)

        // 不変条件2: 位置のY座標は有効範囲内
        expect(result.position.y).toBeGreaterThanOrEqual(-64)
        expect(result.position.y).toBeLessThanOrEqual(320)
      }),
      { seed: 24680, numRuns: 300 }
    )
  })
})
```

---

## 💡 Part III: 実践的テストパターン

### よくあるテストパターン

#### 境界値テスト

```typescript
describe('境界値テスト', () => {
  it('座標の境界値をテスト', () => {
    // Y座標の最小値・最大値
    expect(PositionOps.isValid({ x: 0, y: -64, z: 0 })).toBe(true) // 最小値
    expect(PositionOps.isValid({ x: 0, y: 320, z: 0 })).toBe(true) // 最大値
    expect(PositionOps.isValid({ x: 0, y: -65, z: 0 })).toBe(false) // 最小値-1
    expect(PositionOps.isValid({ x: 0, y: 321, z: 0 })).toBe(false) // 最大値+1
  })
})
```

#### 異常系テスト

```typescript
describe('異常系テスト', () => {
  it('無効な入力に対する適切な処理', () => {
    // NaNの処理
    const pos1 = { x: 0, y: 0, z: 0 }
    const pos2 = { x: NaN, y: 0, z: 0 }

    const result = PositionOps.distance(pos1, pos2)

    expect(Number.isNaN(result)).toBe(true) // NaNが返される
  })
})
```

#### 複数パターンのテスト

```typescript
describe('複数パターンのテスト', () => {
  // テスト.each を使った効率的なパターンテスト
  it.each([
    [{ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }, 5],
    [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0],
    [{ x: 1, y: 1, z: 1 }, { x: 4, y: 5, z: 6 }, Math.sqrt(50)],
  ])('distance(%o, %o) = %f', (pos1, pos2, expected) => {
    const result = PositionOps.distance(pos1, pos2)
    expect(result).toBeCloseTo(expected, 2)
  })
})
```

### テストの組織化とベストプラクティス

#### テストファイルの構成

```
src/
├── domain/
│   ├── position.ts
│   ├── position.test.ts    # ✅ 同じディレクトリに配置
│   ├── block.ts
│   ├── block.test.ts
│   └── player/
│       ├── player.ts
│       └── player.test.ts  # ✅ サブディレクトリでも同じ構造
```

#### テスト命名規則

```typescript
describe('テスト対象のクラス/関数名', () => {
  describe('メソッド名/機能名', () => {
    it('期待される動作を日本語で明確に記述', () => {
      // テストコード
    })

    it('異常系: エラー条件での動作を明記', () => {
      // エラー系テストコード
    })
  })
})
```

### デバッグ技術

```typescript
describe('デバッグ技術', () => {
  it('console.logを使った値確認', () => {
    const pos1 = { x: 0, y: 0, z: 0 }
    const pos2 = { x: 3, y: 4, z: 0 }

    console.log('入力値:', { pos1, pos2 }) // デバッグ出力

    const result = PositionOps.distance(pos1, pos2)

    console.log('計算結果:', result) // デバッグ出力

    expect(result).toBe(5)
  })

  it('中間値のアサーションで問題箇所を特定', () => {
    const pos1 = { x: 0, y: 0, z: 0 }
    const pos2 = { x: 3, y: 4, z: 0 }

    // 計算過程を分解してテスト
    const deltaX = pos2.x - pos1.x
    const deltaY = pos2.y - pos1.y
    const deltaZ = pos2.z - pos1.z

    expect(deltaX).toBe(3)
    expect(deltaY).toBe(4)
    expect(deltaZ).toBe(0)

    const sumSquares = deltaX ** 2 + deltaY ** 2 + deltaZ ** 2
    expect(sumSquares).toBe(25)

    const result = Math.sqrt(sumSquares)
    expect(result).toBe(5)
  })
})
```

## 🎯 今回学んだこと

- ✅ テストの基本概念と重要性
- ✅ Vitestの基本的な使い方（describe、it、expect）
- ✅ 基本的なアサーションパターン
- ✅ Effect-TSとSchemaを活用したテスト
- ✅ Property-Based Testingの基礎
- ✅ Layer-basedモックシステム
- ✅ 実践的なテストパターンとデバッグ技術

## 📚 次に学ぶべきこと

1. **[包括的テスト戦略](./comprehensive-testing-strategy.md)** - Flaky Test排除、大規模テスト戦略
2. **[高度なテスト技術](./advanced-testing-techniques.md)** - モッキング、統合テスト
3. **[Effect-TSテストパターン](./effect-ts-testing-patterns.md)** - 専門的なEffect-TSパターン
4. **[PBT実装例](./pbt-implementation-examples.md)** - Property-Based Testing実践

## ✍️ 実践課題

以下のコンポーネントに対して、今回学んだパターンでテストを書いてみましょう：

```typescript
// 課題1: ChunkOps.toId のテスト
expect(ChunkOps.toId({ x: 5, z: -3 })).toBe('chunk_5_-3')

// 課題2: PlayerOps.move の境界値テスト
// Y座標が-64未満または320超過の場合の動作をテスト

// 課題3: BlockOps.getDrops の複数パターンテスト
// 異なるブロックタイプでのドロップアイテム検証
```

---

## まとめ

`★ Learning Achievements ─────────────────────────────────`
このガイドでTypescriptテストの基礎からEffect-TS統合まで習得：

1. **基礎テストパターン**: AAA パターン、アサーション、デバッグ技術
2. **Effect-TS統合**: Schema-first Testing、Layer-based Mocking
3. **実践的パターン**: Property-Based Testing、境界値テスト

Minecraftプロジェクト特有の座標、ブロック、プレイヤーエンティティのテストパターンを通じて、実用的なテスト作成技術を学習しました。次は高度なテスト戦略で更なるスキルアップを目指しましょう。
`─────────────────────────────────────────────────────`

> 🔗 **Next Steps**: [包括的テスト戦略](./comprehensive-testing-strategy.md) - Flaky Test完全排除、レイヤー別テスト戦略、Property-Based Testing完全版
