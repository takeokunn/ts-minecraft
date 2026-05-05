import { Effect, MutableHashMap, MutableHashSet, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { GameStateService } from '@ts-minecraft/game'
import { FurnaceService } from '@ts-minecraft/furnace'
import { HotbarService, InventoryService } from '@ts-minecraft/inventory'
import { DEFAULT_PLAYER_ID, DeltaTimeSecs, RecipeId, SlotIndex } from '@ts-minecraft/kernel'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { VillagerId } from '@ts-minecraft/entities'
import { createMockRaycastingService, createMockScene, THREE } from './highlight/block-highlight-test-utils'
import { createTestInputService } from './input/input-service-test-utils'
import {
  createMockChunkManagerLayer,
  createMockDomLayer as createInventoryMockDomLayer,
  createMockFurnaceLayer,
  createMockGameStateLayer,
  createMockHotbarLayer,
  createMockInventoryLayer,
} from './inventory/inventory-renderer-test-utils'
import { createMockDomLayer as createSettingsMockDomLayer } from './settings/settings-overlay-test-utils'
import { createMockDomLayer as createTradingMockDomLayer, createTradingTestLayer } from './trading-test-utils'

describe('presentation test utilities', () => {
  it('exposes trading DOM setInnerHTML and village fixture behavior', async () => {
    const { domOperations, createdElements } = createTradingMockDomLayer()
    const { villageSpies } = createTradingTestLayer()
    const parent = domOperations.createElement('section')
    const element = domOperations.createElement('div')

    domOperations.appendChildTo(parent, element)
    expect(Option.isSome(domOperations.getParentNode(element))).toBe(true)
    domOperations.removeChild(element)
    expect(Option.isNone(domOperations.getParentNode(element))).toBe(true)
    domOperations.appendChild(element)
    expect(Option.isNone(domOperations.getParentNode(element))).toBe(true)
    domOperations.setInnerHTML(element, '<span>Offers</span>')
    expect(Option.isNone(domOperations.querySelector(element, '#missing-offer'))).toBe(true)
    const village = await Effect.runPromise(villageSpies.ensureVillageNear({ x: 4, y: 64, z: 8 }))
    const villagerId = VillagerId.make('villager-1')

    expect(createdElements.at(1)?.innerHTML).toBe('<span>Offers</span>')
    expect(village).toMatchObject({ villagers: [expect.any(Object)] })
    expect(await Effect.runPromise(villageSpies.getVillages())).toEqual([])
    expect(await Effect.runPromise(villageSpies.getVillagers())).toEqual([])
    expect(Option.isNone(await Effect.runPromise(villageSpies.findNearestVillager({ x: 0, y: 64, z: 0 }, 8)))).toBe(true)
    expect(Option.isNone(await Effect.runPromise(villageSpies.addVillagerExperience(villagerId, 1)))).toBe(true)
    await Effect.runPromise(villageSpies.update({ x: 0, y: 64, z: 0 }, 0.5, DeltaTimeSecs.make(0.016)))
  })

  it('converts raycast world positions to block coordinates and removes scene children', async () => {
    const raycasting = createMockRaycastingService()
    const block = await Effect.runPromise(raycasting.worldToBlock({ x: 1.8, y: 63.9, z: -2.1 }))
    const { scene, getChildren } = createMockScene()
    const object = new THREE.Object3D()

    scene.add(object)
    scene.remove(object)

    expect(block).toEqual({ x: 1, y: 63, z: -3 })
    expect(getChildren()).toEqual([])
  })

  it('resets mouse delta and toggles pointer-lock state in input service fixtures', async () => {
    const mouseButtons = MutableHashMap.empty<number, boolean>()
    MutableHashMap.set(mouseButtons, 1, true)
    const pressedKeys = MutableHashSet.empty<string>()
    MutableHashSet.add(pressedKeys, 'KeyW')
    const justPressedKeys = MutableHashSet.empty<string>()
    MutableHashSet.add(justPressedKeys, 'Space')
    const input = createTestInputService({
      pressedKeys,
      justPressedKeys,
      mouseButtons,
      mouseDelta: { x: 3, y: -2 },
    })

    expect(await Effect.runPromise(input.isKeyPressed('KeyW'))).toBe(true)
    expect(await Effect.runPromise(input.consumeKeyPress('Space'))).toBe(true)
    expect(await Effect.runPromise(input.consumeKeyPress('Space'))).toBe(false)
    expect(await Effect.runPromise(input.isMouseDown(1))).toBe(true)
    expect(await Effect.runPromise(input.consumeMouseClick(0))).toBe(false)
    expect(await Effect.runPromise(input.getMouseDelta())).toEqual({ x: 3, y: -2 })
    expect(await Effect.runPromise(input.getMouseDelta())).toEqual({ x: 0, y: 0 })

    await Effect.runPromise(input.requestPointerLock())
    expect(await Effect.runPromise(input.isPointerLocked())).toBe(true)
    await Effect.runPromise(input.exitPointerLock())
    expect(await Effect.runPromise(input.isPointerLocked())).toBe(false)
  })

  it('creates inventory DOM mock elements with default visual state', () => {
    const { createElement } = createInventoryMockDomLayer()
    const element = createElement('button')

    element.dataset.slot = '3'

    expect(element.id).toBe('')
    expect(element.textContent).toBe('')
    expect(element.title).toBe('')
    expect(element.dataset.slot).toBe('3')
    expect(element.style.display).toBe('none')
    expect(element.style.background).toBe('#333')
    expect(element.style.border).toBe('2px solid #666')
  })

  it('exercises inventory renderer service fixture no-op methods', async () => {
    const position = { x: 0, y: 64, z: 0 }

    await Effect.runPromise(Effect.gen(function* () {
      const inventory = yield* InventoryService
      yield* inventory.clear()
    }).pipe(Effect.provide(createMockInventoryLayer().MockInventoryLayer)))

    await Effect.runPromise(Effect.gen(function* () {
      const hotbar = yield* HotbarService
      yield* hotbar.setSelectedSlot(SlotIndex.make(1))
      expect(Option.isNone(yield* hotbar.getSelectedBlockType())).toBe(true)
      expect(yield* hotbar.getSlots()).toEqual([])
      yield* hotbar.update()
    }).pipe(Effect.provide(createMockHotbarLayer().MockHotbarLayer)))

    await Effect.runPromise(Effect.gen(function* () {
      const furnace = yield* FurnaceService
      expect(Option.isNone(yield* furnace.getNearestFurnaceState())).toBe(true)
      expect(yield* furnace.hasNearbyFurnace()).toBe(false)
      yield* furnace.startSmelting(RecipeId.make('test:furnace'))
      expect(yield* furnace.collectOutput()).toBe(true)
      yield* furnace.setSelectedFurnace(position)
      expect(yield* furnace.clearFurnace(position)).toEqual([])
      expect(yield* furnace.dismantleFurnace(position)).toBe(true)
      const serialized = yield* furnace.serialize()
      yield* furnace.deserialize(serialized)
      yield* furnace.tick(DeltaTimeSecs.make(0.016))
      expect((yield* furnace.getState()).furnaces).toBeDefined()
    }).pipe(Effect.provide(createMockFurnaceLayer().MockFurnaceLayer)))

    await Effect.runPromise(Effect.gen(function* () {
      const gameState = yield* GameStateService
      yield* gameState.initialize(position)
      yield* gameState.update(DeltaTimeSecs.make(0.016))
      yield* gameState.respawn(position)
      expect(yield* gameState.getTiming()).toMatchObject({ frameCount: 0 })
      expect(yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)).toEqual({ x: 0, y: 0, z: 0 })
      expect(yield* gameState.getCameraRotation()).toEqual({ yaw: 0, pitch: 0 })
      expect(yield* gameState.isPlayerGrounded()).toBe(true)
    }).pipe(Effect.provide(createMockGameStateLayer().MockGameStateLayer)))

    await Effect.runPromise(Effect.gen(function* () {
      const chunks = yield* ChunkManagerService
      expect((yield* chunks.getChunk({ x: 0, z: 0 })).coord).toEqual({ x: 0, z: 0 })
      expect(yield* chunks.getLoadedChunks()).toEqual([])
      expect(yield* chunks.loadChunksAroundPlayer(position, 1)).toBe(false)
      yield* chunks.markChunkDirty({ x: 0, z: 0 })
      yield* chunks.saveDirtyChunks()
      yield* chunks.unloadChunk({ x: 0, z: 0 })
    }).pipe(Effect.provide(createMockChunkManagerLayer().MockChunkManagerLayer)))
  })

  it('creates generic settings controls for non-div and non-button tags', () => {
    const { createElement, querySelector } = createSettingsMockDomLayer()
    const parent = createElement('div')
    const input = createElement('input')

    expect(input.tagName).toBe('INPUT')
    expect(input.id).toBe('')
    expect(input.style.display).toBe('none')
    expect(Option.isSome(querySelector(parent, '#settings-gear-btn'))).toBe(true)
    expect(Option.isNone(querySelector(parent, '#missing-control'))).toBe(true)
  })
})
