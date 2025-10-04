import { beforeEach, describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import { vi } from 'vitest'
import type { Inventory } from '@domain/inventory/InventoryTypes'
import { InventorySchema, PlayerIdSchema } from '@domain/inventory/InventoryTypes'
import { InventoryStorageService } from '../../storage-service'
import { IndexedDBInventoryService } from '../indexed-db'
import { provideLayers } from '../../../../testing/effect'

type StoreKey = string

const mocks = vi.hoisted(() => {
  const stores = new Map<StoreKey, Map<IDBValidKey, unknown>>()
  const createStoreKey = (dbName: string, storeName: string): StoreKey => `${dbName}:${storeName}`
  const resolveStore = (store: StoreKey) => {
    if (!stores.has(store)) {
      stores.set(store, new Map())
    }
    return stores.get(store)!
  }

  return { stores, createStoreKey, resolveStore }
})

vi.mock('idb-keyval', () => ({
  createStore: (dbName: string, storeName: string) => mocks.createStoreKey(dbName, storeName),
  set: async (key: IDBValidKey, value: unknown, store: StoreKey) => {
    mocks.resolveStore(store).set(key, value)
  },
  get: async (key: IDBValidKey, store: StoreKey) => mocks.resolveStore(store).get(key) ?? null,
  del: async (key: IDBValidKey, store: StoreKey) => {
    mocks.resolveStore(store).delete(key)
  },
  clear: async (store: StoreKey) => {
    mocks.resolveStore(store).clear()
  },
  keys: async (store: StoreKey) => Array.from(mocks.resolveStore(store).keys()),
  values: async (store: StoreKey) => Array.from(mocks.resolveStore(store).values()),
}))

const { stores } = mocks

const decodeInventory = Schema.decodeUnknownSync(InventorySchema)
const decodePlayerId = Schema.decodeUnknownSync(PlayerIdSchema)

const inventoryItems = ['minecraft:stone', 'minecraft:dirt', 'minecraft:diamond_sword'] as const

const makeItemStack = (index: number) => ({
  itemId: inventoryItems[index % inventoryItems.length],
  count: 1 + (index % 64),
  metadata: index % 2 === 0 ? undefined : { durability: 0.5 },
})

const createInventory = (playerId: string, variant: number): Inventory =>
  decodeInventory({
    id: `inv-${variant}`,
    playerId: decodePlayerId(playerId),
    slots: Array.from({ length: 36 }, (_, index) => (index % 7 === 0 ? null : makeItemStack(index))),
    hotbar: Array.from({ length: 9 }, (_, index) => index),
    selectedSlot: variant % 9,
    armor: {
      helmet: makeItemStack(variant + 1),
      chestplate: null,
      leggings: makeItemStack(variant + 2),
      boots: null,
    },
    offhand: null,
    version: 1,
    metadata: {
      lastUpdated: variant,
      checksum: `checksum-${variant}`,
    },
  })

const TestLayer = Layer.mergeAll(IndexedDBInventoryService)

beforeEach(() => {
  stores.clear()
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {},
  })
})

describe.skip('inventory/indexed-db', () => {
  it.effect('saveInventory / loadInventory works with mocked idb', () => {
    const inventory = createInventory('550e8400-e29b-41d4-a716-446655440000', 1)

    return Effect.gen(function* () {
        const service = yield* InventoryStorageService
        yield* service.saveInventory(inventory.playerId, inventory)
        const loaded = yield* service.loadInventory(inventory.playerId)
        expect(loaded._tag).toBe('Some')
        expect(loaded.value).toEqual(inventory)
      }).pipe(provideLayers(TestLayer))
  })

  it.effect('deleteInventory removes record and state', () => {
    const inventory = createInventory('123e4567-e89b-12d3-a456-426614174000', 4)

    return Effect.gen(function* () {
        const service = yield* InventoryStorageService
        yield* service.saveInventory(inventory.playerId, inventory)
        yield* service.saveInventoryState({ inventory, persistedAt: 42 })
        const before = yield* service.listStoredInventories()
        expect(before.length).toBe(1)
        yield* service.deleteInventory(inventory.playerId)
        const after = yield* service.listStoredInventories()
        expect(after.length).toBe(0)
      }).pipe(provideLayers(TestLayer))
  })

  it('createBackup / restoreBackup round-trips (property-based)', async () => {
    await FastCheck.assert(
      FastCheck.asyncProperty(FastCheck.uuid(), FastCheck.integer({ min: 0, max: 8 }), async (uuid, variant) => {
        const inventory = createInventory(uuid, variant)

        await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* InventoryStorageService
            yield* service.saveInventory(inventory.playerId, inventory)
            const backup = yield* service.createBackup(inventory.playerId)
            const restored = yield* service.restoreBackup(inventory.playerId, backup)
            expect(restored).toEqual(inventory)
          }).pipe(provideLayers(TestLayer))
        )
      })
    , { verbose: true })
  })
})
