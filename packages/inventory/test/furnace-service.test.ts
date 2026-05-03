import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, MutableRef, Option } from 'effect'
import { FurnaceService, FurnaceServiceLive } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { RecipeId, DeltaTimeSecs } from '@ts-minecraft/kernel'
import { makeFurnaceLayer, makeChunkWithFurnace } from './furnace-service-test-utils'

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
    const addCallCountRef = MutableRef.make(0)
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
        MutableRef.update(addCallCountRef, (n) => n + 1)
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
      expect(MutableRef.get(addCallCountRef)).toBeGreaterThan(0)
    }).pipe(Effect.provide(layer))
  })
})
