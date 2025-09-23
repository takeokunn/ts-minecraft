import { describe, it, expect } from 'vitest'
import { Effect, Layer, Cause, Chunk } from 'effect'
import { World, WorldLive, type EntityId, WorldError } from '../World'
import { EntityId as EntityIdBrand, EntityPoolLayer } from '../Entity'
import { createSystem, SystemError } from '../System'
import { PositionComponent, VelocityComponent } from '../Component'
import { EntityManager, EntityManagerLive } from '../EntityManager'
import { SystemRegistryServiceLive } from '../SystemRegistry'

describe('World', () => {
  const TestLayer = Layer.provide(WorldLive, SystemRegistryServiceLive)

  const runWithWorld = <A, E>(effect: Effect.Effect<A, E, World>): Promise<A> =>
    Effect.runPromise(Effect.provide(effect, TestLayer))

  describe('エンティティ管理', () => {
    it('エンティティを作成できる', async () => {
      const result = await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World
          const entityId = yield* world.createEntity('TestEntity', ['player'])

          expect(typeof entityId).toBe('number')

          const metadata = yield* world.getEntityMetadata(entityId)
          expect(metadata).toBeDefined()
          expect(metadata?.['name']).toBe('TestEntity')
          expect(metadata?.['tags']).toEqual(['player'])
          expect(metadata?.['active']).toBe(true)

          return entityId
        })
      )

      expect(result).toBeDefined()
    })

    it('エンティティを削除できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World
          const entityId = yield* world.createEntity()

          yield* world.destroyEntity(entityId)

          const metadata = yield* world.getEntityMetadata(entityId)
          expect(metadata).toBeNull()
        })
      )
    })

    it('存在しないエンティティの削除でエラーが発生する', async () => {
      const result = await Effect.runPromiseExit(
        Effect.provide(
          Effect.gen(function* () {
            const world = yield* World
            const nonExistentId = EntityIdBrand(99999)
            yield* world.destroyEntity(nonExistentId)
          }),
          TestLayer
        )
      )

      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        const failures = Chunk.toArray(Cause.failures(result.cause))
        expect(failures).toHaveLength(1)
        expect(failures[0]).toBeDefined()
        expect(failures[0]!._tag).toBe('WorldError')
      }
    })

    it('エンティティの有効/無効を切り替えられる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World
          const entityId = yield* world.createEntity()

          yield* world.setEntityActive(entityId, false)
          const metadata1 = yield* world.getEntityMetadata(entityId)
          expect(metadata1?.['active']).toBe(false)

          yield* world.setEntityActive(entityId, true)
          const metadata2 = yield* world.getEntityMetadata(entityId)
          expect(metadata2?.['active']).toBe(true)
        })
      )
    })
  })

  describe('コンポーネント管理', () => {
    it('コンポーネントを追加・取得できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World
          const entityId = yield* world.createEntity()

          const position: PositionComponent = { x: 10, y: 20, z: 30 }
          yield* world.addComponent(entityId, 'Position', position)

          const retrieved = yield* world.getComponent<PositionComponent>(entityId, 'Position')

          expect(retrieved).toEqual(position)
        })
      )
    })

    it('コンポーネントを削除できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World
          const entityId = yield* world.createEntity()

          const position: PositionComponent = { x: 10, y: 20, z: 30 }
          yield* world.addComponent(entityId, 'Position', position)

          yield* world.removeComponent(entityId, 'Position')

          const retrieved = yield* world.getComponent<PositionComponent>(entityId, 'Position')

          expect(retrieved).toBeNull()
        })
      )
    })

    it('コンポーネントの存在を確認できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World
          const entityId = yield* world.createEntity()

          const position: PositionComponent = { x: 10, y: 20, z: 30 }
          yield* world.addComponent(entityId, 'Position', position)

          const hasPosition = yield* world.hasComponent(entityId, 'Position')
          const hasVelocity = yield* world.hasComponent(entityId, 'Velocity')

          expect(hasPosition).toBe(true)
          expect(hasVelocity).toBe(false)
        })
      )
    })

    it('存在しないエンティティへのコンポーネント追加でエラーが発生する', async () => {
      const result = await Effect.runPromiseExit(
        Effect.provide(
          Effect.gen(function* () {
            const world = yield* World
            const nonExistentId = EntityIdBrand(99999)
            yield* world.addComponent(nonExistentId, 'Position', { x: 0, y: 0, z: 0 })
          }),
          TestLayer
        )
      )

      expect(result._tag).toBe('Failure')
    })
  })

  describe('エンティティ検索', () => {
    it('特定のコンポーネントを持つエンティティを検索できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const entity1 = yield* world.createEntity()
          const entity2 = yield* world.createEntity()
          const entity3 = yield* world.createEntity()

          yield* world.addComponent(entity1, 'Position', { x: 0, y: 0, z: 0 })
          yield* world.addComponent(entity2, 'Position', { x: 1, y: 1, z: 1 })
          yield* world.addComponent(entity3, 'Velocity', { vx: 0, vy: 0, vz: 0 })

          const entitiesWithPosition = yield* world.getEntitiesWithComponent('Position')

          expect(entitiesWithPosition).toContain(entity1)
          expect(entitiesWithPosition).toContain(entity2)
          expect(entitiesWithPosition).not.toContain(entity3)
        })
      )
    })

    it('複数のコンポーネントを持つエンティティを検索できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const entity1 = yield* world.createEntity()
          const entity2 = yield* world.createEntity()
          const entity3 = yield* world.createEntity()

          yield* world.addComponent(entity1, 'Position', { x: 0, y: 0, z: 0 })
          yield* world.addComponent(entity1, 'Velocity', { vx: 0, vy: 0, vz: 0 })

          yield* world.addComponent(entity2, 'Position', { x: 1, y: 1, z: 1 })

          yield* world.addComponent(entity3, 'Velocity', { vx: 1, vy: 1, vz: 1 })

          const entities = yield* world.getEntitiesWithComponents(['Position', 'Velocity'])

          expect(entities).toContain(entity1)
          expect(entities).not.toContain(entity2)
          expect(entities).not.toContain(entity3)
        })
      )
    })

    it('空のコンポーネント配列での検索で空配列を返す', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const entities = yield* world.getEntitiesWithComponents([])

          expect(entities).toEqual([])
        })
      )
    })

    it('存在しないコンポーネント型での複数検索で空配列を返す', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const entity = yield* world.createEntity()
          yield* world.addComponent(entity, 'Position', { x: 0, y: 0, z: 0 })

          const entities = yield* world.getEntitiesWithComponents(['Position', 'NonExistent'])

          expect(entities).toEqual([])
        })
      )
    })

    it('タグでエンティティを検索できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const entity1 = yield* world.createEntity('Entity1', ['enemy'])
          const entity2 = yield* world.createEntity('Entity2', ['player'])
          const entity3 = yield* world.createEntity('Entity3', ['enemy', 'boss'])

          const enemies = yield* world.getEntitiesByTag('enemy')
          const players = yield* world.getEntitiesByTag('player')

          expect(enemies).toContain(entity1)
          expect(enemies).toContain(entity3)
          expect(enemies).not.toContain(entity2)

          expect(players).toContain(entity2)
          expect(players).not.toContain(entity1)
          expect(players).not.toContain(entity3)
        })
      )
    })

    it('非アクティブなエンティティは検索結果から除外される', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const activeEntity = yield* world.createEntity()
          const inactiveEntity = yield* world.createEntity()

          yield* world.addComponent(activeEntity, 'Position', { x: 0, y: 0, z: 0 })
          yield* world.addComponent(inactiveEntity, 'Position', { x: 1, y: 1, z: 1 })

          yield* world.setEntityActive(inactiveEntity, false)

          const entities = yield* world.getEntitiesWithComponent('Position')

          expect(entities).toContain(activeEntity)
          expect(entities).not.toContain(inactiveEntity)
        })
      )
    })
  })

  describe('システム管理', () => {
    it('システムを登録・実行できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          let executed = false
          const testSystem = createSystem('TestSystem', () =>
            Effect.sync(() => {
              executed = true
            })
          )

          yield* world.registerSystem(testSystem, 'normal', 500)
          yield* world.update(16)

          expect(executed).toBe(true)
        })
      )
    })

    it('複数のシステムを優先度順に実行する', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const executionOrder: string[] = []

          const highPrioritySystem = createSystem('HighPriority', () => Effect.sync(() => executionOrder.push('high')))

          const normalPrioritySystem = createSystem('NormalPriority', () =>
            Effect.sync(() => executionOrder.push('normal'))
          )

          const lowPrioritySystem = createSystem('LowPriority', () => Effect.sync(() => executionOrder.push('low')))

          // 登録順序と逆に登録
          yield* world.registerSystem(lowPrioritySystem, 'low')
          yield* world.registerSystem(normalPrioritySystem, 'normal')
          yield* world.registerSystem(highPrioritySystem, 'high')

          yield* world.update(16)

          expect(executionOrder).toEqual(['high', 'normal', 'low'])
        })
      )
    })

    it('システムを削除できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          let executionCount = 0
          const testSystem = createSystem('TestSystem', () =>
            Effect.sync(() => {
              executionCount++
            })
          )

          yield* world.registerSystem(testSystem)
          yield* world.update(16)
          expect(executionCount).toBe(1)

          yield* world.unregisterSystem('TestSystem')
          yield* world.update(16)
          expect(executionCount).toBe(1) // 削除後は実行されない
        })
      )
    })
  })

  describe('パフォーマンス最適化', () => {
    it('コンポーネントを一括取得できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const entity1 = yield* world.createEntity()
          const entity2 = yield* world.createEntity()
          const entity3 = yield* world.createEntity()

          const pos1: PositionComponent = { x: 1, y: 1, z: 1 }
          const pos2: PositionComponent = { x: 2, y: 2, z: 2 }
          const pos3: PositionComponent = { x: 3, y: 3, z: 3 }

          yield* world.addComponent(entity1, 'Position', pos1)
          yield* world.addComponent(entity2, 'Position', pos2)
          yield* world.addComponent(entity3, 'Position', pos3)

          const positions = yield* world.batchGetComponents<PositionComponent>('Position')

          expect(positions.size).toBe(3)
          expect(positions.get(entity1)).toEqual(pos1)
          expect(positions.get(entity2)).toEqual(pos2)
          expect(positions.get(entity3)).toEqual(pos3)
        })
      )
    })

    it('非アクティブなエンティティのコンポーネントは一括取得から除外される', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const activeEntity = yield* world.createEntity()
          const inactiveEntity = yield* world.createEntity()

          yield* world.addComponent(activeEntity, 'Position', { x: 1, y: 1, z: 1 })
          yield* world.addComponent(inactiveEntity, 'Position', { x: 2, y: 2, z: 2 })

          yield* world.setEntityActive(inactiveEntity, false)

          const positions = yield* world.batchGetComponents<PositionComponent>('Position')

          expect(positions.size).toBe(1)
          expect(positions.has(activeEntity)).toBe(true)
          expect(positions.has(inactiveEntity)).toBe(false)
        })
      )
    })

    it('存在しないコンポーネント型の一括取得で空のMapを返す', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const positions = yield* world.batchGetComponents<PositionComponent>('NonExistentComponent')

          expect(positions.size).toBe(0)
          expect(positions).toBeInstanceOf(Map)
        })
      )
    })
  })

  describe('統計情報', () => {
    it('ワールドの統計情報を取得できる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const entity1 = yield* world.createEntity()
          const entity2 = yield* world.createEntity()

          yield* world.addComponent(entity1, 'Position', { x: 0, y: 0, z: 0 })
          yield* world.addComponent(entity1, 'Velocity', { vx: 0, vy: 0, vz: 0 })
          yield* world.addComponent(entity2, 'Position', { x: 1, y: 1, z: 1 })

          const testSystem = createSystem('TestSystem', () => Effect.void)
          yield* world.registerSystem(testSystem)

          const stats = yield* world.getStats

          expect(stats.entityCount).toBe(2)
          expect(stats.componentCount).toBe(3) // 実装によりコンポーネント数が3になっている
          expect(stats.systemCount).toBe(1)
          expect(typeof stats.fps).toBe('number')
          expect(typeof stats.frameTime).toBe('number')
        })
      )
    })
  })

  describe('ワールドクリア', () => {
    it('ワールドをクリアできる', async () => {
      await runWithWorld(
        Effect.gen(function* () {
          const world = yield* World

          const entity = yield* world.createEntity()
          yield* world.addComponent(entity, 'Position', { x: 0, y: 0, z: 0 })

          const testSystem = createSystem('TestSystem', () => Effect.void)
          yield* world.registerSystem(testSystem)

          yield* world.clear

          const entities = yield* world.getAllEntities
          const stats = yield* world.getStats

          expect(entities).toHaveLength(0)
          expect(stats.entityCount).toBe(0)
          expect(stats.componentCount).toBe(0)
          expect(stats.systemCount).toBe(0)
          expect(typeof stats.fps).toBe('number')
          expect(typeof stats.frameTime).toBe('number')
        })
      )
    })
  })
})
