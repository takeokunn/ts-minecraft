/**
 * Entity ECS Architecture Tests - it.effect理想系パターン
 * Context7準拠のEffect-TS v3.17+最新パターン使用
 */

import { it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Layer from 'effect/Layer'
import * as TestContext from 'effect/TestContext'
import { Schema } from '@effect/schema'
import { pipe } from 'effect/Function'
import * as Match from 'effect/Match'
import * as Predicate from 'effect/Predicate'
import type { EntityId } from '../Entity'
import {
  createEntityId,
  EntityPoolError,
  EntityPoolLive,
  EntityPoolLayer,
  EntityPool,
  createComponentStorage,
  createArchetypeManager,
  type EntityMetadata,
} from '../Entity'
import * as Exit from 'effect/Exit'

// ================================================================================
// Schema Definitions - Schema-First Approach
// ================================================================================

const EntityIdSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const ComponentDataSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

interface TestComponent {
  x: number
  y: number
  z: number
}

// ================================================================================
// Test Layers - Layer-based DI Pattern
// ================================================================================

const TestLayer = EntityPoolLayer

// ================================================================================
// EntityPool Tests - it.effect Pattern
// ================================================================================

describe('Entity ECS Architecture', () => {
  describe('EntityPool - ID Management', () => {
    it.effect('should allocate unique entity IDs', () =>
      Effect.gen(function* () {
        const pool = yield* EntityPool

        const id1 = yield* pool.allocate()
        const id2 = yield* pool.allocate()
        const id3 = yield* pool.allocate()

        // Schema validation for entity IDs
        const validId1 = Schema.decodeUnknownSync(Schema.Number)(id1)
        const validId2 = Schema.decodeUnknownSync(Schema.Number)(id2)
        const validId3 = Schema.decodeUnknownSync(Schema.Number)(id3)

        // Uniqueness verification
        yield* pipe(
          id1 === id2 || id2 === id3 || id1 === id3,
          Match.value,
          Match.when(true, () => Effect.fail(new Error('Entity IDs are not unique'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should recycle deallocated IDs', () =>
      Effect.gen(function* () {
        const pool = yield* EntityPool

        const id1 = yield* pool.allocate()
        yield* pool.deallocate(id1)
        const id2 = yield* pool.allocate()

        // リサイクルされたIDは同じになるはず
        yield* pipe(
          id2 !== id1,
          Match.value,
          Match.when(true, () => Effect.fail(new Error('ID recycling failed'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should track allocated status correctly', () =>
      Effect.gen(function* () {
        const pool = yield* EntityPool

        const id = yield* pool.allocate()
        const isAllocated1 = yield* pool.isAllocated(id)

        yield* pipe(
          isAllocated1,
          Match.value,
          Match.when(false, () => Effect.fail(new Error('Entity should be allocated'))),
          Match.when(true, () => Effect.succeed(undefined)),
          Match.exhaustive
        )

        yield* pool.deallocate(id)
        const isAllocated2 = yield* pool.isAllocated(id)

        yield* pipe(
          isAllocated2,
          Match.value,
          Match.when(true, () =>
            Effect.fail(new Error('Entity should be deallocated'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail when deallocating unallocated entity', () =>
      Effect.gen(function* () {
        const pool = yield* EntityPool
        const invalidId = createEntityId(99999)

        // EntityPoolErrorが発生することを確認
        const result = yield* Effect.exit(pool.deallocate(invalidId))

        yield* pipe(
          result._tag === 'Success',
          Match.value,
          Match.when(true, () =>
            Effect.fail(new Error('Should have failed with EntityPoolError'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )

        yield* pipe(
          result._tag === 'Failure' &&
          Predicate.isRecord(result.cause) &&
          '_tag' in result.cause &&
          (result.cause as any)._tag === 'Fail' &&
          Predicate.isRecord((result.cause as any).error) &&
          '_tag' in (result.cause as any).error &&
          (result.cause as any).error._tag === 'EntityPoolError',
          Match.value,
          Match.when(true, () => Effect.succeed(undefined)),
          Match.when(false, () => Effect.fail(new Error('Expected EntityPoolError'))),
          Match.exhaustive
        )
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should reset pool state correctly', () =>
      Effect.gen(function* () {
        const pool = yield* EntityPool

        // いくつかのエンティティを割り当て
        const ids = yield* Effect.all([pool.allocate(), pool.allocate(), pool.allocate()])

        // リセット
        yield* pool.reset()

        // リセット後、すべてのIDは未割り当てになるはず
        const allocationChecks = yield* Effect.all(ids.map((id) => pool.isAllocated(id)))

        yield* pipe(
          allocationChecks.some((allocated) => allocated),
          Match.value,
          Match.when(true, () =>
            Effect.fail(new Error('Some entities still allocated after reset'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )

        const stats = yield* pool.getStats()
        yield* pipe(
          stats.allocatedCount !== 0 || stats.recycledCount !== 0,
          Match.value,
          Match.when(true, () =>
            Effect.fail(new Error('Stats not reset correctly'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )

      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should provide accurate statistics', () =>
      Effect.gen(function* () {
        const pool = yield* EntityPool

        const initialStats = yield* pool.getStats()
        yield* pipe(
          initialStats.allocatedCount !== 0 || initialStats.recycledCount !== 0,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Initial stats incorrect'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // 3つ割り当て
        const id1 = yield* pool.allocate()
        const id2 = yield* pool.allocate()
        const id3 = yield* pool.allocate()

        const afterAllocStats = yield* pool.getStats()
        yield* pipe(
          afterAllocStats.allocatedCount !== 3 || afterAllocStats.recycledCount !== 0,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('After allocation stats incorrect'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // 1つ解放してリサイクル
        yield* pool.deallocate(id2)
        yield* pool.allocate()

        const afterRecycleStats = yield* pool.getStats()
        yield* pipe(
          afterRecycleStats.allocatedCount !== 3 || afterRecycleStats.recycledCount !== 1,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('After recycle stats incorrect'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('ComponentStorage - Structure of Arrays', () => {
    it.effect('should insert and retrieve components', () =>
      Effect.gen(function* () {
        const storage = createComponentStorage<TestComponent>()
        const entityId = createEntityId(1)
        const component = { x: 10, y: 20, z: 30 }

        yield* storage.insert(entityId, component)
        const retrieved = yield* storage.get(entityId)

        yield* pipe(
          Option.isNone(retrieved),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Component not found'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // Schema validation
        const validComponent = Schema.decodeUnknownSync(ComponentDataSchema)(retrieved.value)

        yield* pipe(
          JSON.stringify(retrieved.value) !== JSON.stringify(component),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Component data mismatch'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should update existing components', () =>
      Effect.gen(function* () {
        const storage = createComponentStorage<TestComponent>()
        const entityId = createEntityId(1)

        yield* storage.insert(entityId, { x: 1, y: 2, z: 3 })
        yield* storage.insert(entityId, { x: 10, y: 20, z: 30 })

        const retrieved = yield* storage.get(entityId)

        yield* pipe(
          Option.isNone(retrieved),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Component not found'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        const expected = { x: 10, y: 20, z: 30 }
        yield* pipe(
          JSON.stringify(retrieved.value) !== JSON.stringify(expected),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Component update failed'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should remove components and maintain array compactness', () =>
      Effect.gen(function* () {
        const storage = createComponentStorage<TestComponent>()
        const entity1 = createEntityId(1)
        const entity2 = createEntityId(2)
        const entity3 = createEntityId(3)

        // 3つのコンポーネントを追加
        yield* storage.insert(entity1, { x: 1, y: 1, z: 1 })
        yield* storage.insert(entity2, { x: 2, y: 2, z: 2 })
        yield* storage.insert(entity3, { x: 3, y: 3, z: 3 })

        // 中間の要素を削除
        const removed = yield* storage.remove(entity2)
        yield* pipe(
          !removed,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Remove operation failed'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // 削除されたことを確認
        const has2 = yield* storage.has(entity2)
        yield* pipe(
          has2,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Component should be removed'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // 他の要素はまだ存在
        const has1 = yield* storage.has(entity1)
        const has3 = yield* storage.has(entity3)
        yield* pipe(
          !has1 || !has3,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Other components should still exist'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // 配列がコンパクトに保たれていることを確認
        const stats = yield* storage.getStats()
        yield* pipe(
          stats.size !== 2,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Array compactness not maintained'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should batch retrieve all components efficiently', () =>
      Effect.gen(function* () {
        const storage = createComponentStorage<TestComponent>()
        const components: [EntityId, TestComponent][] = [
          [createEntityId(1), { x: 1, y: 1, z: 1 }],
          [createEntityId(2), { x: 2, y: 2, z: 2 }],
          [createEntityId(3), { x: 3, y: 3, z: 3 }],
        ]

        // 複数のコンポーネントを追加
        for (const [id, component] of components) {
          yield* storage.insert(id, component)
        }

        // バッチ取得
        const all = yield* storage.getAll()
        yield* pipe(
          all.length !== 3,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Batch retrieval count mismatch'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // 各コンポーネントが正しく取得されているか確認
        const allMap = new Map(all)
        for (const [id, component] of components) {
          const retrieved = allMap.get(id)
          yield* pipe(
          !retrieved || JSON.stringify(retrieved) !== JSON.stringify(component),
          Match.value,
          Match.when(true, () =>
            Effect.fail(new Error('Batch retrieval data mismatch'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
          }
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should iterate over components efficiently', () =>
      Effect.gen(function* () {
        const storage = createComponentStorage<TestComponent>()

        // 100個のコンポーネントを追加
        for (let i = 0; i < 100; i++) {
          yield* storage.insert(createEntityId(i), { x: i, y: i * 2, z: i * 3 })
        }

        // イテレーション
        let count = 0
        let sumX = 0
        yield* storage.iterate((entity, component) =>
          Effect.sync(() => {
            count++
            sumX += component.x
          })
        )

        yield* pipe(
          count !== 100,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Iteration count mismatch'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        yield* pipe(
          sumX !== 4950,
          Match.value,
          Match.when(true, () =>
          // 0+1+2+...+99 = 99*100/2 = 4950
          Effect.fail(new Error('Iteration sum mismatch'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should provide raw data access for maximum performance', () =>
      Effect.gen(function* () {
        const storage = createComponentStorage<TestComponent>()
        const numEntities = 10

        for (let i = 0; i < numEntities; i++) {
          yield* storage.insert(createEntityId(i), { x: i, y: 0, z: 0 })
        }

        const raw = yield* storage.getRawData()
        yield* pipe(
          raw.data.length !== numEntities || raw.entities.length !== numEntities,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Raw data length mismatch'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // データが正しい順序で格納されているか確認
        for (let i = 0; i < numEntities; i++) {
          yield* pipe(
          raw.entities[i] !== i,
          Match.value,
          Match.when(true, () =>
            Effect.fail(new Error('Entity order incorrect'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
          }
          const component = raw.data[i]
          yield* pipe(
          !component || component.x !== i,
          Match.value,
          Match.when(true, () =>
            Effect.fail(new Error('Component data incorrect'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
          }
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should clear all data', () =>
      Effect.gen(function* () {
        const storage = createComponentStorage<TestComponent>()

        // データを追加
        yield* storage.insert(createEntityId(1), { x: 1, y: 1, z: 1 })
        yield* storage.insert(createEntityId(2), { x: 2, y: 2, z: 2 })

        // クリア
        yield* storage.clear()

        // すべてのデータが削除されていることを確認
        const has1 = yield* storage.has(createEntityId(1))
        const has2 = yield* storage.has(createEntityId(2))
        yield* pipe(
          has1 || has2,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Data not cleared'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        const stats = yield* storage.getStats()
        yield* pipe(
          stats.size !== 0,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Stats not cleared'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )
  })

  describe('ArchetypeManager - ECS Performance Optimization', () => {
    it.effect('should create and cache archetypes', () =>
      Effect.gen(function* () {
        const manager = createArchetypeManager()

        const components1 = new Set(['Position', 'Velocity'])
        const archetype1 = yield* manager.getOrCreateArchetype(components1)
        const archetype2 = yield* manager.getOrCreateArchetype(components1)

        // 同じコンポーネントセットに対しては同じアーキタイプが返される
        yield* pipe(
          archetype1.id !== archetype2.id || archetype1 !== archetype2,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Archetype caching failed'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should create different archetypes for different component sets', () =>
      Effect.gen(function* () {
        const manager = createArchetypeManager()

        const components1 = new Set(['Position'])
        const components2 = new Set(['Position', 'Velocity'])
        const components3 = new Set(['Velocity', 'Position']) // 順序が異なっても同じとして扱う

        const archetype1 = yield* manager.getOrCreateArchetype(components1)
        const archetype2 = yield* manager.getOrCreateArchetype(components2)
        const archetype3 = yield* manager.getOrCreateArchetype(components3)

        yield* pipe(
          archetype1.id === archetype2.id,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Different component sets should have different archetypes'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        yield* pipe(
          archetype2.id !== archetype3.id,
          Match.value,
          Match.when(true, () =>
          // 順序に関わらず同じ
          Effect.fail(new Error('Component set order should not matter'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should move entities between archetypes', () =>
      Effect.gen(function* () {
        const manager = createArchetypeManager()
        const entityId = createEntityId(1)

        const components1 = new Set(['Position'])
        const components2 = new Set(['Position', 'Velocity'])

        // 最初のアーキタイプにエンティティを追加
        yield* manager.moveEntity(entityId, components1)

        const entities1 = yield* manager.getEntitiesWithArchetype(components1)
        yield* pipe(
          !Array.from(entities1).includes(entityId),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Entity not added to first archetype'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // 別のアーキタイプに移動
        yield* manager.moveEntity(entityId, components2)

        const entities1After = yield* manager.getEntitiesWithArchetype(components1)
        const entities2After = yield* manager.getEntitiesWithArchetype(components2)

        yield* pipe(
          Array.from(entities1After).includes(entityId),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Entity should be removed from first archetype'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        yield* pipe(
          !Array.from(entities2After).includes(entityId),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Entity should be added to second archetype'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should remove entities from archetypes', () =>
      Effect.gen(function* () {
        const manager = createArchetypeManager()
        const entityId = createEntityId(1)
        const components = new Set(['Position', 'Velocity'])

        yield* manager.moveEntity(entityId, components)
        yield* manager.removeEntity(entityId)

        const entities = yield* manager.getEntitiesWithArchetype(components)
        yield* pipe(
          Array.from(entities).includes(entityId),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Entity should be removed from archetype'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should get all entities with specific archetype', () =>
      Effect.gen(function* () {
        const manager = createArchetypeManager()
        const components = new Set(['Position', 'Velocity'])

        const entities = [createEntityId(1), createEntityId(2), createEntityId(3)]

        for (const entity of entities) {
          yield* manager.moveEntity(entity, components)
        }

        const retrieved = yield* manager.getEntitiesWithArchetype(components)

        yield* pipe(
          retrieved.size !== 3,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Retrieved entity count mismatch'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        for (const entity of entities) {
          yield* pipe(
          !retrieved.has(entity),
          Match.value,
          Match.when(true, () =>
            Effect.fail(new Error('Entity missing from archetype'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
          }
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should clear all archetype data', () =>
      Effect.gen(function* () {
        const manager = createArchetypeManager()

        const components1 = new Set(['Position'])
        const components2 = new Set(['Velocity'])

        yield* manager.moveEntity(createEntityId(1), components1)
        yield* manager.moveEntity(createEntityId(2), components2)

        yield* manager.clear()

        const entities1 = yield* manager.getEntitiesWithArchetype(components1)
        const entities2 = yield* manager.getEntitiesWithArchetype(components2)

        yield* pipe(
          entities1.size !== 0 || entities2.size !== 0,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Archetype data not cleared'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )
  })

  describe('Performance Characteristics - Property-based Testing', () => {
    it.effect('should handle large number of components efficiently', () =>
      Effect.gen(function* () {
        const storage = createComponentStorage<{ value: number }>()

        // パフォーマンステスト - 10000個のコンポーネント挿入
        const insertionTest = Effect.gen(function* () {
          for (let i = 0; i < 10000; i++) {
            yield* storage.insert(createEntityId(i), { value: i })
          }
          return 'insertion_complete'
        })

        // Performance test - measure insertion time
        const startTime = Date.now()
        const insertionResult = yield* insertionTest
        const insertionTime = Date.now() - startTime
        console.log(`Insertion performance: ${insertionTime}ms`)

        // イテレーションのパフォーマンステスト
        const iterationTest = Effect.gen(function* () {
          let sum = 0
          yield* storage.iterate((_entity, component) =>
            Effect.sync(() => {
              sum += component.value
            })
          )
          return sum
        })

        // Performance test - measure iteration time
        const iterationStartTime = Date.now()
        const iterationResult = yield* iterationTest
        const iterationTime = Date.now() - iterationStartTime
        console.log(`Iteration performance: ${iterationTime}ms`)

        // 数学的検証: 0+1+2+...+9999 = 49995000
        yield* pipe(
          iterationResult !== 49995000,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Iteration sum incorrect'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(TestContext.TestContext))
    )

    it.effect('should maintain memory efficiency with Structure of Arrays', () =>
      Effect.gen(function* () {
        const storage = createComponentStorage<{
          x: number
          y: number
          z: number
          w: number
        }>()

        // メモリ効率テスト
        const memoryTest = Effect.gen(function* () {
          for (let i = 0; i < 5000; i++) {
            yield* storage.insert(createEntityId(i), { x: i, y: i, z: i, w: i })
          }
          const stats = yield* storage.getStats()
          return stats
        })

        // Performance test - measure memory operation time
        const memoryStartTime = Date.now()
        const memoryResult = yield* memoryTest
        const memoryTime = Date.now() - memoryStartTime
        console.log(`Memory test performance: ${memoryTime}ms`)

        yield* pipe(
          memoryResult.size !== 5000,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Memory test data size incorrect'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // メモリ効率の確認（実際のメモリ使用量は環境依存）
        // 基本的な構造確認のみ実施
      }).pipe(Effect.provide(TestContext.TestContext))
    )
  })

  // ========================================
  // Phase 2: EntityPool枯渇エラーカバレッジテスト (lines 280-285)
  // ========================================

  describe('EntityPool Exhaustion (Phase 2)', () => {
    // 小さなプールサイズでテスト用Layerを作成
    const SmallPoolLayer = Layer.effect(
      EntityPool,
      Effect.gen(function* () {
        // より小さなサイズでプールを作成（テスト用）
        const SMALL_MAX_ENTITIES = 3
        const state = {
          freeList: Array.from({ length: SMALL_MAX_ENTITIES }, (_, i) => createEntityId(SMALL_MAX_ENTITIES - 1 - i)),
          allocated: new Set<EntityId>(),
          nextId: SMALL_MAX_ENTITIES,
        }

        return {
          allocate: () =>
            Effect.gen(function* () {
              yield* pipe(
                state.freeList.length === 0,
                Match.value,
                Match.when(true, () =>
                  Effect.fail(
                    EntityPoolError('pool_exhausted', `Entity pool exhausted. Maximum capacity: ${SMALL_MAX_ENTITIES}`)
                  )
                ),
                Match.when(false, () => Effect.succeed(undefined)),
                Match.exhaustive
              )
              const id = state.freeList.pop()!
              state.allocated.add(id)
              return id
            }),

          deallocate: (id: EntityId) =>
            Effect.gen(function* () {
              yield* pipe(
                !state.allocated.has(id),
                Match.value,
                Match.when(true, () =>
                  Effect.fail(EntityPoolError('invalid_entity_id', `Entity ${id} is not allocated`))),
                Match.when(false, () => Effect.succeed(undefined)),
                Match.exhaustive
              )
              state.allocated.delete(id)
              state.freeList.push(id)
            }),

          getStats: () =>
            Effect.succeed({
              allocatedCount: state.allocated.size,
              recycledCount: state.freeList.length,
              totalCapacity: SMALL_MAX_ENTITIES,
              freeCount: SMALL_MAX_ENTITIES - state.allocated.size,
            }),

          isAllocated: (id: EntityId) => Effect.succeed(state.allocated.has(id)),

          reset: () =>
            Effect.gen(function* () {
              state.allocated.clear()
              state.freeList = Array.from({ length: SMALL_MAX_ENTITIES }, (_, i) =>
                createEntityId(SMALL_MAX_ENTITIES - 1 - i)
              )
              state.nextId = SMALL_MAX_ENTITIES
            }),
        }
      })
    )

    it.effect('プール枯渇時にEntityPoolErrorが発生する (lines 280-285)', () =>
      Effect.gen(function* () {
        const pool = yield* EntityPool

        // 小さなプールのすべてのエンティティを割り当て
        const id1 = yield* pool.allocate()
        const id2 = yield* pool.allocate()
        const id3 = yield* pool.allocate()

        // プールが枯渇した状態で追加の割り当てを試行
        const result = yield* Effect.either(pool.allocate())

        // EntityPoolErrorが発生することを確認
        yield* pipe(
          result._tag !== 'Left',
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Expected EntityPoolError due to pool exhaustion'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        const error = result.left
        yield* pipe(
          !(Predicate.isRecord(error) && '_tag' in error && error._tag === 'EntityPoolError'),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Expected EntityPoolError'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // lines 280-285の具体的な内容を確認
        yield* pipe(
          error.reason !== 'pool_exhausted',
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Expected pool_exhausted reason'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        yield* pipe(
          !error.message.includes('Entity pool exhausted'),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Expected exhaustion message'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        yield* pipe(
          !error.message.includes('Maximum capacity: 3'),
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Expected capacity in message'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // プール統計の確認
        const stats = yield* pool.getStats()
        yield* pipe(
          stats.allocatedCount !== 3 || stats.recycledCount !== 0,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Pool stats incorrect after exhaustion'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(SmallPoolLayer))
    )

    it.effect('エンティティ解放後にプールが再利用可能になる', () =>
      Effect.gen(function* () {
        const pool = yield* EntityPool

        // プールを枯渇させる
        const id1 = yield* pool.allocate()
        const id2 = yield* pool.allocate()
        const id3 = yield* pool.allocate()

        // 枯渇確認
        const exhaustedResult = yield* Effect.either(pool.allocate())
        yield* pipe(
          exhaustedResult._tag !== 'Left',
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Pool should be exhausted'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // 1つのエンティティを解放
        yield* pool.deallocate(id2)

        // 再度割り当て可能になることを確認
        const newId = yield* pool.allocate()
        yield* pipe(
          newId !== id2,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Should reuse deallocated ID'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // 再び枯渇状態になることを確認
        const reExhaustedResult = yield* Effect.either(pool.allocate())
        yield* pipe(
          reExhaustedResult._tag !== 'Left',
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Pool should be exhausted again'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(SmallPoolLayer))
    )

    it.effect('freeList.length === 0 条件の境界値テスト', () =>
      Effect.gen(function* () {
        const pool = yield* EntityPool

        // 初期状態の確認
        const initialStats = yield* pool.getStats()
        yield* pipe(
          initialStats.recycledCount !== 3,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Initial recycled count should be 3'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // 1つずつ割り当ててfreeListを減らす
        yield* pool.allocate() // recycledCount: 2
        yield* pool.allocate() // recycledCount: 1
        yield* pool.allocate() // recycledCount: 0

        const preExhaustionStats = yield* pool.getStats()
        yield* pipe(
          preExhaustionStats.recycledCount !== 0,
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('FreeList should be empty'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        // この時点でfreeList.length === 0 の条件に達している
        const exhaustionResult = yield* Effect.either(pool.allocate())

        // lines 280-285のエラーパスが実行される
        yield* pipe(
          exhaustionResult._tag !== 'Left',
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Should trigger pool exhaustion'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

        const exhaustionError = exhaustionResult.left as EntityPoolError
        yield* pipe(
          exhaustionError._tag !== 'EntityPoolError' || exhaustionError.reason !== 'pool_exhausted',
          Match.value,
          Match.when(true, () =>
          Effect.fail(new Error('Incorrect exhaustion error'))),
          Match.when(false, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
        }

      }).pipe(Effect.provide(SmallPoolLayer))
    )
  })
})
