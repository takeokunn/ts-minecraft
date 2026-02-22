---
title: 'Effect-TS Type System Migration Guide'
description: 'Complete guide for migrating TypeScript interfaces to Effect-TS Schema.Struct patterns'
category: 'migration'
difficulty: 'advanced'
tags: ['effect-ts', 'migration', 'schema', 'brand-types', 'type-safety']
last_updated: '2024-12-24'
---

# Effect-TS Type System Migration Guide

## 概要

本ガイドでは、TypeScript Minecraft CloneプロジェクトにおけるEffect-TS型システムへの完全移行プロセスを説明します。従来のinterfaceからSchema.Structベースの型安全なシステムへの移行方法を詳述します。

## 移行の目標

### コンパイル時安全性

- **Brand型の活用**: プリミティブ型の混同防止
- **Schema.Struct**: 実行時検証付きの型定義
- **unknown型の排除**: 具体的な型による置換

### ランタイム安全性

- **自動検証**: Schema.decode による入力値検証
- **エラーハンドリング**: 構造化エラーと型安全な処理
- **境界層保護**: 外部データの厳密な検証

### パフォーマンス

- **不変性**: ReadonlyArray/HashMap による効率的な操作
- **検証の最適化**: 必要箇所での選択的検証
- **60FPS維持**: ゲームループでの軽量検証

## Brand型実装パターン

### 基本的なBrand型

```typescript
import { Schema } from '@effect/schema'

// 数値Brand型（検証付き）
export const HealthSchema = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('Health'),
  Schema.annotations({
    title: 'Health',
    description: 'Player health points (0-20)',
    examples: [20, 15, 5, 0],
  })
)
export type Health = Schema.Schema.Type<typeof HealthSchema>

// 文字列Brand型（パターン検証付き）
export const PlayerIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'Unique identifier for a player',
    examples: ['player_123', 'user_abc'],
  })
)
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>
```

### 構造体Brand型

```typescript
// 3Dベクトル
export const Vector3DSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
}).pipe(
  Schema.brand('Vector3D'),
  Schema.annotations({
    title: 'Vector3D',
    description: '3D vector with x, y, z components',
    examples: [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ],
  })
)
export type Vector3D = Schema.Schema.Type<typeof Vector3DSchema>
```

### 安全な作成ヘルパー

```typescript
export const GameBrands = {
  createHealth: (value: number): Health => Schema.decodeSync(HealthSchema)(value),

  fullHealth: (): Health => Schema.decodeSync(HealthSchema)(20),

  createPlayerId: (id: string): PlayerId => Schema.decodeSync(PlayerIdSchema)(id),
} as const
```

## Schema.Struct移行パターン

### Interface → Schema.Struct変換

```typescript
// ❌ Before: interface
export interface PlayerState {
  readonly playerId: string
  readonly health: number
  readonly position: { x: number; y: number; z: number }
  readonly isActive: boolean
  readonly lastUpdate: number
}

// ✅ After: Schema.Struct
export const PlayerStateSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  health: HealthSchema,
  position: Vector3DSchema,
  isActive: Schema.Boolean,
  lastUpdate: TimestampSchema,
}).pipe(
  Schema.annotations({
    title: 'PlayerState',
    description: 'Complete player state with branded types',
  })
)
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>
```

### エラー型の移行

```typescript
// ❌ Before: interface
export interface PlayerError {
  readonly _tag: 'PlayerError'
  readonly message: string
  readonly cause?: unknown
}

// ✅ After: Schema.Struct
export const PlayerErrorSchema = Schema.Struct({
  _tag: Schema.Literal('PlayerError'),
  message: Schema.String,
  playerId: Schema.optional(PlayerIdSchema),
  cause: Schema.optional(Schema.Unknown),
}).pipe(
  Schema.annotations({
    title: 'PlayerError',
    description: 'Player operation error with context',
  })
)
export type PlayerError = Schema.Schema.Type<typeof PlayerErrorSchema>
```

## Collection移行パターン

### Array → ReadonlyArray

```typescript
// ❌ Before: mutable arrays
slots: Schema.Array(Schema.NullOr(ItemStack))
enchantments: Schema.Array(EnchantmentSchema)

// ✅ After: immutable arrays
slots: Schema.ReadonlyArray(Schema.NullOr(ItemStack))
enchantments: Schema.ReadonlyArray(EnchantmentSchema)
```

### Map/Set → HashMap/HashSet

```typescript
import { HashMap, HashSet } from 'effect'

// ❌ Before: mutable collections
const playerMap = new Map<PlayerId, PlayerState>()
const activePlayerSet = new Set<PlayerId>()

// ✅ After: immutable collections
const playerMap = HashMap.empty<PlayerId, PlayerState>()
const activePlayerSet = HashSet.empty<PlayerId>()

// Immutable operations
const updatedMap = HashMap.set(playerMap, playerId, newState)
const updatedSet = HashSet.add(activePlayerSet, playerId)
```

## 検証とエラーハンドリング

### Schema検証関数

```typescript
import { Effect, pipe } from 'effect'

// 安全な検証ヘルパー
export const validatePlayerState = (state: unknown): Effect.Effect<PlayerState, PlayerError> =>
  pipe(
    Schema.decodeUnknown(PlayerStateSchema)(state),
    Effect.mapError((parseError) =>
      PlayerError({
        message: `Player state validation failed: ${parseError.message}`,
        cause: state,
      })
    )
  )

// Effect統合での検証
export const updatePlayer = (playerId: PlayerId, data: unknown) =>
  pipe(
    validatePlayerUpdateData(data),
    Effect.flatMap((validData) => playerService.update(playerId, validData)),
    Effect.catchTag('ValidationError', (error) => Effect.logError(`Validation failed: ${error.message}`))
  )
```

### エラー型の統合

```typescript
// 全エラー型の統一
const AllErrorsUnion = Schema.Union(PlayerErrorSchema, GameErrorSchema, NetworkErrorSchema)

// 型安全なエラーハンドリング
export const handleError = (error: unknown): Effect.Effect<string> =>
  pipe(
    Schema.decodeUnknownEither(AllErrorsUnion)(error),
    Either.match({
      onLeft: () => `Unknown error: ${String(error)}`,
      onRight: (knownError) => `${knownError._tag}: ${knownError.message}`,
    }),
    Effect.succeed
  )
```

## Service層パターン

### Effect-TS Service定義

```typescript
export interface PlayerService {
  readonly createPlayer: (config: PlayerConfig) => Effect.Effect<PlayerId, PlayerError>
  readonly getPlayer: (id: PlayerId) => Effect.Effect<PlayerState, PlayerError>
  readonly updatePlayer: (id: PlayerId, data: unknown) => Effect.Effect<void, PlayerError>
}

export const PlayerService = Context.GenericTag<PlayerService>('@minecraft/PlayerService')
```

### Layer実装

```typescript
export const PlayerServiceLive = Layer.effect(
  PlayerService,
  Effect.gen(function* () {
    const entityManager = yield* EntityManager
    const storage = HashMap.empty<PlayerId, PlayerState>()

    return PlayerService.of({
      createPlayer: (config) =>
        pipe(
          validatePlayerConfig(config),
          Effect.flatMap((validConfig) => createPlayerEntity(validConfig, entityManager)),
          Effect.tap((playerId) => Effect.sync(() => storage.set(playerId, initialPlayerState(validConfig))))
        ),

      getPlayer: (id) =>
        pipe(
          HashMap.get(storage, id),
          Option.match({
            onNone: () => Effect.fail(PlayerError({ message: `Player ${id} not found` })),
            onSome: (state) => Effect.succeed(state),
          })
        ),
    })
  })
)
```

## パフォーマンス最適化

### 選択的検証

```typescript
// 開発環境: 完全検証
const validateInDevelopment =
  <T>(schema: Schema.Schema<T, unknown>) =>
  (value: unknown) =>
    NODE_ENV === 'development' ? Schema.decodeUnknown(schema)(value) : Effect.succeed(value as T)

// ゲームループ: 軽量検証
const validateInGameLoop = <T>(value: T): Effect.Effect<T> => Effect.succeed(value) // 型レベルでの安全性に依存
```

### バッチ処理

```typescript
// 大量データの効率的処理
const validatePlayerBatch = (players: unknown[]) =>
  pipe(
    players,
    ReadonlyArray.map(validatePlayerState),
    Effect.all({ concurrency: 'unbounded' }),
    Effect.timeout('5 seconds')
  )
```

## テスト戦略

### Property-Based Testing

```typescript
import { describe, it, expect } from 'vitest'

describe('PlayerState Schema', () => {
  it('validates correct player state', () => {
    const validState = {
      playerId: 'player_123',
      health: 20,
      position: { x: 0, y: 64, z: 0 },
      isActive: true,
      lastUpdate: Date.now(),
    }

    expect(() => Schema.decodeSync(PlayerStateSchema)(validState)).not.toThrow()
  })

  it('rejects invalid health values', () => {
    const invalidState = {
      playerId: 'player_123',
      health: -5, // Invalid: negative health
      position: { x: 0, y: 64, z: 0 },
      isActive: true,
      lastUpdate: Date.now(),
    }

    expect(() => Schema.decodeSync(PlayerStateSchema)(invalidState)).toThrow()
  })
})
```

### Effect Integration Testing

```typescript
const testPlayerService = Effect.gen(function* () {
  const playerId = yield* PlayerService.createPlayer({
    playerId: 'test_player',
    initialPosition: { x: 0, y: 64, z: 0 },
  })

  const player = yield* PlayerService.getPlayer(playerId)
  expect(player.health).toBe(20)
}).pipe(Effect.provide(TestPlayerServiceLayer))
```

## 移行チェックリスト

### ステップ1: Brand型準備

- [ ] 既存のプリミティブ型を特定
- [ ] Brand型スキーマを定義
- [ ] 検証ルールを追加
- [ ] ヘルパー関数を実装
- [ ] Unit testを作成

### ステップ2: Interface移行

- [ ] 対象interfaceを特定
- [ ] Schema.Structに変換
- [ ] Brand型を統合
- [ ] アノテーションを追加
- [ ] 型エクスポートを更新

### ステップ3: Collection更新

- [ ] Array → ReadonlyArray
- [ ] Map → HashMap
- [ ] Set → HashSet
- [ ] 不変操作に変更

### ステップ4: 検証追加

- [ ] 検証関数を実装
- [ ] エラーハンドリングを統合
- [ ] Effect統合を完了
- [ ] パフォーマンステストを実行

### ステップ5: テスト更新

- [ ] 既存テストを更新
- [ ] Schema検証テストを追加
- [ ] Property-based testを実装
- [ ] 統合テストを確認

## トラブルシューティング

### よくある問題

**問題**: `Type 'number' is not assignable to type 'number & Brand<"Health">'`
**解決**: Brand型作成ヘルパーを使用

```typescript
// ❌ 直接代入
const health: Health = 20

// ✅ ヘルパー使用
const health = GameBrands.createHealth(20)
```

**問題**: Schema検証でのパフォーマンス低下
**解決**: 選択的検証とバッチ処理

```typescript
// 重い検証は境界層のみで実行
const validateAtBoundary = process.env.NODE_ENV === 'development'
```

**問題**: 循環参照エラー
**解決**: Schema.suspend使用

```typescript
const PlayerSchema: Schema.Schema<Player> = Schema.suspend(() =>
  Schema.Struct({
    id: PlayerIdSchema,
    friends: Schema.ReadonlyArray(PlayerSchema), // 循環参照
  })
)
```

## 関連資料

- [Effect-TS公式ドキュメント](https://effect.website/)
- [Schema API リファレンス](https://effect.website/docs/schema/introduction)
- [Brand Types ガイド](https://effect.website/docs/schema/branded-types)
- [プロジェクト実装例](/src/shared/types/)

## 継続的改善

この移行は継続的なプロセスです。新機能の追加時には必ずこのパターンに従い、既存コードも段階的に移行を進めてください。パフォーマンス測定を定期的に実施し、必要に応じて最適化を行ってください。
