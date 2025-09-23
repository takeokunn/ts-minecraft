---
title: 'PBTテスト戦略 - Property-Based Testing統合'
description: '純粋関数型設計とProperty-Based Testingの統合戦略。fast-checkとEffect-TSの組み合わせ。'
category: 'specification'
difficulty: 'advanced'
tags: ['testing', 'pbt', 'property-based-testing', 'fast-check', 'effect-ts', 'stm', 'schema', 'vitest']
prerequisites: ['effect-ts-fundamentals', 'testing-fundamentals', 'functional-programming']
estimated_reading_time: '12分'
related_patterns: ['testing-patterns', 'functional-patterns']
related_docs:
  ['../explanations/architecture/06d-effect-ts-testing.md', '../../explanations/design-patterns/02-testing-patterns.md']
---

# PBTテスト戦略

## 概要

Property-Based Testing (PBT) は、関数の性質（プロパティ）を検証することで、より堅牢なテストを実現する手法です。TypeScript Minecraftクローンでは、fast-check 3.15.0+と@fast-check/vitest、Effect-TS 3.17+、STM（Software Transactional Memory）を組み合わせて、ゲームロジックの正確性と並行性を保証しています。

## 1. PBT対応の純粋関数型設計

### 単一責任原則の徹底

```typescript
import { Effect, Schema, STM, Layer, Context } from 'effect'
import { Arbitrary } from '@effect/schema/Arbitrary'
import { describe, it, expect } from '@fast-check/vitest'
import * as fc from 'fast-check'

// Schema-first approach for type-safe PBT
const WorldCoordSchema = Schema.Number
const ChunkCoordSchema = Schema.Number
const LightLevelSchema = Schema.Number.pipe(Schema.between(0, 15))

// Service interfaces for dependency injection
interface WorldService {
  readonly worldToChunkCoord: (worldCoord: number) => Effect.Effect<number>
  readonly chunkToWorldCoord: (chunkCoord: number) => Effect.Effect<number>
  readonly combineLightLevels: (blockLight: number, skyLight: number) => Effect.Effect<number>
  readonly calculateLightAttenuation: (sourceLevel: number, distance: number) => Effect.Effect<number>
}

const WorldService = Context.GenericTag<WorldService>('@game/WorldService')

// Pure functions with Effect integration
export const WorldServiceLive = Layer.succeed(WorldService, {
  worldToChunkCoord: (worldCoord: number) =>
    Effect.succeed(Math.floor(worldCoord / 16)),

  chunkToWorldCoord: (chunkCoord: number) =>
    Effect.succeed(chunkCoord * 16),

  combineLightLevels: (blockLight: number, skyLight: number) =>
    Effect.succeed(Math.max(blockLight, skyLight)),

  calculateLightAttenuation: (sourceLevel: number, distance: number) =>
    Effect.succeed(Math.max(0, sourceLevel - distance))
})
```

### 可逆性の性質検証

```typescript
// STM-based concurrent testing for chunk operations
const ChunkOperationSchema = Schema.Struct({
  worldCoord: Schema.Number,
  operations: Schema.Array(Schema.Literal('toChunk', 'toWorld')).pipe(Schema.maxItems(10))
})

const chunkOperationArbitrary = Arbitrary.make(ChunkOperationSchema)

describe('Chunk Coordinate System PBT', () => {
  it.prop([chunkOperationArbitrary])('concurrent chunk operations maintain consistency', (testData) =>
    Effect.gen(function* () {
      const worldService = yield* WorldService

      // STMを使用した並行操作のテスト
      const coordRef = yield* STM.makeRef(testData.worldCoord)

      const concurrentOperations = testData.operations.map(operation =>
        STM.gen(function* () {
          const currentCoord = yield* STM.get(coordRef)

          if (operation === 'toChunk') {
            const chunkCoord = yield* Effect.map(
              worldService.worldToChunkCoord(currentCoord),
              (chunk) => {
                yield* STM.set(coordRef, chunk * 16) // Convert back to world coord
                return chunk
              }
            ).pipe(Effect.runSync)
            return chunkCoord
          } else {
            const worldCoord = yield* Effect.map(
              worldService.chunkToWorldCoord(Math.floor(currentCoord / 16)),
              (world) => {
                yield* STM.set(coordRef, world)
                return world
              }
            ).pipe(Effect.runSync)
            return worldCoord
          }
        })
      )

      // 並行実行での整合性検証
      const results = yield* STM.commit(STM.allPar(concurrentOperations))
      const finalCoord = yield* STM.commit(STM.get(coordRef))

      // 座標変換の不変条件
      const chunkCoord = Math.floor(testData.worldCoord / 16)
      const expectedBase = chunkCoord * 16
      expect(Math.abs(finalCoord - expectedBase)).toBeLessThanOrEqual(15)

      return { results, finalCoord }
    }).pipe(Effect.provide(WorldServiceLive))
  )
})
```

## 2. ECSシステムのPBT統合

### コンポーネント変換関数の検証

```typescript
// 位置コンポーネントの更新（テスト可能）
export const updatePosition = (
  position: PositionComponent,
  velocity: VelocityComponent,
  deltaTime: number
): PositionComponent => ({
  x: position.x + velocity.x * deltaTime,
  y: position.y + velocity.y * deltaTime,
  z: position.z + velocity.z * deltaTime,
})

// 速度コンポーネントの更新（テスト可能）
export const applyFriction = (velocity: VelocityComponent, friction: number): VelocityComponent => ({
  x: velocity.x * (1 - friction),
  y: velocity.y, // Y軸は重力制御
  z: velocity.z * (1 - friction),
})

// システムの合成（小関数の組み合わせ）
export const physicsSystem = (entities: Entity[], deltaTime: number): Entity[] =>
  entities.map((entity) => {
    const position = entity.getComponent(PositionComponent)
    const velocity = entity.getComponent(VelocityComponent)

    if (!position || !velocity) return entity

    return pipe(
      entity,
      (e) => e.setComponent(PositionComponent, updatePosition(position, velocity, deltaTime)),
      (e) => e.setComponent(VelocityComponent, applyFriction(velocity, 0.1))
    )
  })
```

### 線形性の性質検証

```typescript
test.prop([
  fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
  fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
  fc.float({ min: 0, max: 1 }),
])('position update is linear', (pos, vel, dt) => {
  const updated = updatePosition(pos, vel, dt)
  expect(updated.x).toBe(pos.x + vel.x * dt)
  expect(updated.y).toBe(pos.y + vel.y * dt)
  expect(updated.z).toBe(pos.z + vel.z * dt)
})
```

## 3. ワールド生成のPBT検証

### チャンク座標変換の性質

```typescript
// チャンク座標計算（テスト可能）
export const getChunkKey = (x: number, z: number): string => `${x},${z}`

export const parseChunkKey = (key: string): { x: number; z: number } => {
  const [x, z] = key.split(',').map(Number)
  return { x, z }
}

// バイオーム判定（テスト可能）
export const getBiomeFromClimate = (temperature: number, humidity: number): BiomeType => {
  if (temperature < 0.2) return 'tundra'
  if (temperature > 0.8 && humidity > 0.8) return 'jungle'
  if (temperature > 0.6 && humidity < 0.3) return 'desert'
  if (humidity > 0.5) return 'forest'
  return 'plains'
}

// PBTテスト
test.prop([fc.integer(), fc.integer()])('chunk key is reversible', (x, z) => {
  const key = getChunkKey(x, z)
  const parsed = parseChunkKey(key)
  expect(parsed).toEqual({ x, z })
})
```

### Schema-driven バイオーム判定

```typescript
// Schema定義による型安全なバイオーム系統
const ClimateDataSchema = Schema.Struct({
  temperature: Schema.Number.pipe(Schema.between(0, 1)),
  humidity: Schema.Number.pipe(Schema.between(0, 1)),
  elevation: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  seasonalFactor: Schema.optional(Schema.Number.pipe(Schema.between(0, 1)))
})

const BiomeTypeSchema = Schema.Literal('tundra', 'jungle', 'desert', 'forest', 'plains', 'mountain', 'swamp')

const climateArbitrary = Arbitrary.make(ClimateDataSchema)

interface BiomeService {
  readonly getBiomeFromClimate: (climate: Schema.Schema.Type<typeof ClimateDataSchema>) => Effect.Effect<Schema.Schema.Type<typeof BiomeTypeSchema>>
  readonly validateBiomeTransition: (from: BiomeType, to: BiomeType, distance: number) => Effect.Effect<boolean>
}

const BiomeService = Context.GenericTag<BiomeService>('@game/BiomeService')

describe('Advanced Biome System PBT', () => {
  it.prop([climateArbitrary])('biome determination with complex climate factors', (climate) =>
    Effect.gen(function* () {
      const biomeService = yield* BiomeService
      const biome = yield* biomeService.getBiomeFromClimate(climate)

      // Schema validation ensures type safety
      const validatedBiome = yield* Schema.decodeUnknown(BiomeTypeSchema)(biome)
      expect(validatedBiome).toBe(biome)

      // Climate-biome consistency rules
      if (climate.temperature < 0.2) {
        expect(['tundra', 'mountain']).toContain(biome)
      }
      if (climate.temperature > 0.8 && climate.humidity > 0.8) {
        expect(['jungle', 'swamp']).toContain(biome)
      }
      if (climate.temperature > 0.6 && climate.humidity < 0.3) {
        expect(biome).toBe('desert')
      }

      return biome
    }).pipe(Effect.provide(BiomeServiceLive))
  )

  it.prop([climateArbitrary, climateArbitrary])('biome transitions follow geographic rules', (climate1, climate2) =>
    Effect.gen(function* () {
      const biomeService = yield* BiomeService
      const biome1 = yield* biomeService.getBiomeFromClimate(climate1)
      const biome2 = yield* biomeService.getBiomeFromClimate(climate2)

      // 気候差から地理的距離を推定
      const climateDiff = Math.abs(climate1.temperature - climate2.temperature) +
                         Math.abs(climate1.humidity - climate2.humidity)
      const distance = climateDiff * 1000 // スケール調整

      const isValidTransition = yield* biomeService.validateBiomeTransition(biome1, biome2, distance)

      // 極端な気候変化では遷移が無効になる場合がある
      if (climateDiff > 0.8) {
        expect(isValidTransition).toBe(false)
      }

      return { biome1, biome2, isValidTransition }
    }).pipe(Effect.provide(BiomeServiceLive))
  )
})
```

## 4. プレイヤー移動のPBT検証

### 物理法則の性質検証

```typescript
// ジャンプ速度計算（テスト可能）
export const calculateJumpVelocity = (jumpHeight: number, gravity: number = 9.8): number =>
  Math.sqrt(2 * gravity * jumpHeight)

// 移動速度制限（テスト可能）
export const clampVelocity = (velocity: Vector3, maxSpeed: number): Vector3 => {
  const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
  if (speed <= maxSpeed) return velocity
  const scale = maxSpeed / speed
  return {
    x: velocity.x * scale,
    y: velocity.y * scale,
    z: velocity.z * scale,
  }
}

// スニーク速度調整（テスト可能）
export const applySneakModifier = (baseSpeed: number, isSneaking: boolean): number =>
  isSneaking ? baseSpeed * 0.3 : baseSpeed
```

### STM統合による物理法則の並行性検証

```typescript
// 物理エンティティのSchema定義
const PhysicsEntitySchema = Schema.Struct({
  id: Schema.String.pipe(Schema.uuid()),
  position: Vector3Schema,
  velocity: Vector3Schema,
  mass: Schema.Number.pipe(Schema.between(0.1, 1000)),
  forces: Schema.Array(Vector3Schema).pipe(Schema.maxItems(10))
})

const physicsEntityArbitrary = Arbitrary.make(PhysicsEntitySchema)

interface PhysicsEngine {
  readonly calculateJumpVelocity: (height: number, gravity?: number) => Effect.Effect<number, PhysicsError>
  readonly simulateStep: (entities: PhysicsEntity[], deltaTime: number) => Effect.Effect<PhysicsEntity[], PhysicsError>
  readonly detectCollisions: (entities: PhysicsEntity[]) => Effect.Effect<CollisionPair[], PhysicsError>
}

const PhysicsEngine = Context.GenericTag<PhysicsEngine>('@game/PhysicsEngine')

describe('STM-Enhanced Physics PBT', () => {
  it.prop([fc.array(physicsEntityArbitrary, { minLength: 2, maxLength: 10 })])(
    'concurrent physics simulation maintains energy conservation',
    (entities) =>
      Effect.gen(function* () {
        const physicsEngine = yield* PhysicsEngine

        // STMを使用した原子的物理シミュレーション
        const entityRefs = yield* STM.gen(function* () {
          const refs = []
          for (const entity of entities) {
            const ref = yield* STM.makeRef(entity)
            refs.push(ref)
          }
          return refs
        }).pipe(STM.commit)

        // 初期エネルギー計算
        const initialEnergy = yield* STM.gen(function* () {
          let totalEnergy = 0
          for (const ref of entityRefs) {
            const entity = yield* STM.get(ref)
            const kineticEnergy = 0.5 * entity.mass * (
              entity.velocity.x ** 2 + entity.velocity.y ** 2 + entity.velocity.z ** 2
            )
            const potentialEnergy = entity.mass * 9.8 * entity.position.y
            totalEnergy += kineticEnergy + potentialEnergy
          }
          return totalEnergy
        }).pipe(STM.commit)

        // 並行物理シミュレーション
        const simulationResults = yield* Effect.allPar([
          physicsEngine.simulateStep(entities, 0.016),
          physicsEngine.simulateStep(entities, 0.016),
          physicsEngine.simulateStep(entities, 0.016)
        ], { concurrency: 3 })

        // 各シミュレーション結果でエネルギー保存則を検証
        for (const result of simulationResults) {
          let totalEnergy = 0
          for (const entity of result) {
            const kineticEnergy = 0.5 * entity.mass * (
              entity.velocity.x ** 2 + entity.velocity.y ** 2 + entity.velocity.z ** 2
            )
            const potentialEnergy = entity.mass * 9.8 * entity.position.y
            totalEnergy += kineticEnergy + potentialEnergy
          }

          // エネルギー保存則（摩擦がない場合）
          expect(totalEnergy).toBeCloseTo(initialEnergy, 2)
        }

        return { initialEnergy, simulationResults }
      }).pipe(Effect.provide(PhysicsEngineLive))
  )

  it.prop([fc.float({ min: 0, max: 10 })])('jump velocity with STM consistency', (height) =>
    Effect.gen(function* () {
      const physicsEngine = yield* PhysicsEngine

      // STMを使用した並行ジャンプ計算
      const heightRef = yield* STM.makeRef(height)

      const concurrentCalculations = yield* STM.gen(function* () {
        const currentHeight = yield* STM.get(heightRef)

        // 複数の物理計算を並行実行
        const calculations = [
          physicsEngine.calculateJumpVelocity(currentHeight, 9.8),
          physicsEngine.calculateJumpVelocity(currentHeight, 9.8),
          physicsEngine.calculateJumpVelocity(currentHeight, 9.8)
        ]

        return calculations
      }).pipe(STM.commit)

      const results = yield* Effect.allPar(concurrentCalculations)

      // 並行計算の一貫性検証
      expect(results[0]).toBeCloseTo(results[1], 10)
      expect(results[1]).toBeCloseTo(results[2], 10)

      // v² = 2ghの物理法則検証
      const velocity = results[0]
      const calculatedHeight = velocity ** 2 / (2 * 9.8)
      expect(calculatedHeight).toBeCloseTo(height, 5)

      return results
    }).pipe(Effect.provide(PhysicsEngineLive))
  )
})
```

test.prop([fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }), fc.float({ min: 0, max: 100 })])(
  'velocity clamping preserves direction',
  (velocity, maxSpeed) => {
    const clamped = clampVelocity(velocity, maxSpeed)
    const originalSpeed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
    const clampedSpeed = Math.sqrt(clamped.x ** 2 + clamped.y ** 2 + clamped.z ** 2)

    if (originalSpeed <= maxSpeed) {
      expect(clamped).toEqual(velocity)
    } else {
      expect(clampedSpeed).toBeCloseTo(maxSpeed, 5)
      // 方向の保持を確認
      if (originalSpeed > 0) {
        const scale = clampedSpeed / originalSpeed
        expect(clamped.x).toBeCloseTo(velocity.x * scale, 5)
        expect(clamped.y).toBeCloseTo(velocity.y * scale, 5)
        expect(clamped.z).toBeCloseTo(velocity.z * scale, 5)
      }
    }
  }
)
```

## 5. Effect-TS 3.17+ とPBTの高度統合

### Fiber-based 並行性とSTMによるProperty検証

```typescript
import { Effect, Fiber, STM, TestClock, Duration, Either, pipe, Layer, Context } from 'effect'
import { describe, it, expect } from '@fast-check/vitest'
import { Arbitrary } from '@effect/schema/Arbitrary'
import * as fc from 'fast-check'

// Service interfaces for game systems
interface ChunkService {
  readonly loadChunkBatch: (coordinates: ChunkCoord[]) => Effect.Effect<Chunk[], ChunkError>
  readonly unloadChunk: (coord: ChunkCoord) => Effect.Effect<void, ChunkError>
  readonly getChunkState: (coord: ChunkCoord) => Effect.Effect<ChunkState, ChunkError>
}

const ChunkService = Context.GenericTag<ChunkService>('@game/ChunkService')

// STM-based concurrent chunk operations
const ChunkBatchSchema = Schema.Struct({
  coordinates: Schema.Array(
    Schema.Struct({
      x: Schema.Number.pipe(Schema.between(-100, 100)),
      z: Schema.Number.pipe(Schema.between(-100, 100))
    })
  ).pipe(Schema.minItems(1), Schema.maxItems(50)),
  priority: Schema.Number.pipe(Schema.between(1, 10)),
  timeout: Schema.Number.pipe(Schema.between(1000, 30000))
})

const chunkBatchArbitrary = Arbitrary.make(ChunkBatchSchema)

export const AdvancedPerformanceTests = describe('Advanced Performance PBT', () => {
  it.prop([chunkBatchArbitrary])('concurrent chunk loading maintains consistency', (batchData) =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService

      // STMを使用したチャンク状態管理
      const chunkStates = yield* STM.makeRef(new Map<string, ChunkState>())

      // Fiberベースの並行チャンクロード
      const loadFibers = batchData.coordinates.map(coord =>
        Effect.gen(function* () {
          const chunk = yield* chunkService.loadChunkBatch([coord])

          // STMでチャンク状態を原子的に更新
          yield* STM.gen(function* () {
            const states = yield* STM.get(chunkStates)
            const newStates = new Map(states)
            newStates.set(`${coord.x},${coord.z}`, ChunkState.Loaded)
            yield* STM.set(chunkStates, newStates)
          }).pipe(STM.commit)

          return chunk
        }).pipe(
          Effect.timeout(Duration.millis(batchData.timeout)),
          Effect.fork
        )
      )

      const fibers = yield* Effect.allPar(loadFibers)

      // 並行実行の結果を収集
      const results = yield* Effect.allPar(
        fibers.map(fiber => Fiber.join(fiber).pipe(Effect.either))
      )

      // 成功率とパフォーマンス特性の検証
      const successCount = results.filter(Either.isRight).length
      const successRate = successCount / results.length

      // 最小成功率の保証（優先度に基づく）
      const expectedSuccessRate = Math.max(0.7, batchData.priority / 10)
      expect(successRate).toBeGreaterThanOrEqual(expectedSuccessRate)

      // チャンク状態の一貫性検証
      const finalStates = yield* STM.commit(STM.get(chunkStates))
      expect(finalStates.size).toBeGreaterThanOrEqual(successCount)

      return { successRate, finalStates: finalStates.size }
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.prop([fc.array(chunkBatchArbitrary, { minLength: 3, maxLength: 10 })])(
    'stress testing with multiple concurrent batches',
    (batches) =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService

        // 複数バッチの並行処理
        const batchFibers = batches.map((batch, index) =>
          Effect.gen(function* () {
            const startTime = yield* Effect.sync(() => Date.now())

            const results = yield* chunkService.loadChunkBatch(batch.coordinates).pipe(
              Effect.timeout(Duration.millis(batch.timeout)),
              Effect.either
            )

            const endTime = yield* Effect.sync(() => Date.now())
            const duration = endTime - startTime

            return {
              batchIndex: index,
              duration,
              success: Either.isRight(results),
              chunkCount: batch.coordinates.length
            }
          }).pipe(Effect.fork)
        )

        const fibers = yield* Effect.allPar(batchFibers)
        const batchResults = yield* Effect.allPar(
          fibers.map(fiber => Fiber.join(fiber))
        )

        // パフォーマンス特性の検証
        const avgDuration = batchResults.reduce((sum, r) => sum + r.duration, 0) / batchResults.length
        const successfulBatches = batchResults.filter(r => r.success).length
        const overallSuccessRate = successfulBatches / batchResults.length

        // システム負荷下でも最低限の性能を保証
        expect(avgDuration).toBeLessThan(20000) // 20秒以内
        expect(overallSuccessRate).toBeGreaterThan(0.5) // 50%以上の成功率

        return { avgDuration, overallSuccessRate, batchCount: batches.length }
      }).pipe(Effect.provide(ChunkServiceLive))
  )
})
```

### 決定論的生成のSTM統合検証

```typescript
// シード値とチャンク座標のSchema定義
const WorldGenTestDataSchema = Schema.Struct({
  seed: Schema.Number.pipe(Schema.int()),
  coordinates: Schema.Array(
    Schema.Struct({
      x: Schema.Number.pipe(Schema.int(), Schema.between(-1000, 1000)),
      z: Schema.Number.pipe(Schema.int(), Schema.between(-1000, 1000))
    })
  ).pipe(Schema.minItems(1), Schema.maxItems(20)),
  biomeConfig: Schema.Struct({
    temperature: Schema.Number.pipe(Schema.between(0, 1)),
    humidity: Schema.Number.pipe(Schema.between(0, 1)),
    generateOres: Schema.Boolean,
    generateStructures: Schema.Boolean
  })
})

const worldGenArbitrary = Arbitrary.make(WorldGenTestDataSchema)

interface WorldGenerator {
  readonly generateChunk: (coord: ChunkCoord, seed: number, config: BiomeConfig) => Effect.Effect<Chunk, WorldGenError>
  readonly validateChunk: (chunk: Chunk) => Effect.Effect<boolean, WorldGenError>
}

const WorldGenerator = Context.GenericTag<WorldGenerator>('@game/WorldGenerator')

describe('STM-Enhanced World Generation PBT', () => {
  it.prop([worldGenArbitrary])('deterministic generation with concurrent validation', (testData) =>
    Effect.gen(function* () {
      const worldGen = yield* WorldGenerator

      // STMを使用した生成結果の保存と比較
      const generationResults = yield* STM.makeRef(new Map<string, Chunk>())

      // 並行生成（同じシードで複数回）
      const concurrentGenerations = testData.coordinates.map(coord =>
        Effect.gen(function* () {
          const chunk1 = yield* worldGen.generateChunk(coord, testData.seed, testData.biomeConfig)
          const chunk2 = yield* worldGen.generateChunk(coord, testData.seed, testData.biomeConfig)

          // STMで結果を原子的に保存
          yield* STM.gen(function* () {
            const results = yield* STM.get(generationResults)
            const newResults = new Map(results)
            newResults.set(`${coord.x},${coord.z}_1`, chunk1)
            newResults.set(`${coord.x},${coord.z}_2`, chunk2)
            yield* STM.set(generationResults, newResults)
          }).pipe(STM.commit)

          // 決定論性の検証
          expect(chunk1.blocks).toEqual(chunk2.blocks)
          expect(chunk1.biome).toBe(chunk2.biome)

          return { coord, chunk1, chunk2 }
        })
      )

      const results = yield* Effect.allPar(concurrentGenerations, { concurrency: 5 })

      // 全体的な一貫性検証
      const allResults = yield* STM.commit(STM.get(generationResults))
      expect(allResults.size).toBe(testData.coordinates.length * 2)

      // チャンク間の境界整合性検証
      for (let i = 0; i < results.length - 1; i++) {
        const current = results[i]
        const next = results[i + 1]

        // 隣接チャンクのバイオーム境界が自然であることを確認
        if (Math.abs(current.coord.x - next.coord.x) === 1 && current.coord.z === next.coord.z) {
          const biomeSimilarity = calculateBiomeSimilarity(current.chunk1.biome, next.chunk1.biome)
          expect(biomeSimilarity).toBeGreaterThan(0.3) // 30%以上の類似性
        }
      }

      return { generatedChunks: results.length, totalVariations: allResults.size }
    }).pipe(Effect.provide(WorldGeneratorLive))
  )
})
```

## 6. テスト可能なプロパティ定義

### 可換性 (Commutativity)

```typescript
test.prop([fc.integer(), fc.integer()])('light level combination is commutative', (light1, light2) => {
  expect(combineLightLevels(light1, light2)).toBe(combineLightLevels(light2, light1))
})
```

### 冪等性 (Idempotency)

```typescript
test.prop([fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }), fc.float()])(
  'velocity clamping is idempotent',
  (velocity, maxSpeed) => {
    const clamped1 = clampVelocity(velocity, maxSpeed)
    const clamped2 = clampVelocity(clamped1, maxSpeed)
    expect(clamped1).toEqual(clamped2)
  }
)
```

### 単調性 (Monotonicity)

```typescript
test.prop([fc.integer({ min: 0, max: 15 }), fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 10 })])(
  'light attenuation is monotonic',
  (sourceLevel, distance1, distance2) => {
    fc.pre(distance1 <= distance2)
    const attenuation1 = calculateLightAttenuation(sourceLevel, distance1)
    const attenuation2 = calculateLightAttenuation(sourceLevel, distance2)
    expect(attenuation1).toBeGreaterThanOrEqual(attenuation2)
  }
)
```

## 7. 統合テスト戦略

### システム間連携の性質検証

```typescript
test.prop([
  fc.record({
    playerId: fc.string({ minLength: 1 }),
    fromChunk: fc.record({ x: fc.integer(), z: fc.integer() }),
    toChunk: fc.record({ x: fc.integer(), z: fc.integer() }),
  }),
])('player chunk transition loads required chunks', async ({ playerId, fromChunk, toChunk }) => {
  // テストのセットアップ
  const initialState = createTestWorldState()

  // プレイヤーをfromChunkに配置
  await placePlayerInChunk(initialState, playerId, fromChunk)

  // toChunkへの移動
  await movePlayerToChunk(initialState, playerId, toChunk)

  // チャンクが適切にロードされていることを確認
  const loadedChunks = await getLoadedChunks(initialState)
  expect(loadedChunks).toContainEqual(toChunk)
})
```

## 8. PBTベストプラクティス

### 適切なArbitraryの選択

```typescript
// ゲーム座標に適した範囲制限
const gamePositionArbitrary = fc.record({
  x: fc.integer({ min: -30000000, max: 30000000 }), // Minecraft座標系限界
  y: fc.integer({ min: -64, max: 320 }), // Y軸範囲
  z: fc.integer({ min: -30000000, max: 30000000 }),
})

// ブロック座標（チャンク内）
const blockPositionArbitrary = fc.record({
  x: fc.integer({ min: 0, max: 15 }),
  y: fc.integer({ min: -64, max: 319 }),
  z: fc.integer({ min: 0, max: 15 }),
})

// 物理的に妥当な速度
const velocityArbitrary = fc.record({
  x: fc.float({ min: -20, max: 20 }), // 現実的な移動速度
  y: fc.float({ min: -50, max: 20 }), // 落下速度考慮
  z: fc.float({ min: -20, max: 20 }),
})
```

### Schema統合による事前条件とバリデーション

```typescript
// Schema-based preconditions
const DivisionOperationSchema = Schema.Struct({
  dividend: Schema.Number,
  divisor: Schema.Number.pipe(
    Schema.filter((n): n is number => n !== 0, {
      message: () => 'Divisor cannot be zero'
    })
  ),
  precision: Schema.optional(Schema.Number.pipe(Schema.between(1, 15)))
})

const divisionArbitrary = Arbitrary.make(DivisionOperationSchema)

// Advanced precondition testing with Effect
describe('Schema-Enhanced Precondition Testing', () => {
  it.prop([divisionArbitrary])('division properties with schema validation', (operation) =>
    Effect.gen(function* () {
      // Schema validation ensures preconditions
      const validated = yield* Schema.decodeUnknown(DivisionOperationSchema)(operation)

      // STMを使用した原子的計算
      const result = yield* STM.gen(function* () {
        const dividendRef = yield* STM.makeRef(validated.dividend)
        const divisorRef = yield* STM.makeRef(validated.divisor)

        const dividend = yield* STM.get(dividendRef)
        const divisor = yield* STM.get(divisorRef)

        // ゼロ除算は既にSchemaレベルで排除済み
        const quotient = dividend / divisor
        const verification = quotient * divisor

        return { quotient, verification, original: dividend }
      }).pipe(STM.commit)

      const precision = validated.precision ?? 10
      expect(result.verification).toBeCloseTo(result.original, precision)

      // 数学的性質の検証
      if (validated.dividend > 0 && validated.divisor > 0) {
        expect(result.quotient).toBeGreaterThan(0)
      }
      if (validated.dividend < 0 && validated.divisor > 0) {
        expect(result.quotient).toBeLessThan(0)
      }

      return result
    })
  )

  // Complex game-specific preconditions
  it.prop([fc.record({
    playerHealth: fc.float({ min: 0, max: 100 }),
    damageAmount: fc.float({ min: 0, max: 200 }),
    armorValue: fc.float({ min: 0, max: 50 }),
    damageType: fc.constantFrom('physical', 'magical', 'fire', 'ice')
  })])('damage calculation with complex preconditions', (damageData) =>
    Effect.gen(function* () {
      // Game-specific preconditions
      const isValidScenario = damageData.playerHealth > 0 &&
                             damageData.damageAmount >= 0 &&
                             damageData.armorValue >= 0

      if (!isValidScenario) {
        return Effect.succeed({ skipped: true })
      }

      // STMを使用したダメージ計算
      const result = yield* STM.gen(function* () {
        const healthRef = yield* STM.makeRef(damageData.playerHealth)
        const armorRef = yield* STM.makeRef(damageData.armorValue)

        const currentHealth = yield* STM.get(healthRef)
        const currentArmor = yield* STM.get(armorRef)

        // ダメージタイプ別の軽減計算
        let damageReduction = 0
        switch (damageData.damageType) {
          case 'physical':
            damageReduction = currentArmor * 0.5
            break
          case 'magical':
            damageReduction = currentArmor * 0.2
            break
          case 'fire':
          case 'ice':
            damageReduction = currentArmor * 0.3
            break
        }

        const actualDamage = Math.max(0, damageData.damageAmount - damageReduction)
        const newHealth = Math.max(0, currentHealth - actualDamage)

        yield* STM.set(healthRef, newHealth)

        return {
          originalHealth: currentHealth,
          newHealth,
          actualDamage,
          damageReduction
        }
      }).pipe(STM.commit)

      // Post-conditions validation
      expect(result.newHealth).toBeGreaterThanOrEqual(0)
      expect(result.newHealth).toBeLessThanOrEqual(damageData.playerHealth)
      expect(result.actualDamage).toBeGreaterThanOrEqual(0)
      expect(result.damageReduction).toBeGreaterThanOrEqual(0)

      return result
    })
  )
})
```

## 関連ドキュメント

**テスト関連**:

- [Effect-TS テスト](../explanations/architecture/06d-effect-ts-testing.md) - Effect-TSテストパターン
- [テストパターン集](../../explanations/design-patterns/02-testing-patterns.md) - テストパターンカタログ

**設計関連**:

- [アーキテクチャ原則](./00-architecture-principles.md) - 設計原則
- [実装パターン](./00-implementation-patterns.md) - 具体的な実装例
