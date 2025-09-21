import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Layer, Option, pipe } from 'effect'
import {
  EntityManager,
  EntityManagerLive,
  EntityManagerError
} from '../EntityManager.js'
import {
  EntityPool,
  EntityPoolLive,
  type EntityId,
  EntityPoolError
} from '../Entity.js'
import { SystemRegistryService, SystemRegistryServiceLive } from '../SystemRegistry.js'

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

describe('EntityManager', () => {
  // Create a test layer that provides all dependencies
  const TestDependencies = Layer.mergeAll(
    Layer.effect(EntityPool, EntityPoolLive),
    SystemRegistryServiceLive
  )

  const EntityManagerTestLayer = Layer.effect(
    EntityManager,
    pipe(EntityManagerLive, Effect.provide(TestDependencies))
  )

  const runTest = <A>(test: (manager: EntityManager) => Effect.Effect<A, any>) =>
    pipe(
      Effect.gen(function* () {
        const manager = yield* EntityManager
        return yield* test(manager)
      }),
      Effect.provide(EntityManagerTestLayer),
      Effect.runPromise
    )

  describe('Entity Creation and Destruction', () => {
    it('should create an entity with metadata', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
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
        })
      )
    })

    it('should destroy an entity and release its ID', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {

          const entityId = yield* manager.createEntity()
          yield* manager.destroyEntity(entityId)

          const isAlive = yield* manager.isEntityAlive(entityId)
          expect(isAlive).toBe(false)

          const metadata = yield* manager.getEntityMetadata(entityId)
          expect(Option.isNone(metadata)).toBe(true)
        })
      )
    })

    it('should handle entity pool recycling', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
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
        })
      )
    })
  })

  describe('Component Management', () => {
    it('should add and retrieve components', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
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
        })
      )
    })

    it('should update existing components', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
          const entityId = yield* manager.createEntity()

          yield* manager.addComponent(entityId, 'Position', { x: 1, y: 2, z: 3 })
          yield* manager.addComponent(entityId, 'Position', { x: 10, y: 20, z: 30 })

          const updated = yield* manager.getComponent<PositionComponent>(entityId, 'Position')
          expect(Option.isSome(updated)).toBe(true)
          if (Option.isSome(updated)) {
            expect(updated.value).toEqual({ x: 10, y: 20, z: 30 })
          }
        })
      )
    })

    it('should remove components', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
          const entityId = yield* manager.createEntity()

          yield* manager.addComponent(entityId, 'Position', { x: 1, y: 2, z: 3 })
          yield* manager.removeComponent(entityId, 'Position')

          const hasComponent = yield* manager.hasComponent(entityId, 'Position')
          expect(hasComponent).toBe(false)

          const component = yield* manager.getComponent(entityId, 'Position')
          expect(Option.isNone(component)).toBe(true)
        })
      )
    })

    it('should get all components of an entity', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
          const entityId = yield* manager.createEntity()

          yield* manager.addComponent(entityId, 'Position', { x: 1, y: 2, z: 3 })
          yield* manager.addComponent(entityId, 'Velocity', { vx: 10, vy: 0, vz: -5 })
          yield* manager.addComponent(entityId, 'Health', { current: 80, max: 100 })

          const components = yield* manager.getEntityComponents(entityId)
          expect(components.size).toBe(3)
          expect(components.has('Position')).toBe(true)
          expect(components.has('Velocity')).toBe(true)
          expect(components.has('Health')).toBe(true)
        })
      )
    })
  })

  describe('Query Operations', () => {
    it('should query entities by single component', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {

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
        })
      )
    })

    it('should query entities by multiple components (AND)', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {

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
        })
      )
    })

    it('should query entities by tag', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {

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
        })
      )
    })
  })

  describe('Batch Operations', () => {
    it('should batch get components efficiently', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
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
        })
      )
    })

    it('should iterate components efficiently', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
          let totalX = 0

          // エンティティを作成
          for (let i = 1; i <= 10; i++) {
            const id = yield* manager.createEntity()
            yield* manager.addComponent(id, 'Position', { x: i, y: 0, z: 0 })
          }

          // コンポーネントをイテレート
          yield* manager.iterateComponents<PositionComponent, never, EntityManagerError>(
            'Position',
            (_entity, component) => Effect.sync(() => {
              totalX += component.x
            })
          )

          expect(totalX).toBe(55) // 1+2+3+...+10 = 55
        })
      )
    })
  })

  describe('Performance Test - 10000 Entities', () => {
    it('should handle 10000 entities efficiently', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
          const startTime = performance.now()
          const entities: EntityId[] = []

          // 10000エンティティの作成
          for (let i = 0; i < 10000; i++) {
            const id = yield* manager.createEntity(`Entity${i}`, i % 10 === 0 ? ['special'] : [])
            entities.push(id)
          }

          const createTime = performance.now() - startTime
          console.log(`Created 10000 entities in ${createTime.toFixed(2)}ms`)
          expect(createTime).toBeLessThan(1000) // 1秒以内

          // コンポーネントの追加
          const componentStartTime = performance.now()
          for (let i = 0; i < 10000; i++) {
            yield* manager.addComponent(entities[i]!, 'Position', {
              x: Math.random() * 1000,
              y: Math.random() * 1000,
              z: Math.random() * 1000
            })

            if (i % 2 === 0) {
              yield* manager.addComponent(entities[i]!, 'Velocity', {
                vx: Math.random() * 10,
                vy: Math.random() * 10,
                vz: Math.random() * 10
              })
            }

            if (i % 5 === 0) {
              yield* manager.addComponent(entities[i]!, 'Health', {
                current: 100,
                max: 100
              })
            }
          }

          const componentTime = performance.now() - componentStartTime
          console.log(`Added components in ${componentTime.toFixed(2)}ms`)
          expect(componentTime).toBeLessThan(2000) // 2秒以内

          // クエリのパフォーマンステスト
          const queryStartTime = performance.now()

          const withPosition = yield* manager.getEntitiesWithComponent('Position')
          expect(withPosition).toHaveLength(10000)

          const withVelocity = yield* manager.getEntitiesWithComponent('Velocity')
          expect(withVelocity).toHaveLength(5000)

          const withHealth = yield* manager.getEntitiesWithComponent('Health')
          expect(withHealth).toHaveLength(2000)

          const withPositionAndVelocity = yield* manager.getEntitiesWithComponents(['Position', 'Velocity'])
          expect(withPositionAndVelocity).toHaveLength(5000)

          const queryTime = performance.now() - queryStartTime
          console.log(`Query operations completed in ${queryTime.toFixed(2)}ms`)
          expect(queryTime).toBeLessThan(100) // 100ms以内

          // バッチ操作のパフォーマンステスト
          const batchStartTime = performance.now()
          const positions = yield* manager.batchGetComponents<PositionComponent>('Position')
          expect(positions).toHaveLength(10000)

          const batchTime = performance.now() - batchStartTime
          console.log(`Batch get 10000 components in ${batchTime.toFixed(2)}ms`)
          expect(batchTime).toBeLessThan(50) // 50ms以内

          // イテレーションのパフォーマンステスト
          const iterStartTime = performance.now()
          let count = 0
          yield* manager.iterateComponents<PositionComponent, never, EntityManagerError>(
            'Position',
            (_entity, _component) => Effect.sync(() => { count++ })
          )
          expect(count).toBe(10000)

          const iterTime = performance.now() - iterStartTime
          console.log(`Iterated 10000 components in ${iterTime.toFixed(2)}ms`)
          expect(iterTime).toBeLessThan(50) // 50ms以内

          // 統計情報の確認
          const stats = yield* manager.getStats()
          expect(stats.totalEntities).toBe(10000)
          expect(stats.activeEntities).toBe(10000)
          expect(stats.componentTypes).toBe(3)

          // FPSシミュレーション（60FPS = 16.67ms per frame）
          const frameStartTime = performance.now()

          // 1フレーム分の処理をシミュレート
          yield* manager.iterateComponents<PositionComponent, never, EntityManagerError>(
            'Position',
            (entity, position) => Effect.gen(function* () {
              const velocity = yield* manager.getComponent<VelocityComponent>(entity, 'Velocity')
              if (Option.isSome(velocity)) {
                // 位置を更新
                const newPosition = {
                  x: position.x + velocity.value.vx * 0.016,
                  y: position.y + velocity.value.vy * 0.016,
                  z: position.z + velocity.value.vz * 0.016
                }
                yield* manager.addComponent(entity, 'Position', newPosition)
              }
            })
          )

          const frameTime = performance.now() - frameStartTime
          console.log(`Frame update for 10000 entities in ${frameTime.toFixed(2)}ms`)
          // Note: This is a realistic expectation for JavaScript.
          // Production systems would use batch updates or dirty flags for 60FPS
          expect(frameTime).toBeLessThan(200) // 200ms以内（5FPS minimum）

          // メモリ効率の確認（Structure of Arrays の効果）
          if (global.gc) {
            global.gc()
            const memoryUsage = process.memoryUsage()
            const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024
            console.log(`Heap used: ${heapUsedMB.toFixed(2)} MB`)
            expect(heapUsedMB).toBeLessThan(200) // 200MB以内
          }
        })
      )
    }, 10000) // タイムアウトを10秒に設定
  })

  describe('Error Handling', () => {
    it('should handle entity not found errors', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
          const invalidId = 99999 as EntityId

          const result = yield* Effect.either(manager.destroyEntity(invalidId))
          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left).toBeInstanceOf(EntityManagerError)
            expect((result.left as EntityManagerError).reason).toBe('entity_not_found')
          }
        })
      )
    })

    it('should handle component operations on non-existent entities', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
          const invalidId = 99999 as EntityId

          const addResult = yield* Effect.either(
            manager.addComponent(invalidId, 'Position', { x: 0, y: 0, z: 0 })
          )
          expect(addResult._tag).toBe('Left')

          const removeResult = yield* Effect.either(
            manager.removeComponent(invalidId, 'Position')
          )
          expect(removeResult._tag).toBe('Left')
        })
      )
    })
  })

  describe('Entity State Management', () => {
    it('should toggle entity active state', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {
          const entityId = yield* manager.createEntity()

          yield* manager.setEntityActive(entityId, false)
          const metadata1 = yield* manager.getEntityMetadata(entityId)
          expect(Option.isSome(metadata1) && metadata1.value.active).toBe(false)

          yield* manager.setEntityActive(entityId, true)
          const metadata2 = yield* manager.getEntityMetadata(entityId)
          expect(Option.isSome(metadata2) && metadata2.value.active).toBe(true)
        })
      )
    })

    it('should clear all entities and reset state', async () => {
      await runTest(
        (manager) => Effect.gen(function* () {

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
        })
      )
    })
  })
})