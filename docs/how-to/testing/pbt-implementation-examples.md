---
title: 'PBT実装例 - Property-Based Testingパターン'
description: 'TypeScript MinecraftでのProperty-Based Testing実装例。Effect-TSと統合した純粋関数のテスト方法。'
category: 'how-to'
difficulty: 'intermediate'
tags: ['pbt', 'testing', 'effect-ts', 'pure-functions']
prerequisites: ['effect-ts-fundamentals', 'testing-basics']
estimated_reading_time: '15分'
related_patterns: ['testing-guide']
related_docs: ['./testing-guide.md', './advanced-testing-techniques.md']
---

# PBT実装例 - Property-Based Testing

## 概要

Property-Based Testing (PBT)を使用してTypeScript Minecraftの純粋関数をテストする具体的な実装例です。Effect-TSパターンと統合したテスト可能な関数の設計とテスト実装を示します。

## ワールドシステムのPBT実装

### チャンク座標計算のテスト

```typescript
import { Match, pipe } from 'effect'
import fc from 'fast-check'

// チャンク座標計算（テスト可能）
export const getChunkKey = (x: number, z: number): string => `${x},${z}`

export const parseChunkKey = (key: string): { x: number; z: number } => {
  const [x, z] = key.split(',').map(Number)
  return { x, z }
}

// バイオーム判定（テスト可能）
export const getBiomeFromClimate = (temperature: number, humidity: number): BiomeType =>
  pipe(
    Match.value({ temperature, humidity }),
    Match.when({ temperature: (t) => t < 0.2 }, () => 'tundra' as const),
    Match.when({ temperature: (t) => t > 0.8, humidity: (h) => h > 0.8 }, () => 'jungle' as const),
    Match.when({ temperature: (t) => t > 0.6, humidity: (h) => h < 0.3 }, () => 'desert' as const),
    Match.when({ humidity: (h) => h > 0.5 }, () => 'forest' as const),
    Match.orElse(() => 'plains' as const)
  )

// PBTテスト
test.prop([fc.integer(), fc.integer()])('chunk key is reversible', (x, z) => {
  const key = getChunkKey(x, z)
  const parsed = parseChunkKey(key)
  expect(parsed).toEqual({ x, z })
})
```

## プレイヤーシステムのPBT実装

### 移動計算のテスト

```typescript
import { Match, pipe } from 'effect'
import fc from 'fast-check'

// ジャンプ速度計算（テスト可能）
export const calculateJumpVelocity = (jumpHeight: number, gravity: number = 9.8): number =>
  Math.sqrt(2 * gravity * jumpHeight)

// 移動速度制限（テスト可能）
export const clampVelocity = (velocity: Vector3, maxSpeed: number): Vector3 => {
  const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
  return pipe(
    Match.value(speed),
    Match.when(
      (s) => s <= maxSpeed,
      () => velocity
    ),
    Match.orElse(() => {
      const scale = maxSpeed / speed
      return {
        x: velocity.x * scale,
        y: velocity.y * scale,
        z: velocity.z * scale,
      }
    })
  )
}

// スニーク速度調整（テスト可能）
export const applySneakModifier = (baseSpeed: number, isSneaking: boolean): number =>
  pipe(
    Match.value(isSneaking),
    Match.when(true, () => baseSpeed * 0.3),
    Match.orElse(() => baseSpeed)
  )

// PBTテスト
test.prop([fc.float({ min: 0, max: 10 })])('jump velocity physics is correct', (height) => {
  const velocity = calculateJumpVelocity(height)
  // v^2 = 2ghの検証
  const calculatedHeight = velocity ** 2 / (2 * 9.8)
  expect(calculatedHeight).toBeCloseTo(height, 5)
})

test.prop([
  fc.record({
    x: fc.float({ min: -100, max: 100 }),
    y: fc.float({ min: -100, max: 100 }),
    z: fc.float({ min: -100, max: 100 }),
  }),
  fc.float({ min: 1, max: 50 }),
])('velocity clamping preserves direction', (velocity, maxSpeed) => {
  const clamped = clampVelocity(velocity, maxSpeed)
  const originalMagnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)

  if (originalMagnitude <= maxSpeed) {
    // 制限以下の場合は変更されない
    expect(clamped).toEqual(velocity)
  } else {
    // 制限を超える場合は方向を保持して制限される
    const clampedMagnitude = Math.sqrt(clamped.x ** 2 + clamped.y ** 2 + clamped.z ** 2)
    expect(clampedMagnitude).toBeCloseTo(maxSpeed, 5)

    // 方向の保持を確認（ゼロベクトルでない場合）
    if (originalMagnitude > 0) {
      const originalDirection = {
        x: velocity.x / originalMagnitude,
        y: velocity.y / originalMagnitude,
        z: velocity.z / originalMagnitude,
      }
      const clampedDirection = {
        x: clamped.x / clampedMagnitude,
        y: clamped.y / clampedMagnitude,
        z: clamped.z / clampedMagnitude,
      }

      expect(clampedDirection.x).toBeCloseTo(originalDirection.x, 5)
      expect(clampedDirection.y).toBeCloseTo(originalDirection.y, 5)
      expect(clampedDirection.z).toBeCloseTo(originalDirection.z, 5)
    }
  }
})
```

## PBTの設計原則

### 1. 純粋関数の設計

- **副作用なし**: すべての関数は入力のみに依存
- **決定論的**: 同じ入力に対して常に同じ出力
- **参照透明**: 関数呼び出しを戻り値で置き換え可能

### 2. プロパティの定義

- **可逆性**: encode/decode関数の往復変換
- **不変性**: 変換後も保持される性質
- **制約**: 出力が満たすべき制約条件

### 3. テストデータ生成

- **境界値**: 最小値・最大値・ゼロ
- **ランダム値**: 広範囲のランダムデータ
- **組み合わせ**: 複数パラメータの組み合わせ

## 実装のベストプラクティス

### Effect-TSパターンとの統合

```typescript
import { Effect, pipe } from 'effect'

// Effect統合パターン
export const calculateJumpVelocityEffect = (
  jumpHeight: number,
  gravity: number = 9.8
): Effect.Effect<number, never, never> => Effect.succeed(Math.sqrt(2 * gravity * jumpHeight))

// PBTテスト（Effect版）
test.prop([fc.float({ min: 0, max: 10 })])('jump velocity effect is correct', (height) => {
  return Effect.runPromise(
    Effect.gen(function* () {
      const velocity = yield* calculateJumpVelocityEffect(height)
      const calculatedHeight = velocity ** 2 / (2 * 9.8)
      expect(calculatedHeight).toBeCloseTo(height, 5)
      return velocity
    })
  )
})
```

### エラーケースのテスト

```typescript
test.prop([fc.float({ min: -10, max: 0 })])('negative jump height handling', (negativeHeight) => {
  expect(() => calculateJumpVelocity(negativeHeight)).toThrow('Jump height must be positive')
})
```

## 関連ドキュメント

- [テストガイド](./testing-guide.md) - 基本的なテスト戦略
- [高度なテスト手法](./advanced-testing-techniques.md) - 統合テスト・E2Eテスト
- [Effect-TSテストパターン](./effect-ts-testing-patterns.md) - Effect-TS特化のテスト手法
