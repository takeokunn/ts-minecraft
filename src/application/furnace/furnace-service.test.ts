import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { FurnaceService, FurnaceServiceLive } from '@ts-minecraft/furnace-system'
import { RecipeService } from '@ts-minecraft/crafting-system'
import { InventoryService } from '@ts-minecraft/inventory-system'
import { GameStateService } from '@ts-minecraft/game-session'
import { ChunkManagerService } from '@ts-minecraft/chunk-manager'
import { RecipeId } from '@ts-minecraft/kernel'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/domain'

const makeChunkWithFurnace = () => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  blocks[64] = blockTypeToIndex('FURNACE')
  return { coord: { x: 0, z: 0 }, blocks }
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
})
