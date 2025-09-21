import { describe, it, expect } from 'vitest'
import { Effect, Option, pipe } from 'effect'
import {
  EntityId,
  EntityPoolError,
  EntityPoolLive,
  type EntityPool,
  createComponentStorage,
  createArchetypeManager,
  type EntityMetadata
} from '../Entity.js'

describe('Entity', () => {
  describe('EntityPool', () => {
    it('should allocate unique entity IDs', async () => {
      const pool = await Effect.runPromise(EntityPoolLive)

      const id1 = await Effect.runPromise(pool.allocate())
      const id2 = await Effect.runPromise(pool.allocate())
      const id3 = await Effect.runPromise(pool.allocate())

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })

    it('should recycle deallocated IDs', async () => {
      const pool = await Effect.runPromise(EntityPoolLive)

      const id1 = await Effect.runPromise(pool.allocate())
      await Effect.runPromise(pool.deallocate(id1))
      const id2 = await Effect.runPromise(pool.allocate())

      // リサイクルされたIDは同じになるはず
      expect(id2).toBe(id1)
    })

    it('should track allocated status correctly', async () => {
      const pool = await Effect.runPromise(EntityPoolLive)

      const id = await Effect.runPromise(pool.allocate())

      const isAllocated1 = await Effect.runPromise(pool.isAllocated(id))
      expect(isAllocated1).toBe(true)

      await Effect.runPromise(pool.deallocate(id))

      const isAllocated2 = await Effect.runPromise(pool.isAllocated(id))
      expect(isAllocated2).toBe(false)
    })

    it('should fail when deallocating unallocated entity', async () => {
      const pool = await Effect.runPromise(EntityPoolLive)

      const invalidId = EntityId(99999)
      const result = await pipe(pool.deallocate(invalidId), Effect.either, Effect.runPromise)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(EntityPoolError)
        expect(result.left.reason).toBe('entity_not_allocated')
      }
    })

    it('should reset pool state', async () => {
      const pool = await Effect.runPromise(EntityPoolLive)

      // いくつかのエンティティを割り当て
      const ids = await Promise.all([
        Effect.runPromise(pool.allocate()),
        Effect.runPromise(pool.allocate()),
        Effect.runPromise(pool.allocate())
      ])

      // リセット
      await Effect.runPromise(pool.reset())

      // リセット後、すべてのIDは未割り当てになるはず
      for (const id of ids) {
        const isAllocated = await Effect.runPromise(pool.isAllocated(id))
        expect(isAllocated).toBe(false)
      }

      const stats = await Effect.runPromise(pool.getStats())
      expect(stats.allocatedCount).toBe(0)
      expect(stats.recycledCount).toBe(0)
    })

    it('should provide accurate statistics', async () => {
      const pool = await Effect.runPromise(EntityPoolLive)

      const initialStats = await Effect.runPromise(pool.getStats())
      expect(initialStats.allocatedCount).toBe(0)
      expect(initialStats.recycledCount).toBe(0)

      // 3つ割り当て
      const id1 = await Effect.runPromise(pool.allocate())
      const id2 = await Effect.runPromise(pool.allocate())
      const id3 = await Effect.runPromise(pool.allocate())

      const afterAllocStats = await Effect.runPromise(pool.getStats())
      expect(afterAllocStats.allocatedCount).toBe(3)
      expect(afterAllocStats.recycledCount).toBe(0)

      // 1つ解放してリサイクル
      await Effect.runPromise(pool.deallocate(id2))
      await Effect.runPromise(pool.allocate())

      const afterRecycleStats = await Effect.runPromise(pool.getStats())
      expect(afterRecycleStats.allocatedCount).toBe(3)
      expect(afterRecycleStats.recycledCount).toBe(1)
    })
  })

  describe('ComponentStorage (Structure of Arrays)', () => {
    interface TestComponent {
      x: number
      y: number
      z: number
    }

    it('should insert and retrieve components', async () => {
      const storage = createComponentStorage<TestComponent>()
      const entityId = EntityId(1)
      const component = { x: 10, y: 20, z: 30 }

      await Effect.runPromise(storage.insert(entityId, component))
      const retrieved = await Effect.runPromise(storage.get(entityId))

      expect(Option.isSome(retrieved)).toBe(true)
      if (Option.isSome(retrieved)) {
        expect(retrieved.value).toEqual(component)
      }
    })

    it('should update existing components', async () => {
      const storage = createComponentStorage<TestComponent>()
      const entityId = EntityId(1)

      await Effect.runPromise(storage.insert(entityId, { x: 1, y: 2, z: 3 }))
      await Effect.runPromise(storage.insert(entityId, { x: 10, y: 20, z: 30 }))

      const retrieved = await Effect.runPromise(storage.get(entityId))
      expect(Option.isSome(retrieved)).toBe(true)
      if (Option.isSome(retrieved)) {
        expect(retrieved.value).toEqual({ x: 10, y: 20, z: 30 })
      }
    })

    it('should remove components and maintain array compactness', async () => {
      const storage = createComponentStorage<TestComponent>()
      const entity1 = EntityId(1)
      const entity2 = EntityId(2)
      const entity3 = EntityId(3)

      // 3つのコンポーネントを追加
      await Effect.runPromise(storage.insert(entity1, { x: 1, y: 1, z: 1 }))
      await Effect.runPromise(storage.insert(entity2, { x: 2, y: 2, z: 2 }))
      await Effect.runPromise(storage.insert(entity3, { x: 3, y: 3, z: 3 }))

      // 中間の要素を削除
      const removed = await Effect.runPromise(storage.remove(entity2))
      expect(removed).toBe(true)

      // 削除されたことを確認
      const has2 = await Effect.runPromise(storage.has(entity2))
      expect(has2).toBe(false)

      // 他の要素はまだ存在
      const has1 = await Effect.runPromise(storage.has(entity1))
      const has3 = await Effect.runPromise(storage.has(entity3))
      expect(has1).toBe(true)
      expect(has3).toBe(true)

      // 配列がコンパクトに保たれていることを確認
      const stats = await Effect.runPromise(storage.getStats())
      expect(stats.size).toBe(2)
    })

    it('should batch retrieve all components efficiently', async () => {
      const storage = createComponentStorage<TestComponent>()
      const components: [EntityId, TestComponent][] = [
        [EntityId(1), { x: 1, y: 1, z: 1 }],
        [EntityId(2), { x: 2, y: 2, z: 2 }],
        [EntityId(3), { x: 3, y: 3, z: 3 }]
      ]

      // 複数のコンポーネントを追加
      for (const [id, component] of components) {
        await Effect.runPromise(storage.insert(id, component))
      }

      // バッチ取得
      const all = await Effect.runPromise(storage.getAll())
      expect(all).toHaveLength(3)

      // 各コンポーネントが正しく取得されているか確認
      const allMap = new Map(all)
      for (const [id, component] of components) {
        expect(allMap.get(id)).toEqual(component)
      }
    })

    it('should iterate over components efficiently', async () => {
      const storage = createComponentStorage<TestComponent>()

      // 100個のコンポーネントを追加
      for (let i = 0; i < 100; i++) {
        await Effect.runPromise(
          storage.insert(EntityId(i), { x: i, y: i * 2, z: i * 3 })
        )
      }

      // イテレーション
      let count = 0
      let sumX = 0
      await Effect.runPromise(
        storage.iterate((entity, component) =>
          Effect.sync(() => {
            count++
            sumX += component.x
          })
        )
      )

      expect(count).toBe(100)
      expect(sumX).toBe(4950) // 0+1+2+...+99 = 99*100/2 = 4950
    })

    it('should provide raw data access for maximum performance', async () => {
      const storage = createComponentStorage<TestComponent>()
      const numEntities = 10

      for (let i = 0; i < numEntities; i++) {
        await Effect.runPromise(
          storage.insert(EntityId(i), { x: i, y: 0, z: 0 })
        )
      }

      const raw = await Effect.runPromise(storage.getRawData())
      expect(raw.data).toHaveLength(numEntities)
      expect(raw.entities).toHaveLength(numEntities)

      // データが正しい順序で格納されているか確認
      for (let i = 0; i < numEntities; i++) {
        expect(raw.entities[i]).toBe(i)
        const component = raw.data[i]
        expect(component?.x).toBe(i)
      }
    })

    it('should clear all data', async () => {
      const storage = createComponentStorage<TestComponent>()

      // データを追加
      await Effect.runPromise(storage.insert(EntityId(1), { x: 1, y: 1, z: 1 }))
      await Effect.runPromise(storage.insert(EntityId(2), { x: 2, y: 2, z: 2 }))

      // クリア
      await Effect.runPromise(storage.clear())

      // すべてのデータが削除されていることを確認
      const has1 = await Effect.runPromise(storage.has(EntityId(1)))
      const has2 = await Effect.runPromise(storage.has(EntityId(2)))
      expect(has1).toBe(false)
      expect(has2).toBe(false)

      const stats = await Effect.runPromise(storage.getStats())
      expect(stats.size).toBe(0)
    })
  })

  describe('ArchetypeManager', () => {
    it('should create and cache archetypes', async () => {
      const manager = createArchetypeManager()

      const components1 = new Set(['Position', 'Velocity'])
      const archetype1 = await Effect.runPromise(
        manager.getOrCreateArchetype(components1)
      )

      const archetype2 = await Effect.runPromise(
        manager.getOrCreateArchetype(components1)
      )

      // 同じコンポーネントセットに対しては同じアーキタイプが返される
      expect(archetype1.id).toBe(archetype2.id)
      expect(archetype1).toBe(archetype2)
    })

    it('should create different archetypes for different component sets', async () => {
      const manager = createArchetypeManager()

      const components1 = new Set(['Position'])
      const components2 = new Set(['Position', 'Velocity'])
      const components3 = new Set(['Velocity', 'Position']) // 順序が異なっても同じとして扱う

      const archetype1 = await Effect.runPromise(
        manager.getOrCreateArchetype(components1)
      )
      const archetype2 = await Effect.runPromise(
        manager.getOrCreateArchetype(components2)
      )
      const archetype3 = await Effect.runPromise(
        manager.getOrCreateArchetype(components3)
      )

      expect(archetype1.id).not.toBe(archetype2.id)
      expect(archetype2.id).toBe(archetype3.id) // 順序に関わらず同じ
    })

    it('should move entities between archetypes', async () => {
      const manager = createArchetypeManager()
      const entityId = EntityId(1)

      const components1 = new Set(['Position'])
      const components2 = new Set(['Position', 'Velocity'])

      // 最初のアーキタイプにエンティティを追加
      await Effect.runPromise(manager.moveEntity(entityId, components1))

      const entities1 = await Effect.runPromise(
        manager.getEntitiesWithArchetype(components1)
      )
      expect(Array.from(entities1)).toContain(entityId)

      // 別のアーキタイプに移動
      await Effect.runPromise(manager.moveEntity(entityId, components2))

      const entities1After = await Effect.runPromise(
        manager.getEntitiesWithArchetype(components1)
      )
      const entities2After = await Effect.runPromise(
        manager.getEntitiesWithArchetype(components2)
      )

      expect(Array.from(entities1After)).not.toContain(entityId)
      expect(Array.from(entities2After)).toContain(entityId)
    })

    it('should remove entities from archetypes', async () => {
      const manager = createArchetypeManager()
      const entityId = EntityId(1)
      const components = new Set(['Position', 'Velocity'])

      await Effect.runPromise(manager.moveEntity(entityId, components))
      await Effect.runPromise(manager.removeEntity(entityId))

      const entities = await Effect.runPromise(
        manager.getEntitiesWithArchetype(components)
      )
      expect(Array.from(entities)).not.toContain(entityId)
    })

    it('should get all entities with specific archetype', async () => {
      const manager = createArchetypeManager()
      const components = new Set(['Position', 'Velocity'])

      const entities = [EntityId(1), EntityId(2), EntityId(3)]

      for (const entity of entities) {
        await Effect.runPromise(manager.moveEntity(entity, components))
      }

      const retrieved = await Effect.runPromise(
        manager.getEntitiesWithArchetype(components)
      )

      expect(retrieved.size).toBe(3)
      for (const entity of entities) {
        expect(retrieved.has(entity)).toBe(true)
      }
    })

    it('should clear all archetype data', async () => {
      const manager = createArchetypeManager()

      const components1 = new Set(['Position'])
      const components2 = new Set(['Velocity'])

      await Effect.runPromise(manager.moveEntity(EntityId(1), components1))
      await Effect.runPromise(manager.moveEntity(EntityId(2), components2))

      await Effect.runPromise(manager.clear())

      const entities1 = await Effect.runPromise(
        manager.getEntitiesWithArchetype(components1)
      )
      const entities2 = await Effect.runPromise(
        manager.getEntitiesWithArchetype(components2)
      )

      expect(entities1.size).toBe(0)
      expect(entities2.size).toBe(0)
    })
  })

  describe('Performance Characteristics', () => {
    it('should handle large number of components efficiently', async () => {
      const storage = createComponentStorage<{ value: number }>()
      const startTime = performance.now()

      // 10000個のコンポーネントを追加
      for (let i = 0; i < 10000; i++) {
        await Effect.runPromise(
          storage.insert(EntityId(i), { value: i })
        )
      }

      const insertTime = performance.now() - startTime
      console.log(`Inserted 10000 components in ${insertTime.toFixed(2)}ms`)
      expect(insertTime).toBeLessThan(500) // 500ms以内

      // イテレーションのパフォーマンステスト
      const iterStartTime = performance.now()
      let sum = 0
      await Effect.runPromise(
        storage.iterate((_entity, component) =>
          Effect.sync(() => {
            sum += component.value
          })
        )
      )

      const iterTime = performance.now() - iterStartTime
      console.log(`Iterated 10000 components in ${iterTime.toFixed(2)}ms`)
      expect(iterTime).toBeLessThan(100) // 100ms以内
      expect(sum).toBe(49995000) // 0+1+2+...+9999
    })

    it('should maintain memory efficiency with Structure of Arrays', async () => {
      const storage = createComponentStorage<{
        x: number
        y: number
        z: number
        w: number
      }>()

      // 大量のコンポーネントを追加
      for (let i = 0; i < 5000; i++) {
        await Effect.runPromise(
          storage.insert(EntityId(i), { x: i, y: i, z: i, w: i })
        )
      }

      const stats = await Effect.runPromise(storage.getStats())
      expect(stats.size).toBe(5000)

      // メモリ効率の確認（実際のメモリ使用量は環境依存）
      if (global.gc) {
        global.gc()
        const memoryUsage = process.memoryUsage()
        const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024
        console.log(`Heap used for 5000 components: ${heapUsedMB.toFixed(2)} MB`)
        expect(heapUsedMB).toBeLessThan(100) // 100MB以内
      }
    })
  })
})