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
import { Effect, Match, pipe, Schema, STM, Layer, Context } from 'effect'
import { Arbitrary } from '@effect/schema/Arbitrary'
import * as fc from 'fast-check'
import { describe, it, expect } from '@fast-check/vitest'

// Schema定義によるチャンク座標システム
const ChunkCoordSchema = Schema.Struct({
  x: Schema.Number,
  z: Schema.Number,
})

const chunkCoordArbitrary = Arbitrary.make(ChunkCoordSchema)

// チャンク座標計算（テスト可能）
export const getChunkKey = (x: number, z: number): string => `${x},${z}`

export const parseChunkKey = (key: string): { x: number; z: number } => {
  const [x, z] = key.split(',').map(Number)
  return { x, z }
}

// Schema定義によるバイオーム判定
const ClimateSchema = Schema.Struct({
  temperature: Schema.Number.pipe(Schema.between(0, 1)),
  humidity: Schema.Number.pipe(Schema.between(0, 1)),
})

const BiomeSchema = Schema.Literal('tundra', 'jungle', 'desert', 'forest', 'plains')

// Effect-TSでのバイオーム判定
export const getBiomeFromClimate = (
  climate: Schema.Schema.Type<typeof ClimateSchema>
): Effect.Effect<Schema.Schema.Type<typeof BiomeSchema>, never, never> =>
  Effect.succeed(
    pipe(
      Match.value(climate),
      Match.when({ temperature: (t) => t < 0.2 }, () => 'tundra' as const),
      Match.when({ temperature: (t) => t > 0.8, humidity: (h) => h > 0.8 }, () => 'jungle' as const),
      Match.when({ temperature: (t) => t > 0.6, humidity: (h) => h < 0.3 }, () => 'desert' as const),
      Match.when({ humidity: (h) => h > 0.5 }, () => 'forest' as const),
      Match.orElse(() => 'plains' as const)
    )
  )

// Effect-TS統合PBTテスト
describe('Chunk System', () => {
  it.prop([chunkCoordArbitrary])('chunk key is reversible', (coord) =>
    Effect.gen(function* () {
      const key = getChunkKey(coord.x, coord.z)
      const parsed = parseChunkKey(key)
      expect(parsed).toEqual({ x: coord.x, z: coord.z })
    })
  )

  it.prop([fc.integer(), fc.integer()])('chunk coordinate conversion maintains bounds', (x, z) =>
    Effect.gen(function* () {
      const key = getChunkKey(x, z)
      const parsed = parseChunkKey(key)

      // 座標変換の不変条件
      expect(parsed.x).toBe(x)
      expect(parsed.z).toBe(z)
      expect(typeof parsed.x).toBe('number')
      expect(typeof parsed.z).toBe('number')
    })
  )
})
```

## プレイヤーシステムのPBT実装

### 移動計算のテスト

```typescript
import { Effect, Match, pipe, Schema, STM, Layer, Context } from 'effect'
import { Arbitrary } from '@effect/schema/Arbitrary'
import * as fc from 'fast-check'
import { describe, it, expect } from '@fast-check/vitest'

// Physics Service定義
interface PhysicsService {
  readonly calculateJumpVelocity: (height: number, gravity?: number) => Effect.Effect<number, PhysicsError>
  readonly simulatePhysics: (entities: Entity[], deltaTime: number) => Effect.Effect<Entity[], PhysicsError>
}

const PhysicsService = Context.GenericTag<PhysicsService>('@app/PhysicsService')

// エラーハンドリング統合
class PhysicsError extends Schema.TaggedError<PhysicsError>()('PhysicsError', {
  message: Schema.String,
  code: Schema.Literal('INVALID_HEIGHT', 'SIMULATION_FAILED'),
}) {}

// ジャンプ速度計算（Effect統合）
export const calculateJumpVelocity = (
  jumpHeight: number,
  gravity: number = 9.8
): Effect.Effect<number, PhysicsError> =>
  jumpHeight < 0
    ? Effect.fail(new PhysicsError({ message: 'Jump height must be positive', code: 'INVALID_HEIGHT' }))
    : Effect.succeed(Math.sqrt(2 * gravity * jumpHeight))

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

// Layer-based テスト環境構築
const createTestPhysicsLayer = () =>
  Layer.succeed(PhysicsService, {
    calculateJumpVelocity: (height: number, gravity = 9.8) =>
      height < 0
        ? Effect.fail(new PhysicsError({ message: 'Jump height must be positive', code: 'INVALID_HEIGHT' }))
        : Effect.succeed(Math.sqrt(2 * gravity * height)),
    simulatePhysics: (entities: Entity[], deltaTime: number) =>
      Effect.gen(function* () {
        // STMを使用した並行性テスト実装
        const results = yield* Effect.allPar(
          entities.map((entity) =>
            STM.gen(function* () {
              const positionRef = yield* STM.makeRef(entity.position)
              const velocityRef = yield* STM.makeRef(entity.velocity)

              const currentPos = yield* STM.get(positionRef)
              const currentVel = yield* STM.get(velocityRef)

              const newPos = {
                x: currentPos.x + currentVel.x * deltaTime,
                y: currentPos.y + currentVel.y * deltaTime,
                z: currentPos.z + currentVel.z * deltaTime,
              }

              yield* STM.set(positionRef, newPos)
              return { ...entity, position: newPos }
            }).pipe(STM.commit)
          ),
          { concurrency: 10 }
        )
        return results
      }),
  })

// Schema-based Arbitrary定義
const JumpDataSchema = Schema.Struct({
  height: Schema.Number.pipe(Schema.between(0, 10)),
  gravity: Schema.optional(Schema.Number.pipe(Schema.between(1, 20))),
})

const jumpDataArbitrary = Arbitrary.make(JumpDataSchema)

// Effect統合PBTテスト
describe('Physics System', () => {
  it.prop([jumpDataArbitrary])('jump velocity physics is correct', (jumpData) =>
    Effect.gen(function* () {
      const physicsService = yield* PhysicsService
      const velocity = yield* physicsService.calculateJumpVelocity(jumpData.height, jumpData.gravity)

      // v² = 2ghの検証
      const gravity = jumpData.gravity ?? 9.8
      const calculatedHeight = velocity ** 2 / (2 * gravity)
      expect(calculatedHeight).toBeCloseTo(jumpData.height, 5)
    }).pipe(Effect.provide(createTestPhysicsLayer()))
  )
})

// Schema-firstアプローチでのVelocityテスト
const Vector3Schema = Schema.Struct({
  x: Schema.Number.pipe(Schema.between(-100, 100)),
  y: Schema.Number.pipe(Schema.between(-100, 100)),
  z: Schema.Number.pipe(Schema.between(-100, 100)),
})

const VelocityTestDataSchema = Schema.Struct({
  velocity: Vector3Schema,
  maxSpeed: Schema.Number.pipe(Schema.between(1, 50)),
})

const velocityTestArbitrary = Arbitrary.make(VelocityTestDataSchema)

// STM統合による並行性テスト
describe('Velocity System', () => {
  it.prop([velocityTestArbitrary])('velocity clamping preserves direction with STM', (testData) =>
    Effect.gen(function* () {
      const { velocity, maxSpeed } = testData

      // STMを使用した原子的操作
      const velocityRef = yield* STM.makeRef(velocity)

      const clampOperation = STM.gen(function* () {
        const currentVelocity = yield* STM.get(velocityRef)
        const clamped = clampVelocity(currentVelocity, maxSpeed)
        yield* STM.set(velocityRef, clamped)
        return { original: currentVelocity, clamped }
      })

      const result = yield* STM.commit(clampOperation)
      const { original, clamped } = result

      const originalMagnitude = Math.sqrt(original.x ** 2 + original.y ** 2 + original.z ** 2)

      if (originalMagnitude <= maxSpeed) {
        expect(clamped).toEqual(original)
      } else {
        const clampedMagnitude = Math.sqrt(clamped.x ** 2 + clamped.y ** 2 + clamped.z ** 2)
        expect(clampedMagnitude).toBeCloseTo(maxSpeed, 5)

        // 方向保持の検証（非ゼロベクトル）
        if (originalMagnitude > 0) {
          const dotProduct =
            (original.x * clamped.x + original.y * clamped.y + original.z * clamped.z) /
            (originalMagnitude * clampedMagnitude)
          expect(dotProduct).toBeCloseTo(1, 5) // 方向が同じならcos(0) = 1
        }
      }
    })
  )
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

### Effect-TS 3.17+ パターン統合

```typescript
import { Effect, Layer, Context, Schema, STM, Duration } from 'effect'
import { Arbitrary } from '@effect/schema/Arbitrary'
import * as fc from 'fast-check'
import { describe, it, expect } from '@fast-check/vitest'

// Service定義とSchema統合
interface PhysicsService {
  readonly calculateJumpVelocity: (height: number, gravity?: number) => Effect.Effect<number, PhysicsError>
  readonly simulatePhysics: (entities: Entity[], deltaTime: number) => Effect.Effect<Entity[], PhysicsError>
}

const PhysicsService = Context.GenericTag<PhysicsService>('@app/PhysicsService')

// エラーハンドリング統合
class PhysicsError extends Schema.TaggedError<PhysicsError>()('PhysicsError', {
  message: Schema.String,
  code: Schema.Literal('INVALID_HEIGHT', 'SIMULATION_FAILED'),
}) {}

// 実装パターン
export const PhysicsServiceLive = Layer.succeed(PhysicsService, {
  calculateJumpVelocity: (height: number, gravity = 9.8) =>
    height < 0
      ? Effect.fail(new PhysicsError({ message: 'Jump height must be positive', code: 'INVALID_HEIGHT' }))
      : Effect.succeed(Math.sqrt(2 * gravity * height)),

  simulatePhysics: (entities: Entity[], deltaTime: number) =>
    Effect.gen(function* () {
      const results = yield* Effect.allPar(
        entities.map((entity) =>
          STM.gen(function* () {
            const positionRef = yield* STM.makeRef(entity.position)
            const velocityRef = yield* STM.makeRef(entity.velocity)

            // 物理計算の原子的実行
            const currentPos = yield* STM.get(positionRef)
            const currentVel = yield* STM.get(velocityRef)

            const newPos = {
              x: currentPos.x + currentVel.x * deltaTime,
              y: currentPos.y + currentVel.y * deltaTime,
              z: currentPos.z + currentVel.z * deltaTime,
            }

            yield* STM.set(positionRef, newPos)
            return { ...entity, position: newPos }
          }).pipe(STM.commit)
        ),
        { concurrency: 10 }
      )
      return results
    }),
})

// Schema-based テストデータ生成
const PhysicsTestDataSchema = Schema.Struct({
  height: Schema.Number.pipe(Schema.between(0, 100)),
  gravity: Schema.optional(Schema.Number.pipe(Schema.between(1, 20))),
  entities: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      position: Vector3Schema,
      velocity: Vector3Schema,
    })
  ).pipe(Schema.maxItems(10)),
})

const physicsTestArbitrary = Arbitrary.make(PhysicsTestDataSchema)

// 高度なPBTテスト実装
describe('Advanced Physics PBT', () => {
  it.prop([physicsTestArbitrary])('concurrent physics simulation maintains invariants', (testData) =>
    Effect.gen(function* () {
      const physicsService = yield* PhysicsService

      // 並行実行での不変条件検証
      const results = yield* Effect.allPar([
        physicsService.simulatePhysics(testData.entities, 0.016),
        physicsService.simulatePhysics(testData.entities, 0.016),
        physicsService.simulatePhysics(testData.entities, 0.016),
      ])

      // 各実行結果の一貫性検証
      const [result1, result2, result3] = results
      expect(result1.length).toBe(testData.entities.length)
      expect(result2.length).toBe(testData.entities.length)
      expect(result3.length).toBe(testData.entities.length)

      // エネルギー保存則（簡単な例）
      result1.forEach((entity, i) => {
        const originalEntity = testData.entities[i]
        const originalEnergy = Math.sqrt(
          originalEntity.velocity.x ** 2 + originalEntity.velocity.y ** 2 + originalEntity.velocity.z ** 2
        )
        const newEnergy = Math.sqrt(entity.velocity.x ** 2 + entity.velocity.y ** 2 + entity.velocity.z ** 2)
        // 摩擦がない場合のエネルギー保存
        expect(newEnergy).toBeCloseTo(originalEnergy, 2)
      })
    }).pipe(Effect.provide(PhysicsServiceLive))
  )
})
```

### エラーケースのEffect統合

```typescript
// Schema-based エラーテスト
const InvalidHeightSchema = Schema.Number.pipe(Schema.lessThan(0))
const invalidHeightArbitrary = Arbitrary.make(InvalidHeightSchema)

describe('Error Handling', () => {
  it.prop([invalidHeightArbitrary])('negative jump height handling with Effect', (negativeHeight) =>
    Effect.gen(function* () {
      const physicsService = yield* PhysicsService
      const result = yield* physicsService.calculateJumpVelocity(negativeHeight).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.code).toBe('INVALID_HEIGHT')
        expect(result.left.message).toContain('positive')
      }
    }).pipe(Effect.provide(PhysicsServiceLive))
  )

  // Timeoutテスト
  it.prop([physicsTestArbitrary])('physics simulation completes within timeout', (testData) =>
    Effect.gen(function* () {
      const physicsService = yield* PhysicsService
      const result = yield* physicsService
        .simulatePhysics(testData.entities, 0.016)
        .pipe(Effect.timeout(Duration.millis(100)))
      expect(result.length).toBe(testData.entities.length)
    }).pipe(Effect.provide(PhysicsServiceLive))
  )
})
```

## fast-check 3.15.0+ 新機能活用

### @fast-check/vitest統合

```typescript
import { describe, it, expect } from '@fast-check/vitest'
import * as fc from 'fast-check'

// Vitest統合での高度なテスト
describe('Fast-check Vitest Integration', () => {
  it.prop([fc.integer(), fc.integer()])(
    'mathematical properties with better reporting',
    (a, b) => {
      expect(a + b).toBe(b + a) // 交換法則
      expect(a + (b + 0)).toBe(a + b) // 恒等元
    },
    {
      numRuns: 1000,
      seed: 42,
      verbose: true,
      examples: [
        [0, 0],
        [1, -1],
        [Number.MAX_SAFE_INTEGER, 0],
      ],
    }
  )
})
```

### Schema-driven Arbitrary生成

```typescript
// Effect Schemaとの完全統合
const GameEntitySchema = Schema.Struct({
  id: Schema.String.pipe(Schema.uuid()),
  position: Vector3Schema,
  velocity: Vector3Schema,
  health: Schema.Number.pipe(Schema.between(0, 100)),
  type: Schema.Literal('player', 'mob', 'item'),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.JsonValue)),
})

// 自動生成されるArbitrary
const gameEntityArbitrary = Arbitrary.make(GameEntitySchema)

// 型安全なProperty-Based Testing
it.prop([gameEntityArbitrary])('entity operations maintain schema compliance', (entity) =>
  Effect.gen(function* () {
    // Schemaによる自動バリデーション
    const validated = yield* Schema.decodeUnknown(GameEntitySchema)(entity)
    expect(validated.health).toBeGreaterThanOrEqual(0)
    expect(validated.health).toBeLessThanOrEqual(100)
    expect(['player', 'mob', 'item']).toContain(validated.type)
  })
)
```

## 関連ドキュメント

- [テストガイド](./testing-guide.md) - 基本的なテスト戦略
- [高度なテスト手法](./advanced-testing-techniques.md) - 統合テスト・E2Eテスト
- [Effect-TSテストパターン](./effect-ts-testing-patterns.md) - Effect-TS特化のテスト手法
- [Schema統合ガイド](../schemas/schema-integration-guide.md) - Schema-firstテスト設計
