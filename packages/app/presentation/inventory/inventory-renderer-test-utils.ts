import { Array as Arr, Effect, Layer, Option } from 'effect'
import { vi } from 'vitest'
import { InventoryRendererLive } from '@ts-minecraft/app/presentation/inventory/inventory-renderer'
import { InventoryService, INVENTORY_SIZE, HOTBAR_START } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'
import type { SlotIndex } from '@ts-minecraft/kernel'
import { RecipeId } from '@ts-minecraft/kernel'
import type { Recipe } from '@ts-minecraft/inventory'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

export const createMockDomLayer = () => {
  const createElement = vi.fn((_tagName: string) => {
    const el = {
      id: '',
      style: {
        cssText: '',
        display: 'none',
        background: '#333',
        border: '2px solid #666',
      },
      textContent: null as string | null,
      title: '',
      dataset: {} as Record<string, string>,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLElement
    return el
  })

  const MockDomLayer = Layer.succeed(DomOperationsService, {
    createElement,
    appendChild: vi.fn(),
    appendChildTo: vi.fn(),
    removeChild: vi.fn(),
    getParentNode: vi.fn(() => Option.none()),
    setInnerHTML: vi.fn(),
    querySelector: vi.fn(() => Option.none()),
  } as unknown as DomOperationsService)

  return { MockDomLayer, createElement }
}

export const createMockInventoryLayer = (overrideSlots?: ReadonlyArray<Option.Option<unknown>>) => {
  const slots = Option.getOrElse(Option.fromNullable(overrideSlots), () => Arr.makeBy(INVENTORY_SIZE, () => Option.none()))
  const getAllSlots = vi.fn(() => Effect.succeed(slots))
  const getSlot = vi.fn((_: SlotIndex) => Effect.succeed(Option.none()))
  const setSlot = vi.fn((_: SlotIndex, __: unknown) => Effect.void)
  const moveStack = vi.fn((_from: SlotIndex, _to: SlotIndex) => Effect.void)
  const addBlock = vi.fn((_bt: unknown, _count: number) => Effect.succeed(true))
  const removeBlock = vi.fn((_bt: unknown, _count: number) => Effect.succeed(true))
  const getHotbarSlots = vi.fn(() => Effect.succeed(Arr.drop(slots, HOTBAR_START)))
  const serialize = vi.fn(() => Effect.succeed({ slots: [] }))
  const deserialize = vi.fn((_: unknown) => Effect.void)

  const MockInventoryLayer = Layer.succeed(InventoryService, {
    getAllSlots,
    getSlot,
    setSlot,
    moveStack,
    addBlock,
    removeBlock,
    getHotbarSlots,
    serialize,
    deserialize,
  } as unknown as InventoryService)

  return { MockInventoryLayer, getAllSlots, moveStack }
}

export const createMockHotbarLayer = (selectedSlot = 0) => {
  const getSelectedSlot = vi.fn(() => Effect.succeed(selectedSlot))
  const MockHotbarLayer = Layer.succeed(HotbarService, {
    getSelectedSlot,
    setSelectedSlot: (_: SlotIndex) => Effect.void,
    getSelectedBlockType: () => Effect.succeed(Option.none()),
    getSlots: () => Effect.succeed([]),
    update: () => Effect.void,
  } as unknown as HotbarService)
  return { MockHotbarLayer, getSelectedSlot }
}

export const createMockRecipeLayer = () => {
  const recipes: Array<{ id: string; ingredients: Array<{ blockType: string; count: number }>; output: { blockType: string; count: number } }> = []
  const getAllRecipes = vi.fn(() => recipes)
  const findById = vi.fn((_id: string) => Option.none())
  const findCraftable = vi.fn((_available: unknown, _hasTableAccess: boolean) => recipes)
  const craft = vi.fn((_id: string, _inventory: unknown, _hasTableAccess: boolean) => Effect.void)

  const MockRecipeLayer = Layer.succeed(RecipeService, {
    getAllRecipes,
    findById,
    findCraftable,
    craft,
  } as unknown as RecipeService)

  return { MockRecipeLayer, getAllRecipes, findCraftable, craft, recipes, findById }
}

export const createMockFurnaceLayer = () => {
  const startSmelting = vi.fn((_id: string) => Effect.void)
  const collectOutput = vi.fn(() => Effect.succeed(true))
  const MockFurnaceLayer = Layer.succeed(FurnaceService, {
    getState: () => Effect.succeed({ active: Option.none() }),
    getNearestFurnaceState: () => Effect.succeed(Option.none()),
    hasNearbyFurnace: () => Effect.succeed(false),
    startSmelting,
    collectOutput,
    setSelectedFurnace: () => Effect.void,
    clearFurnace: () => Effect.succeed([]),
    dismantleFurnace: () => Effect.succeed(true),
    serialize: () => Effect.succeed([]),
    deserialize: () => Effect.void,
    tick: () => Effect.void,
  } as unknown as FurnaceService)
  return { MockFurnaceLayer, startSmelting, collectOutput }
}

export const createMockGameStateLayer = () => {
  const MockGameStateLayer = Layer.succeed(GameStateService, {
    getPlayerPosition: () => Effect.succeed({ x: 0, y: 0, z: 0 }),
  } as unknown as GameStateService)
  return { MockGameStateLayer }
}

export const createMockChunkManagerLayer = () => {
  const MockChunkManagerLayer = Layer.succeed(ChunkManagerService, {
    getChunk: () => Effect.succeed({ blocks: new Uint8Array(256 * 16 * 16) }),
  } as unknown as ChunkManagerService)
  return { MockChunkManagerLayer }
}

export const buildTestLayer = (
  mockDom = createMockDomLayer(),
  mockInventory = createMockInventoryLayer(),
  mockHotbar = createMockHotbarLayer(),
  mockRecipe = createMockRecipeLayer(),
  mockFurnace = createMockFurnaceLayer(),
  mockGameState = createMockGameStateLayer(),
  mockChunkManager = createMockChunkManagerLayer(),
) =>
  InventoryRendererLive.pipe(
    Layer.provide(mockDom.MockDomLayer),
    Layer.provide(mockInventory.MockInventoryLayer),
    Layer.provide(mockHotbar.MockHotbarLayer),
    Layer.provide(mockRecipe.MockRecipeLayer),
    Layer.provide(mockFurnace.MockFurnaceLayer),
    Layer.provide(mockGameState.MockGameStateLayer),
    Layer.provide(mockChunkManager.MockChunkManagerLayer),
  )

// ---------------------------------------------------------------------------
// Helper: build a minimal Recipe object
// ---------------------------------------------------------------------------

export const makeRecipe = (id: string): Recipe =>
  ({
    id: RecipeId.make(id),
    station: 'inventory' as const,
    ingredients: [{ blockType: 'DIRT', count: 1 }],
    output: { blockType: 'DIRT', count: 1 },
  }) as unknown as Recipe

export const makeFurnaceRecipe = (id: string): Recipe =>
  ({
    id: RecipeId.make(id),
    station: 'furnace' as const,
    ingredients: [{ blockType: 'COBBLESTONE', count: 1 }],
    output: { blockType: 'STONE', count: 1 },
  }) as unknown as Recipe
