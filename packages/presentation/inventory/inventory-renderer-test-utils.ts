import { Array as Arr, Effect, HashMap, Layer, Option } from 'effect'
import { vi } from 'vitest'
import { InventoryRendererLive } from '@ts-minecraft/presentation/inventory/inventory-renderer'
import { InventoryService, INVENTORY_SIZE, HOTBAR_START } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/world'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { RecipeId, SlotIndex } from '@ts-minecraft/core'
import type { Recipe } from '@ts-minecraft/inventory'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

export const createMockDomLayer = () => {
  const createElement = vi.fn((_tagName: string) => {
    const el: Pick<HTMLElement, 'id' | 'textContent' | 'title' | 'dataset'> & {
      style: Pick<CSSStyleDeclaration, 'cssText' | 'display' | 'background' | 'border'>
      addEventListener: ReturnType<typeof vi.fn>
      removeEventListener: ReturnType<typeof vi.fn>
      remove: ReturnType<typeof vi.fn>
    } = {
      id: '',
      style: {
        cssText: '',
        display: 'none',
        background: '#333',
        border: '2px solid #666',
      },
      textContent: '',
      title: '',
      dataset: {} as Record<string, string>,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(),
    }
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
  } as DomOperationsService)

  return { MockDomLayer, createElement }
}

export const createMockInventoryLayer = (overrideSlots?: ReadonlyArray<Option.Option<unknown>>) => {
  const slots = Option.getOrElse(Option.fromNullable(overrideSlots), () => Arr.makeBy(INVENTORY_SIZE, () => Option.none()))
  const getAllSlots = vi.fn(() => Effect.succeed(slots))
  const getSlot = vi.fn((_: SlotIndex) => Effect.succeed(Option.none()))
  const setSlot = vi.fn((_: SlotIndex, __: unknown) => Effect.void)
  const damageSlot = vi.fn((_index: SlotIndex, _amount?: number) => Effect.void)
  const moveStack = vi.fn((_from: SlotIndex, _to: SlotIndex) => Effect.void)
  const addBlock = vi.fn((_bt: unknown, _count: number) => Effect.succeed(true))
  const removeBlock = vi.fn((_bt: unknown, _count: number) => Effect.succeed(true))
  const getHotbarSlots = vi.fn(() => Effect.succeed(Arr.drop(slots, HOTBAR_START)))
  const serialize = vi.fn(() => Effect.succeed({ slots: [] }))
  const deserialize = vi.fn((_: unknown) => Effect.void)

  const MockInventoryLayer = Layer.succeed(InventoryService, InventoryService.of({
    _tag: '@minecraft/application/InventoryService' as const,
    getAllSlots,
    getSlot,
    setSlot,
    damageSlot,
    moveStack,
    addBlock,
    removeBlock,
    getHotbarSlots,
    serialize,
    clear: () => Effect.void,
    deserialize,
  }))

  return { MockInventoryLayer, getAllSlots, moveStack }
}

export const createMockHotbarLayer = (selectedSlot = 0) => {
  const getSelectedSlot = vi.fn(() => Effect.succeed(SlotIndex.make(selectedSlot)))
  const MockHotbarLayer = Layer.succeed(HotbarService, HotbarService.of({
    _tag: '@minecraft/application/HotbarService' as const,
    getSelectedSlot,
    setSelectedSlot: (_: SlotIndex) => Effect.void,
    getSelectedBlockType: () => Effect.succeed(Option.none()),
    getSlots: () => Effect.succeed([]),
    update: () => Effect.void,
  }))
  return { MockHotbarLayer, getSelectedSlot }
}

export const createMockRecipeLayer = () => {
  const recipes: Recipe[] = []
  const getAllRecipes = vi.fn(() => recipes)
  const findById = vi.fn((_id: RecipeId) => Option.none<Recipe>())
  const findCraftable = vi.fn((_available: unknown, _hasTableAccess: boolean, _hasFurnaceAccess: boolean) => recipes)
  const craft = vi.fn((_id: RecipeId, _inventory: InventoryService, _hasTableAccess: boolean, _hasFurnaceAccess: boolean) => Effect.void)

  const MockRecipeLayer = Layer.succeed(RecipeService, RecipeService.of({
    _tag: '@minecraft/application/RecipeService' as const,
    getAllRecipes,
    findById,
    findCraftable,
    craft,
  }))

  return { MockRecipeLayer, getAllRecipes, findCraftable, craft, recipes, findById }
}

export const createMockFurnaceLayer = (overrides: Partial<Pick<FurnaceService,
  'getState' | 'getNearestFurnaceState' | 'hasNearbyFurnace' | 'startSmelting' | 'collectOutput' | 'setSelectedFurnace' | 'clearFurnace' | 'dismantleFurnace' | 'serialize' | 'deserialize' | 'tick'
>> = {}) => {
  const startSmelting = vi.fn((_id: string) => Effect.void)
  const collectOutput = vi.fn(() => Effect.succeed(true))
  const MockFurnaceLayer = Layer.succeed(FurnaceService, FurnaceService.of({
    _tag: '@minecraft/application/FurnaceService' as const,
    getState: () => Effect.succeed({ furnaces: HashMap.empty(), selectedFurnacePosition: Option.none() }),
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
    ...overrides,
  }))
  return { MockFurnaceLayer, startSmelting, collectOutput }
}

export const createMockGameStateLayer = () => {
  const MockGameStateLayer = Layer.succeed(GameStateService, GameStateService.of({
    _tag: '@minecraft/application/GameStateService' as const,
    initialize: () => Effect.void,
    update: (_deltaTime: DeltaTimeSecs) => Effect.void,
    respawn: () => Effect.void,
    getTiming: () => Effect.succeed({ lastFrameTime: 0, deltaTime: DeltaTimeSecs.make(0.016), frameCount: 0 }),
    getPlayerPosition: () => Effect.succeed({ x: 0, y: 0, z: 0 }),
    getCameraRotation: () => Effect.succeed({ yaw: 0, pitch: 0 }),
    isPlayerGrounded: () => Effect.succeed(true),
  }))
  return { MockGameStateLayer }
}

export const createMockChunkManagerLayer = (overrides: Partial<Pick<ChunkManagerService,
  'getChunk' | 'getLoadedChunks' | 'drainRenderDirtyChunks' | 'loadChunksAroundPlayer' | 'markChunkDirty' | 'saveDirtyChunks' | 'unloadChunk'
>> = {}) => {
  const MockChunkManagerLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
    _tag: '@minecraft/application/ChunkManagerService' as const,
    getChunk: () => Effect.succeed({ coord: { x: 0, z: 0 }, blocks: new Uint8Array(256 * 16 * 16), fluid: Option.none() }),
    getLoadedChunks: () => Effect.succeed([]),
    drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
    loadChunksAroundPlayer: () => Effect.succeed(false),
    markChunkDirty: () => Effect.void,
    saveDirtyChunks: () => Effect.void,
    unloadChunk: () => Effect.void,
    setActiveWorldId: (_worldId: unknown) => Effect.void,
    setActiveDimension: (_dim: unknown) => Effect.void,
    ...overrides,
  }))
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
    ingredients: [{ itemType: 'DIRT', count: 1 }],
    output: { itemType: 'DIRT', count: 1 },
  })

export const makeFurnaceRecipe = (id: string): Recipe =>
  ({
    id: RecipeId.make(id),
    station: 'furnace' as const,
    ingredients: [{ itemType: 'COBBLESTONE', count: 1 }],
    output: { itemType: 'STONE', count: 1 },
  })
