import { beforeEach, describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Schema, TestClock } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import type { Inventory } from '@mc/bc-inventory/domain/inventory-types'
import { InventorySchema, PlayerIdSchema } from '@mc/bc-inventory/domain/inventory-types'
import { InventoryStorageService } from '../../storage-service'
import { LocalStorageInventoryService } from '../local-storage'
import { provideLayers } from '../../../../../testing/effect'

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
    slots: Array.from({ length: 36 }, (_, index) => (index % 5 === 0 ? null : makeItemStack(index))),
    hotbar: Array.from({ length: 9 }, (_, index) => index),
    selectedSlot: variant % 9,
    armor: {
      helmet: null,
      chestplate: makeItemStack(variant + 1),
      leggings: null,
      boots: makeItemStack(variant + 2),
    },
    offhand: null,
    version: 1,
    metadata: {
      lastUpdated: variant,
      checksum: `checksum-${variant}`,
    },
  })

const TestLayer = Layer.mergeAll(TestClock.defaultTestClock, LocalStorageInventoryService)

type LocalStorageLike = {
  readonly length: number
  readonly clear: () => void
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
  readonly removeItem: (key: string) => void
  readonly key: (index: number) => string | null
}

const installMockLocalStorage = () => {
  const store = new Map<string, string>()
  const local: LocalStorageLike = {
    get length() {
      return store.size
    },
    clear: () => {
      store.clear()
    },
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: local,
  })
}

beforeEach(() => {
  installMockLocalStorage()
})

describe('inventory/local-storage', () => {
  it.effect('saveInventory と loadInventory は同一データを往復させる', () => {
    const inventory = createInventory('550e8400-e29b-41d4-a716-446655440000', 1)

    return provideLayers(
      Effect.gen(function* () {
        const service = yield* InventoryStorageService
        yield* service.saveInventory(inventory.playerId, inventory)
        const loaded = yield* service.loadInventory(inventory.playerId)
        expect(loaded._tag).toBe('Some')
        expect(loaded.value).toEqual(inventory)
      }),
      TestLayer
    )
  })

  it.effect('listStoredInventories は保存済みプレイヤーを返す', () => {
    const playerA = createInventory('550e8400-e29b-41d4-a716-446655440000', 2)
    const playerB = createInventory('123e4567-e89b-12d3-a456-426614174000', 3)

    return provideLayers(
      Effect.gen(function* () {
        const service = yield* InventoryStorageService
        yield* service.saveInventory(playerA.playerId, playerA)
        yield* service.saveInventory(playerB.playerId, playerB)
        const ids = yield* service.listStoredInventories()
        expect(ids).toContain(playerA.playerId)
        expect(ids).toContain(playerB.playerId)
      }),
      TestLayer
    )
  })

  it.effect.prop(
    'createBackup -> restoreBackup は round-trip する',
    [FastCheck.uuid(), FastCheck.integer({ min: 0, max: 8 })],
    ([uuid, variant]) =>
      provideLayers(
        Effect.gen(function* () {
          yield* TestClock.setTime(Date.now())

          const storage = globalThis.localStorage as LocalStorageLike
          storage.clear()

          const service = yield* InventoryStorageService
          const inventory = createInventory(uuid, variant)
          yield* service.saveInventory(inventory.playerId, inventory)
          const backup = yield* service.createBackup(inventory.playerId)
          const restored = yield* service.restoreBackup(inventory.playerId, backup)
          expect(restored).toEqual(inventory)
        }),
        TestLayer
      )
  )

  it.effect('clearAllData は格納済みデータを削除する', () => {
    const inventory = createInventory('550e8400-e29b-41d4-a716-446655440000', 5)

    return provideLayers(
      Effect.gen(function* () {
        const service = yield* InventoryStorageService
        yield* service.saveInventory(inventory.playerId, inventory)
        const before = yield* service.listStoredInventories()
        expect(before.length).toBe(1)
        yield* service.clearAllData()
        const after = yield* service.listStoredInventories()
        expect(after.length).toBe(0)
      }),
      TestLayer
    )
  })
})
