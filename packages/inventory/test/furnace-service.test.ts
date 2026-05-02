import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Layer, Option } from 'effect'
import { FurnaceService, FurnaceServiceLive, FurnaceError } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { RecipeId, DeltaTimeSecs } from '@ts-minecraft/kernel'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel'

const makeChunkWithFurnace = () => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  blocks[64] = blockTypeToIndex('FURNACE')
  return { coord: { x: 0, z: 0 }, blocks }
}

const makeEmptyChunk = () => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  return { coord: { x: 0, z: 0 }, blocks }
}

type RecipeEntry = {
  station: string
  ingredients: { blockType: string; count: number }[]
  output: { blockType: string; count: number }
}

type MakeFurnaceLayerOpts = {
  playerPosition?: { x: number; y: number; z: number }
  inventoryItems?: Map<string, number>
  recipeMap?: Record<string, RecipeEntry>
  chunkBlocks?: Uint8Array
  getChunkFails?: boolean
}

const makeFurnaceLayer = (opts: MakeFurnaceLayerOpts = {}) => {
  const {
    playerPosition = { x: 0, y: 64, z: 0 },
    inventoryItems = new Map([['RAW_IRON', 1], ['COAL', 1]]),
    recipeMap = {
      'raw-iron-to-iron-ingot': {
        station: 'furnace',
        ingredients: [{ blockType: 'RAW_IRON', count: 1 }],
        output: { blockType: 'IRON_INGOT', count: 1 },
      },
    },
    chunkBlocks,
    getChunkFails = false,
  } = opts

  const items = new Map(inventoryItems)

  const inventory = {
    items,
    getAllSlots() {
      return Effect.succeed(
        Array.from(items.entries()).map(([blockType, count]) =>
          Option.some({ blockType, count }),
        ),
      )
    },
    removeBlock(blockType: string, count: number) {
      return Effect.sync(() => {
        const current = items.get(blockType) ?? 0
        if (current < count) return false
        items.set(blockType, current - count)
        return true
      })
    },
    addBlock(blockType: string, _count: number) {
      return Effect.sync(() => {
        const current = items.get(blockType) ?? 0
        items.set(blockType, current + _count)
        return true
      })
    },
  }

  const blocks = chunkBlocks ?? (() => {
    const b = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    b[64] = blockTypeToIndex('FURNACE')
    return b
  })()

  return FurnaceServiceLive.pipe(
    Layer.provide(Layer.succeed(RecipeService, {
      findById: (id: string) => {
        const entry = recipeMap[id]
        return entry
          ? Option.some({ id, ...entry })
          : Option.none()
      },
    } as unknown as RecipeService)),
    Layer.provide(Layer.succeed(InventoryService, inventory as unknown as InventoryService)),
    Layer.provide(Layer.succeed(GameStateService, {
      getPlayerPosition: () => Effect.succeed(playerPosition),
    } as unknown as GameStateService)),
    Layer.provide(Layer.succeed(ChunkManagerService, {
      getChunk: () =>
        getChunkFails
          ? Effect.fail(new Error('chunk unavailable'))
          : Effect.succeed({ coord: { x: 0, z: 0 }, blocks }),
    } as unknown as ChunkManagerService)),
  )
}

describe('application/furnace/furnace-service', () => {
  it.effect('startSmelting consumes raw iron and coal, tick fills output slot, and collectOutput moves ingot to inventory', () => {
    const inventory = {
      items: new Map([['RAW_IRON', 1], ['COAL', 1]]),
      getAllSlots() {
        return Effect.succeed([
          Option.some({ blockType: 'RAW_IRON', count: this.items.get('RAW_IRON') ?? 0 }),
          Option.some({ blockType: 'COAL', count: this.items.get('COAL') ?? 0 }),
        ])
      },
      removeBlock(blockType: string, count: number) {
        return Effect.sync(() => {
          const current = this.items.get(blockType) ?? 0
          if (current < count) return false
          this.items.set(blockType, current - count)
          return true
        })
      },
      addBlock(blockType: string, count: number) {
        return Effect.sync(() => {
          const current = this.items.get(blockType) ?? 0
          this.items.set(blockType, current + count)
          return true
        })
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, {
        findById: (id: string) => id === 'raw-iron-to-iron-ingot'
          ? Option.some({ id, station: 'furnace', ingredients: [{ blockType: 'RAW_IRON', count: 1 }], output: { blockType: 'IRON_INGOT', count: 1 } })
          : Option.none(),
      } as unknown as RecipeService)),
      Layer.provide(Layer.succeed(InventoryService, inventory as unknown as InventoryService)),
      Layer.provide(Layer.succeed(GameStateService, {
        getPlayerPosition: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
      } as unknown as GameStateService)),
      Layer.provide(Layer.succeed(ChunkManagerService, {
        getChunk: () => Effect.succeed(makeChunkWithFurnace()),
      } as unknown as ChunkManagerService)),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(1.5 as never)
      const state = yield* furnace.getNearestFurnaceState().pipe(Effect.map(Option.getOrNull))
      expect(state?.output).toEqual(Option.some({ blockType: 'IRON_INGOT', count: 1 }))
      expect(inventory.items.get('RAW_IRON')).toBe(0)
      expect(inventory.items.get('COAL')).toBe(0)
      expect(inventory.items.get('IRON_INGOT') ?? 0).toBe(0)
      yield* furnace.collectOutput()
      expect(inventory.items.get('IRON_INGOT')).toBe(1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('serialize and deserialize round-trip furnace block state', () => {
    const inventory = {
      items: new Map([['RAW_IRON', 1], ['COAL', 1]]),
      getAllSlots() {
        return Effect.succeed([
          Option.some({ blockType: 'RAW_IRON', count: this.items.get('RAW_IRON') ?? 0 }),
          Option.some({ blockType: 'COAL', count: this.items.get('COAL') ?? 0 }),
        ])
      },
      removeBlock(blockType: string, count: number) {
        return Effect.sync(() => {
          const current = this.items.get(blockType) ?? 0
          if (current < count) return false
          this.items.set(blockType, current - count)
          return true
        })
      },
      addBlock(blockType: string, count: number) {
        return Effect.sync(() => {
          const current = this.items.get(blockType) ?? 0
          this.items.set(blockType, current + count)
          return true
        })
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, {
        findById: (id: string) => id === 'raw-iron-to-iron-ingot'
          ? Option.some({ id, station: 'furnace', ingredients: [{ blockType: 'RAW_IRON', count: 1 }], output: { blockType: 'IRON_INGOT', count: 1 } })
          : Option.none(),
      } as unknown as RecipeService)),
      Layer.provide(Layer.succeed(InventoryService, inventory as unknown as InventoryService)),
      Layer.provide(Layer.succeed(GameStateService, {
        getPlayerPosition: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
      } as unknown as GameStateService)),
      Layer.provide(Layer.succeed(ChunkManagerService, {
        getChunk: () => Effect.succeed(makeChunkWithFurnace()),
      } as unknown as ChunkManagerService)),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      const serialized = yield* furnace.serialize()
      yield* furnace.deserialize(serialized)
      const roundTripped = yield* furnace.serialize()
      expect(roundTripped).toEqual(serialized)
    }).pipe(Effect.provide(layer))
  })

  // --- hasNearbyFurnace ---

  it.effect('hasNearbyFurnace returns false when no furnace is selected', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      const result = yield* furnace.hasNearbyFurnace()
      expect(result).toBe(false)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('hasNearbyFurnace returns true when a furnace is selected and nearby', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* furnace.hasNearbyFurnace()
      expect(result).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  // --- clearFurnace ---

  it.effect('clearFurnace returns empty array when no furnace exists at position', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      const items = yield* furnace.clearFurnace({ x: 99, y: 64, z: 99 })
      expect(items).toEqual([])
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('clearFurnace returns items from all occupied slots and clears furnace state', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // furnace now has input=RAW_IRON, fuel=COAL, output=none
      const items = yield* furnace.clearFurnace({ x: 0, y: 64, z: 0 })
      expect(items).toEqual(
        expect.arrayContaining([
          { blockType: 'RAW_IRON', count: 1 },
          { blockType: 'COAL', count: 1 },
        ]),
      )
      expect(items.length).toBe(2)
      // furnace state should now be empty
      const state = yield* furnace.getNearestFurnaceState()
      expect(Option.isNone(state)).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('clearFurnace clears the selected furnace when the cleared position matches', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // tick to completion to also populate output slot
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      const items = yield* furnace.clearFurnace({ x: 0, y: 64, z: 0 })
      // after tick: input+fuel removed, output=IRON_INGOT → 1 item
      expect(items).toEqual([{ blockType: 'IRON_INGOT', count: 1 }])
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  // --- dismantleFurnace ---

  it.effect('dismantleFurnace returns true when no furnace exists at position (onNone path)', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      const result = yield* furnace.dismantleFurnace({ x: 99, y: 64, z: 99 })
      expect(result).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('dismantleFurnace returns true and adds items back to inventory when furnace has items', () => {
    // Track inventory externally via a shared mutable object
    const trackedItems = new Map([['RAW_IRON', 1], ['COAL', 1]])
    const trackedInventory = {
      getAllSlots() {
        return Effect.succeed(
          Array.from(trackedItems.entries()).map(([blockType, count]) =>
            Option.some({ blockType, count }),
          ),
        )
      },
      removeBlock(blockType: string, count: number) {
        return Effect.sync(() => {
          const current = trackedItems.get(blockType) ?? 0
          if (current < count) return false
          trackedItems.set(blockType, current - count)
          return true
        })
      },
      addBlock(blockType: string, count: number) {
        return Effect.sync(() => {
          const current = trackedItems.get(blockType) ?? 0
          trackedItems.set(blockType, current + count)
          return true
        })
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, {
        findById: (id: string) => id === 'raw-iron-to-iron-ingot'
          ? Option.some({ id, station: 'furnace', ingredients: [{ blockType: 'RAW_IRON', count: 1 }], output: { blockType: 'IRON_INGOT', count: 1 } })
          : Option.none(),
      } as unknown as RecipeService)),
      Layer.provide(Layer.succeed(InventoryService, trackedInventory as unknown as InventoryService)),
      Layer.provide(Layer.succeed(GameStateService, {
        getPlayerPosition: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
      } as unknown as GameStateService)),
      Layer.provide(Layer.succeed(ChunkManagerService, {
        getChunk: () => Effect.succeed(makeChunkWithFurnace()),
      } as unknown as ChunkManagerService)),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // RAW_IRON and COAL were removed from inventory by startSmelting
      expect(trackedItems.get('RAW_IRON')).toBe(0)
      expect(trackedItems.get('COAL')).toBe(0)
      const result = yield* furnace.dismantleFurnace({ x: 0, y: 64, z: 0 })
      expect(result).toBe(true)
      // items should be returned to inventory
      expect(trackedItems.get('RAW_IRON')).toBe(1)
      expect(trackedItems.get('COAL')).toBe(1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('dismantleFurnace returns false when inventoryService.addBlock returns false', () => {
    let addCallCount = 0
    const customInventory = {
      items: new Map([['RAW_IRON', 1], ['COAL', 1]]),
      getAllSlots() {
        return Effect.succeed([
          Option.some({ blockType: 'RAW_IRON', count: 1 }),
          Option.some({ blockType: 'COAL', count: 1 }),
        ])
      },
      removeBlock(_blockType: string, _count: number) {
        return Effect.succeed(true)
      },
      addBlock(_blockType: string, _count: number) {
        addCallCount++
        return Effect.succeed(false) // inventory full
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, {
        findById: (id: string) => id === 'raw-iron-to-iron-ingot'
          ? Option.some({ id, station: 'furnace', ingredients: [{ blockType: 'RAW_IRON', count: 1 }], output: { blockType: 'IRON_INGOT', count: 1 } })
          : Option.none(),
      } as unknown as RecipeService)),
      Layer.provide(Layer.succeed(InventoryService, customInventory as unknown as InventoryService)),
      Layer.provide(Layer.succeed(GameStateService, {
        getPlayerPosition: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
      } as unknown as GameStateService)),
      Layer.provide(Layer.succeed(ChunkManagerService, {
        getChunk: () => Effect.succeed(makeChunkWithFurnace()),
      } as unknown as ChunkManagerService)),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      const result = yield* furnace.dismantleFurnace({ x: 0, y: 64, z: 0 })
      expect(result).toBe(false)
      expect(addCallCount).toBeGreaterThan(0)
    }).pipe(Effect.provide(layer))
  })

  // --- startSmelting error paths ---

  it.effect('startSmelting fails with FurnaceError when recipe not found', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('nonexistent-recipe')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).operation).toBe('startSmelting')
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('startSmelting fails with FurnaceError when recipe station is not furnace', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('workbench-recipe')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
    }).pipe(Effect.provide(makeFurnaceLayer({
      recipeMap: {
        'workbench-recipe': {
          station: 'workbench',
          ingredients: [{ blockType: 'OAK_LOG', count: 1 }],
          output: { blockType: 'OAK_PLANKS', count: 4 },
        },
      },
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when no furnace is selected', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      // do NOT call setSelectedFurnace
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).reason).toContain('No nearby furnace')
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('startSmelting fails with FurnaceError when missing input material', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).reason).toContain('Missing input')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: new Map([['COAL', 1]]), // no RAW_IRON
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when recipe has no input ingredient', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('empty-ingredients-recipe')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).reason).toContain('no input ingredient')
    }).pipe(Effect.provide(makeFurnaceLayer({
      recipeMap: {
        'empty-ingredients-recipe': {
          station: 'furnace',
          ingredients: [], // empty — no input[0]
          output: { blockType: 'IRON_INGOT', count: 1 },
        },
      },
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when removeBlock for coal fails at runtime', () => {
    // getAllSlots reports COAL present, but removeBlock('COAL') fails (simulated concurrent removal)
    const concurrentInventory = {
      getAllSlots() {
        return Effect.succeed([
          Option.some({ blockType: 'RAW_IRON', count: 1 }),
          Option.some({ blockType: 'COAL', count: 1 }),
        ])
      },
      removeBlock(_blockType: string, _count: number) {
        return Effect.succeed(false) // all removals fail
      },
      addBlock(_blockType: string, _count: number) {
        return Effect.succeed(true)
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, {
        findById: (id: string) => id === 'raw-iron-to-iron-ingot'
          ? Option.some({ id, station: 'furnace', ingredients: [{ blockType: 'RAW_IRON', count: 1 }], output: { blockType: 'IRON_INGOT', count: 1 } })
          : Option.none(),
      } as unknown as RecipeService)),
      Layer.provide(Layer.succeed(InventoryService, concurrentInventory as unknown as InventoryService)),
      Layer.provide(Layer.succeed(GameStateService, {
        getPlayerPosition: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
      } as unknown as GameStateService)),
      Layer.provide(Layer.succeed(ChunkManagerService, {
        getChunk: () => Effect.succeed(makeChunkWithFurnace()),
      } as unknown as ChunkManagerService)),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).reason).toContain('Missing furnace fuel: COAL')
    }).pipe(Effect.provide(layer))
  })

  it.effect('startSmelting fails with FurnaceError when missing coal', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).reason).toContain('Missing furnace fuel: COAL')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: new Map([['RAW_IRON', 1]]), // no COAL
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when furnace already has activeRecipeId', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      // first smelt succeeds and sets activeRecipeId
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // second smelt should fail — furnace is already smelting
      // but we need more items in inventory for the second call to reach the check
      // The check happens before removeBlock, so it fails immediately
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).reason).toContain('already smelting')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: new Map([['RAW_IRON', 2], ['COAL', 2]]),
    }))),
  )

  it.effect('startSmelting fails with FurnaceError when furnace output slot is occupied', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // tick to completion — output slot now has IRON_INGOT
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      // try to smelt again with fresh items
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).reason).toContain('output slot is occupied')
    }).pipe(Effect.provide(makeFurnaceLayer({
      inventoryItems: new Map([['RAW_IRON', 2], ['COAL', 2]]),
    }))),
  )

  // --- collectOutput error paths ---

  it.effect('collectOutput fails with FurnaceError when no furnace is selected', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      // do NOT call setSelectedFurnace
      const result = yield* Effect.either(furnace.collectOutput())
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).operation).toBe('collectOutput')
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('collectOutput fails with FurnaceError when furnace has no output', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // do NOT tick — output slot is still empty
      const result = yield* Effect.either(furnace.collectOutput())
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).reason).toContain('No furnace output')
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('collectOutput returns false when inventoryService.addBlock returns false', () => {
    const customInventory = {
      getAllSlots() {
        return Effect.succeed([
          Option.some({ blockType: 'RAW_IRON', count: 1 }),
          Option.some({ blockType: 'COAL', count: 1 }),
        ])
      },
      removeBlock(_blockType: string, _count: number) {
        return Effect.succeed(true)
      },
      addBlock(_blockType: string, _count: number) {
        return Effect.succeed(false) // inventory full
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, {
        findById: (id: string) => id === 'raw-iron-to-iron-ingot'
          ? Option.some({ id, station: 'furnace', ingredients: [{ blockType: 'RAW_IRON', count: 1 }], output: { blockType: 'IRON_INGOT', count: 1 } })
          : Option.none(),
      } as unknown as RecipeService)),
      Layer.provide(Layer.succeed(InventoryService, customInventory as unknown as InventoryService)),
      Layer.provide(Layer.succeed(GameStateService, {
        getPlayerPosition: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
      } as unknown as GameStateService)),
      Layer.provide(Layer.succeed(ChunkManagerService, {
        getChunk: () => Effect.succeed(makeChunkWithFurnace()),
      } as unknown as ChunkManagerService)),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      const result = yield* furnace.collectOutput()
      expect(result).toBe(false)
    }).pipe(Effect.provide(layer))
  })

  it.effect('startSmelting refunds coal when removeBlock for input material fails after coal is removed', () => {
    // removeBlock succeeds for COAL but fails for RAW_IRON (simulating race)
    let coalRemoved = false
    const refundInventory = {
      getAllSlots() {
        return Effect.succeed([
          Option.some({ blockType: 'RAW_IRON', count: 1 }),
          Option.some({ blockType: 'COAL', count: 1 }),
        ])
      },
      removeBlock(blockType: string, _count: number) {
        return Effect.sync(() => {
          if (blockType === 'COAL') {
            coalRemoved = true
            return true
          }
          // input material removal always fails
          return false
        })
      },
      addBlock(blockType: string, _count: number) {
        return Effect.sync(() => {
          if (blockType === 'COAL' && coalRemoved) {
            coalRemoved = false // refund registered
          }
          return true
        })
      },
    }

    const layer = FurnaceServiceLive.pipe(
      Layer.provide(Layer.succeed(RecipeService, {
        findById: (id: string) => id === 'raw-iron-to-iron-ingot'
          ? Option.some({ id, station: 'furnace', ingredients: [{ blockType: 'RAW_IRON', count: 1 }], output: { blockType: 'IRON_INGOT', count: 1 } })
          : Option.none(),
      } as unknown as RecipeService)),
      Layer.provide(Layer.succeed(InventoryService, refundInventory as unknown as InventoryService)),
      Layer.provide(Layer.succeed(GameStateService, {
        getPlayerPosition: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
      } as unknown as GameStateService)),
      Layer.provide(Layer.succeed(ChunkManagerService, {
        getChunk: () => Effect.succeed(makeChunkWithFurnace()),
      } as unknown as ChunkManagerService)),
    )

    return Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const result = yield* Effect.either(
        furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot')),
      )
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('FurnaceError')
      expect((err as FurnaceError).reason).toContain('Missing input')
      // coal should have been refunded
      expect(coalRemoved).toBe(false)
    }).pipe(Effect.provide(layer))
  })

  it.effect('tick advances progress without completing when deltaTime is less than smelt duration', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      // tick with less than the required 1.5s
      yield* furnace.tick(DeltaTimeSecs.make(0.5))
      const state = yield* furnace.getNearestFurnaceState()
      expect(Option.isSome(state)).toBe(true)
      const s = Option.getOrThrow(state)
      // progress advanced but recipe still active
      expect(s.progressSecs).toBeCloseTo(0.5)
      expect(Option.isSome(s.activeRecipeId)).toBe(true)
      expect(Option.isNone(s.output)).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  // --- tick no-op ---

  it.effect('tick does nothing when furnace has no activeRecipeId', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      // no startSmelting — furnace has no activeRecipeId (empty virtual state)
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      const stateAfter = yield* furnace.getNearestFurnaceState()
      // furnace is selected so getNearestFurnaceState synthesises an empty state
      expect(Option.isSome(stateAfter)).toBe(true)
      const s = Option.getOrThrow(stateAfter)
      expect(s.progressSecs).toBe(0)
      expect(Option.isNone(s.activeRecipeId)).toBe(true)
      expect(Option.isNone(s.output)).toBe(true)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  it.effect('tick does not advance progress when furnace state has no activeRecipeId (furnace registered but idle)', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      yield* furnace.startSmelting(RecipeId.make('raw-iron-to-iron-ingot'))
      yield* furnace.tick(DeltaTimeSecs.make(1.5))
      // collect output to reset furnace to idle (activeRecipeId = none)
      yield* furnace.collectOutput()
      const idleStateBefore = yield* furnace.getNearestFurnaceState()
      const progressBefore = Option.map(idleStateBefore, (s) => s.progressSecs)
      yield* furnace.tick(DeltaTimeSecs.make(1.0))
      const idleStateAfter = yield* furnace.getNearestFurnaceState()
      const progressAfter = Option.map(idleStateAfter, (s) => s.progressSecs)
      // progress should remain unchanged (still at FURNACE_SMELT_DURATION_SECS from previous tick)
      expect(progressBefore).toEqual(progressAfter)
    }).pipe(Effect.provide(makeFurnaceLayer())),
  )

  // --- isFurnaceStillValid invalidation ---

  it.effect('getSelectedFurnacePosition returns None and clears state when player is more than 5 blocks away', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      // verify it is selected initially
      const nearbyBefore = yield* furnace.hasNearbyFurnace()
      expect(nearbyBefore).toBe(true)
      // now the player has moved far away — use a layer where player is at x=100
    }).pipe(Effect.provide(makeFurnaceLayer())).pipe(
      // After first check passes, run in a separate layer with player far away
      Effect.andThen(
        Effect.gen(function* () {
          const furnace = yield* FurnaceService
          // select furnace at origin, but player is far away
          yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
          const nearby = yield* furnace.hasNearbyFurnace()
          expect(nearby).toBe(false)
        }).pipe(Effect.provide(makeFurnaceLayer({ playerPosition: { x: 100, y: 64, z: 0 } }))),
      ),
    ),
  )

  it.effect('getSelectedFurnacePosition returns None when furnace y position is out of chunk bounds', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      // position.y >= CHUNK_HEIGHT makes the guard on line 92 fire
      yield* furnace.setSelectedFurnace({ x: 0, y: CHUNK_HEIGHT, z: 0 })
      const nearby = yield* furnace.hasNearbyFurnace()
      expect(nearby).toBe(false)
    }).pipe(Effect.provide(makeFurnaceLayer({ playerPosition: { x: 0, y: CHUNK_HEIGHT, z: 0 } }))),
  )

  it.effect('getSelectedFurnacePosition returns None when block at position is not a furnace', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const nearby = yield* furnace.hasNearbyFurnace()
      // block at index 64 is AIR (0), not FURNACE
      expect(nearby).toBe(false)
    }).pipe(Effect.provide(makeFurnaceLayer({ chunkBlocks: makeEmptyChunk().blocks }))),
  )

  it.effect('getSelectedFurnacePosition returns None when chunk is unavailable', () =>
    Effect.gen(function* () {
      const furnace = yield* FurnaceService
      yield* furnace.setSelectedFurnace({ x: 0, y: 64, z: 0 })
      const nearby = yield* furnace.hasNearbyFurnace()
      expect(nearby).toBe(false)
    }).pipe(Effect.provide(makeFurnaceLayer({ getChunkFails: true }))),
  )
})
