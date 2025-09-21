import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Option, pipe } from 'effect'
import { EntityManager, EntityManagerLive, EntityManagerError } from '../EntityManager.js'
import { EntityPool, EntityPoolLive, type EntityId, EntityPoolError, EntityId as EntityIdBrand } from '../Entity.js'
import { SystemRegistryService, SystemRegistryServiceLive } from '../SystemRegistry.js'
import { EffectAssert, PropertyTest, PerformanceTest } from '../../../test/effect-test-utils.js'

// テスト用コンポーネント
interface PositionComponent {
  x: number
  y: number
  z: number
}

interface VelocityComponent {
  vx: number
  vy: number
  vz: number
}

interface HealthComponent {
  current: number
  max: number
}

describe('EntityManager - Effect-TS Pattern', () => {
  // Create a test layer that provides all dependencies
  const TestDependencies = Layer.mergeAll(Layer.effect(EntityPool, EntityPoolLive), SystemRegistryServiceLive)
  const EntityManagerTestLayer = Layer.effect(EntityManager, pipe(EntityManagerLive, Effect.provide(TestDependencies)))

  describe('Entity Creation and Destruction', () => {
    it.effect('should create an entity with metadata', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const entityId = yield* manager.createEntity('TestEntity', ['player', 'hero'])

        const metadata = yield* manager.getEntityMetadata(entityId)
        expect(Option.isSome(metadata)).toBe(true)
        if (Option.isSome(metadata)) {
          expect(metadata.value.name).toBe('TestEntity')
          expect(metadata.value.tags).toEqual(['player', 'hero'])
          expect(metadata.value.active).toBe(true)
        }

        const isAlive = yield* manager.isEntityAlive(entityId)
        expect(isAlive).toBe(true)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should destroy an entity and release its ID', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const entityId = yield* manager.createEntity()
        yield* manager.destroyEntity(entityId)

        const isAlive = yield* manager.isEntityAlive(entityId)
        expect(isAlive).toBe(false)

        const metadata = yield* manager.getEntityMetadata(entityId)
        expect(Option.isNone(metadata)).toBe(true)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should handle entity pool recycling', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const createdIds: EntityId[] = []

        // 100個のエンティティを作成して削除
        for (let i = 0; i < 100; i++) {
          const id = yield* manager.createEntity()
          createdIds.push(id)
        }

        for (const id of createdIds) {
          yield* manager.destroyEntity(id)
        }

        // 新しいエンティティを作成（IDが再利用される）
        const recycledId = yield* manager.createEntity()
        expect(createdIds).toContain(recycledId)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )
  })

  describe('Component Management', () => {
    it.effect('should add and retrieve components', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const entityId = yield* manager.createEntity()

        const position: PositionComponent = { x: 10, y: 20, z: 30 }
        yield* manager.addComponent(entityId, 'Position', position)

        const retrieved = yield* manager.getComponent<PositionComponent>(entityId, 'Position')
        expect(Option.isSome(retrieved)).toBe(true)
        if (Option.isSome(retrieved)) {
          expect(retrieved.value).toEqual(position)
        }

        const hasComponent = yield* manager.hasComponent(entityId, 'Position')
        expect(hasComponent).toBe(true)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should update existing components', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const entityId = yield* manager.createEntity()

        yield* manager.addComponent(entityId, 'Position', { x: 1, y: 2, z: 3 })
        yield* manager.addComponent(entityId, 'Position', { x: 10, y: 20, z: 30 })

        const updated = yield* manager.getComponent<PositionComponent>(entityId, 'Position')
        expect(Option.isSome(updated)).toBe(true)
        if (Option.isSome(updated)) {
          expect(updated.value).toEqual({ x: 10, y: 20, z: 30 })
        }
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should remove components', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const entityId = yield* manager.createEntity()

        yield* manager.addComponent(entityId, 'Position', { x: 1, y: 2, z: 3 })
        yield* manager.removeComponent(entityId, 'Position')

        const hasComponent = yield* manager.hasComponent(entityId, 'Position')
        expect(hasComponent).toBe(false)

        const component = yield* manager.getComponent(entityId, 'Position')
        expect(Option.isNone(component)).toBe(true)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should get all components of an entity', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const entityId = yield* manager.createEntity()

        yield* manager.addComponent(entityId, 'Position', { x: 1, y: 2, z: 3 })
        yield* manager.addComponent(entityId, 'Velocity', { vx: 10, vy: 0, vz: -5 })
        yield* manager.addComponent(entityId, 'Health', { current: 80, max: 100 })

        const components = yield* manager.getEntityComponents(entityId)
        expect(components.size).toBe(3)
        expect(components.has('Position')).toBe(true)
        expect(components.has('Velocity')).toBe(true)
        expect(components.has('Health')).toBe(true)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )
  })

  describe('Query Operations', () => {
    it.effect('should query entities by single component', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const entity1 = yield* manager.createEntity()
        const entity2 = yield* manager.createEntity()
        const entity3 = yield* manager.createEntity()

        yield* manager.addComponent(entity1, 'Position', { x: 0, y: 0, z: 0 })
        yield* manager.addComponent(entity2, 'Position', { x: 1, y: 1, z: 1 })
        yield* manager.addComponent(entity3, 'Velocity', { vx: 0, vy: 0, vz: 0 })

        const withPosition = yield* manager.getEntitiesWithComponent('Position')
        expect(withPosition).toHaveLength(2)
        expect(withPosition).toContain(entity1)
        expect(withPosition).toContain(entity2)
        expect(withPosition).not.toContain(entity3)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should query entities by multiple components (AND)', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const entity1 = yield* manager.createEntity()
        const entity2 = yield* manager.createEntity()
        const entity3 = yield* manager.createEntity()

        yield* manager.addComponent(entity1, 'Position', { x: 0, y: 0, z: 0 })
        yield* manager.addComponent(entity1, 'Velocity', { vx: 1, vy: 1, vz: 1 })

        yield* manager.addComponent(entity2, 'Position', { x: 10, y: 10, z: 10 })

        yield* manager.addComponent(entity3, 'Position', { x: 20, y: 20, z: 20 })
        yield* manager.addComponent(entity3, 'Velocity', { vx: 2, vy: 2, vz: 2 })

        const withBoth = yield* manager.getEntitiesWithComponents(['Position', 'Velocity'])
        expect(withBoth).toHaveLength(2)
        expect(withBoth).toContain(entity1)
        expect(withBoth).toContain(entity3)
        expect(withBoth).not.toContain(entity2)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should query entities by tag', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const player1 = yield* manager.createEntity('Player1', ['player', 'hero'])
        const player2 = yield* manager.createEntity('Player2', ['player'])
        const enemy = yield* manager.createEntity('Enemy', ['enemy', 'npc'])

        const players = yield* manager.getEntitiesByTag('player')
        expect(players).toHaveLength(2)
        expect(players).toContain(player1)
        expect(players).toContain(player2)
        expect(players).not.toContain(enemy)

        const heroes = yield* manager.getEntitiesByTag('hero')
        expect(heroes).toHaveLength(1)
        expect(heroes).toContain(player1)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )
  })

  describe('Error Handling with it.effect', () => {
    it.effect('should handle entity not found errors with EffectAssert', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const invalidId = 99999 as EntityId

        // EffectAssert.failsを使用してエラーを検証
        const errorCheck = yield* EffectAssert.fails('EntityManagerError')(manager.destroyEntity(invalidId))
        expect(errorCheck).toBe(true)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should handle component operations on non-existent entities', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const invalidId = 99999 as EntityId

        const addResult = yield* Effect.either(manager.addComponent(invalidId, 'Position', { x: 0, y: 0, z: 0 }))
        expect(addResult._tag).toBe('Left')

        const removeResult = yield* Effect.either(manager.removeComponent(invalidId, 'Position'))
        expect(removeResult._tag).toBe('Left')
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should fail when setting active state of non-existent entity', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const nonExistentId = EntityIdBrand(99999)

        const result = yield* Effect.either(manager.setEntityActive(nonExistentId, true))
        expect(result._tag).toBe('Left')

        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('EntityManagerError')
          expect(result.left.reason).toBe('ENTITY_NOT_FOUND')
          expect(result.left.message).toContain(`Entity ${nonExistentId} not found`)
          expect(result.left.entityId).toBe(nonExistentId)
        }
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )
  })

  describe('Performance Testing with PerformanceTest', () => {
    it.effect('should handle 10000 entities efficiently', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager

        // Performance測定を使用
        const createTest = Effect.gen(function* () {
          const entities: EntityId[] = []
          for (let i = 0; i < 10000; i++) {
            const id = yield* manager.createEntity(`Entity${i}`, i % 10 === 0 ? ['special'] : [])
            entities.push(id)
          }
          return entities
        })

        const { result: entities, metrics: createMetrics } = yield* PerformanceTest.measure(createTest)
        const entitiesArray = entities as EntityId[]
        expect(entities).toHaveLength(10000)
        expect(createMetrics.executionTime).toBeLessThan(1000) // 1秒以内

        // コンポーネント追加のパフォーマンステスト
        const componentTest = Effect.gen(function* () {
          for (let i = 0; i < 10000; i++) {
            yield* manager.addComponent(entitiesArray[i]!, 'Position', {
              x: Math.random() * 1000,
              y: Math.random() * 1000,
              z: Math.random() * 1000,
            })

            if (i % 2 === 0) {
              yield* manager.addComponent(entitiesArray[i]!, 'Velocity', {
                vx: Math.random() * 10,
                vy: Math.random() * 10,
                vz: Math.random() * 10,
              })
            }
          }
        })

        const { metrics: componentMetrics } = yield* PerformanceTest.measure(componentTest)
        expect(componentMetrics.executionTime).toBeLessThan(2000) // 2秒以内

        // クエリパフォーマンス測定
        const queryTest = Effect.gen(function* () {
          const withPosition = yield* manager.getEntitiesWithComponent('Position')
          const withVelocity = yield* manager.getEntitiesWithComponent('Velocity')
          const withBoth = yield* manager.getEntitiesWithComponents(['Position', 'Velocity'])

          expect(withPosition).toHaveLength(10000)
          expect(withVelocity).toHaveLength(5000)
          expect(withBoth).toHaveLength(5000)
        })

        const { metrics: queryMetrics } = yield* PerformanceTest.measure(queryTest)
        expect(queryMetrics.executionTime).toBeLessThan(100) // 100ms以内
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )
  })

  describe('Property-Based Testing with PropertyTest', () => {
    it.effect('should maintain consistency across random entity operations', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager

        // Property-basedテストで一貫性を検証
        const iterations = 100
        yield* PropertyTest.invariant(
          Effect.gen(function* () {
            const i = Math.floor(Math.random() * iterations)
            return i
          }),
          (iteration) => {
            const hasComponentSync = Effect.gen(function* () {
              const id = yield* manager.createEntity(`Entity${iteration}`)
              yield* manager.addComponent(id, 'Position', { x: iteration, y: iteration * 2, z: iteration * 3 })

              const hasComponent = yield* manager.hasComponent(id, 'Position')
              const component = yield* manager.getComponent<PositionComponent>(id, 'Position')

              // 不変条件: コンポーネントを追加したら、必ず存在し、取得可能である
              return hasComponent && Option.isSome(component) && component.value.x === iteration
            })
            return Effect.runSync(hasComponentSync)
          },
          iterations
        )
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )
  })

  describe('Batch Operations and Advanced Features', () => {
    it.effect('should batch get components efficiently', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const entities: EntityId[] = []

        // 100個のエンティティを作成
        for (let i = 0; i < 100; i++) {
          const id = yield* manager.createEntity()
          yield* manager.addComponent(id, 'Position', { x: i, y: i * 2, z: i * 3 })
          entities.push(id)
        }

        const positions = yield* manager.batchGetComponents<PositionComponent>('Position')
        expect(positions).toHaveLength(100)

        // データが正しく取得されているか確認
        const positionMap = new Map(positions)
        for (let i = 0; i < 100; i++) {
          const pos = positionMap.get(entities[i]!)
          expect(pos).toEqual({ x: i, y: i * 2, z: i * 3 })
        }
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should iterate components efficiently', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        let totalX = 0

        // エンティティを作成
        for (let i = 1; i <= 10; i++) {
          const id = yield* manager.createEntity()
          yield* manager.addComponent(id, 'Position', { x: i, y: 0, z: 0 })
        }

        // コンポーネントをイテレート
        yield* manager.iterateComponents<PositionComponent, never, EntityManagerError>(
          'Position',
          (_entity, component) =>
            Effect.sync(() => {
              totalX += component.x
            })
        )

        expect(totalX).toBe(55) // 1+2+3+...+10 = 55
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should clear all entities and reset state', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager

        // エンティティを作成
        for (let i = 0; i < 100; i++) {
          const id = yield* manager.createEntity()
          yield* manager.addComponent(id, 'Position', { x: i, y: i, z: i })
        }

        const statsBefore = yield* manager.getStats()
        expect(statsBefore.totalEntities).toBe(100)

        // クリア
        yield* manager.clear()

        const statsAfter = yield* manager.getStats()
        expect(statsAfter.totalEntities).toBe(0)
        expect(statsAfter.totalComponents).toBe(0)

        const allEntities = yield* manager.getAllEntities()
        expect(allEntities).toHaveLength(0)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )
  })

  describe('Entity State Management', () => {
    it.effect('should toggle entity active state', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager
        const entityId = yield* manager.createEntity()

        yield* manager.setEntityActive(entityId, false)
        const metadata1 = yield* manager.getEntityMetadata(entityId)
        expect(Option.isSome(metadata1) && metadata1.value.active).toBe(false)

        yield* manager.setEntityActive(entityId, true)
        const metadata2 = yield* manager.getEntityMetadata(entityId)
        expect(Option.isSome(metadata2) && metadata2.value.active).toBe(true)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should handle non-existent tag searches', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager

        // 存在しないタグでの検索
        const result = yield* manager.getEntitiesByTag('non-existent-tag')
        expect(result).toHaveLength(0)
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )

    it.effect('should handle system update calls', () =>
      Effect.gen(function* () {
        const manager = yield* EntityManager

        // updateメソッドをテスト（現在はvoidを返すプレースホルダー実装）
        yield* manager.update(16.67) // 60FPS相当のdeltaTime
        // エラーが発生しないことを確認
      }).pipe(Effect.provide(EntityManagerTestLayer))
    )
  })
})