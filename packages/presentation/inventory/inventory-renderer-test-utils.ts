import { Array as Arr, Effect, HashMap, Layer, Option } from 'effect'
import { vi } from 'vitest'
import { InventoryRendererService } from '@ts-minecraft/presentation/inventory/inventory-renderer'
import { ChestService } from '@ts-minecraft/inventory/application/chest-service'
import { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { InventoryService, INVENTORY_SIZE, HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'
import { RecipeService } from '@ts-minecraft/inventory/application/recipe-service'
import { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/world'
import { XPService } from '@ts-minecraft/entity/application/xp-service'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { RecipeId, SlotIndex } from '@ts-minecraft/core'
import type { Recipe } from '@ts-minecraft/inventory/domain/crafting'

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
  const repairMendingItemsWithXP = vi.fn((amount: number) => Effect.succeed(amount))
  const moveStack = vi.fn((_from: SlotIndex, _to: SlotIndex) => Effect.void)
  const quickMove = vi.fn((_from: SlotIndex) => Effect.void)
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
    repairMendingItemsWithXP,
    moveStack,
    quickMove,
    addBlock,
    removeBlock,
    getHotbarSlots,
    serialize,
    clear: () => Effect.void,
    deserialize,
  }))

  return { MockInventoryLayer, getAllSlots, moveStack, quickMove }
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
  const collectOutput = vi.fn(() => Effect.succeed({ collected: true, xp: 0 }))
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

export const createMockChestLayer = (overrides: Partial<Pick<ChestService,
  'getState' | 'getNearestChestState' | 'hasNearbyChest' | 'setSelectedChest' | 'moveInventoryStackToChestSlot' | 'moveChestStackToInventorySlot' | 'quickMoveInventoryToChest' | 'quickMoveChestToInventory' | 'clearChest' | 'dismantleChest' | 'serialize' | 'deserialize'
>> = {}) => {
  const MockChestLayer = Layer.succeed(ChestService, ChestService.of({
    _tag: '@minecraft/application/ChestService' as const,
    getState: () => Effect.succeed({ chests: HashMap.empty(), selectedChestPosition: Option.none() }),
    getNearestChestState: () => Effect.succeed(Option.none()),
    hasNearbyChest: () => Effect.succeed(false),
    setSelectedChest: () => Effect.void,
    moveInventoryStackToChestSlot: () => Effect.void,
    moveChestStackToInventorySlot: () => Effect.void,
    quickMoveInventoryToChest: () => Effect.void,
    quickMoveChestToInventory: () => Effect.void,
    clearChest: () => Effect.succeed([]),
    dismantleChest: () => Effect.succeed(true),
    serialize: () => Effect.succeed([]),
    deserialize: () => Effect.void,
    ...overrides,
  }))
  return { MockChestLayer }
}

export const createMockEquipmentLayer = () => {
  const equipIfSlotEmpty = vi.fn(() => Effect.succeed(false))
  const MockEquipmentLayer = Layer.succeed(EquipmentService, EquipmentService.of({
    _tag: '@minecraft/application/EquipmentService' as const,
    equip: vi.fn(() => Effect.succeed(false)),
    equipIfSlotEmpty,
    unequipSlot: vi.fn(() => Effect.succeed(Option.none())),
    getEquippedItem: vi.fn(() => Effect.succeed(Option.none())),
    getAll: vi.fn(() =>
      Effect.succeed({
        HELMET: Option.none(),
        CHESTPLATE: Option.none(),
        LEGGINGS: Option.none(),
        BOOTS: Option.none(),
      })
    ),
    getTotalArmorPoints: vi.fn(() => Effect.succeed(0)),
    getTotalProtectionReduction: vi.fn(() => Effect.succeed(0)),
    getTotalProjectileProtectionReduction: vi.fn(() => Effect.succeed(0)),
    getTotalBlastProtectionReduction: vi.fn(() => Effect.succeed(0)),
    damageArmorSlot: vi.fn(() => Effect.void),
    repairMendingItemsWithXP: vi.fn((amount: number) => Effect.succeed(amount)),
    serialize: vi.fn(() => Effect.succeed({})),
    deserialize: vi.fn(() => Effect.void),
    reset: vi.fn(() => Effect.void),
  }))

  return { MockEquipmentLayer, equipIfSlotEmpty }
}

const MOCK_PLAYER_XP = { totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 }

export const createMockXPLayer = () => {
  const addXP = vi.fn((_xp: number) => Effect.succeed(MOCK_PLAYER_XP))
  const MockXPLayer = Layer.succeed(XPService, XPService.of({
    _tag: '@minecraft/application/XPService' as const,
    getXP: () => Effect.succeed(MOCK_PLAYER_XP),
    addXP,
    setTotalXP: (_totalXP: number) => Effect.void,
    spendLevels: (_levels: number) => Effect.succeed(MOCK_PLAYER_XP),
    reset: () => Effect.void,
  }))
  return { MockXPLayer, addXP }
}

export const createMockGameStateLayer = () => {
  const MockGameStateLayer = Layer.succeed(GameStateService, GameStateService.of({
    _tag: '@minecraft/application/GameStateService' as const,
    initialize: () => Effect.void,
    update: (_deltaTime: DeltaTimeSecs) => Effect.void,
    respawn: () => Effect.void,
    setPlayerPosition: () => Effect.void,
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
  mockXP = createMockXPLayer(),
  mockChest = createMockChestLayer(),
  mockEquipment = createMockEquipmentLayer(),
) =>
  InventoryRendererService.Default.pipe(
    Layer.provide(mockDom.MockDomLayer),
    Layer.provide(mockInventory.MockInventoryLayer),
    Layer.provide(mockHotbar.MockHotbarLayer),
    Layer.provide(mockRecipe.MockRecipeLayer),
    Layer.provide(mockFurnace.MockFurnaceLayer),
    Layer.provide(mockChest.MockChestLayer),
    Layer.provide(mockEquipment.MockEquipmentLayer),
    Layer.provide(mockGameState.MockGameStateLayer),
    Layer.provide(mockChunkManager.MockChunkManagerLayer),
    Layer.provide(mockXP.MockXPLayer),
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
