import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableHashSet, Option, Ref } from 'effect'
import * as THREE from 'three'
import { createFrameHandler, createFrameHandlers, type FrameHandlerDeps } from '@/frame-handler'
import { KeyMappings } from '@/application/input/key-mappings'
import type { DeltaTimeSecs } from '@/shared/kernel'
import {
  DEFAULT_SETTINGS,
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  makeTradingPresentation,
  runFrame,
} from '../test/frame-handler-test-kit'

type FrameHarnessOptions = {
  readonly paused?: boolean
  readonly inventoryOpen?: boolean
  readonly settingsOpen?: boolean
  readonly withComposer?: boolean
  readonly pressedKeys?: MutableHashSet.MutableHashSet<string>
}

const arrangeFrameHarness = ({
  paused = false,
  inventoryOpen = false,
  settingsOpen = false,
  withComposer = false,
  pressedKeys = MutableHashSet.empty<string>(),
}: FrameHarnessOptions = {}) =>
  Effect.gen(function* () {
    const inventoryState = { open: inventoryOpen }
    const settingsState = { open: settingsOpen }
    const deps = yield* makeDeps(paused, withComposer)
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer(inventoryState),
      settingsOverlay: makeSettingsOverlay(settingsState),
    })

    return {
      deps,
      services,
      inventoryState,
      settingsState,
    }
  })

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('frame-handler', () => {
  // -------------------------------------------------------------------------
  // Pause gate: camera update and block interaction
  // -------------------------------------------------------------------------

  describe('pause gate', () => {
    it.effect('suppresses firstPersonCamera.update when gamePausedRef is true', () => Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness({ paused: true })
      const cameraUpdateSpy = vi.fn(() => Effect.void)
      // Override firstPersonCamera.update with spy
      ;(services.firstPersonCamera as unknown as { update: unknown }).update = cameraUpdateSpy

      yield* runFrame(deps, services)

      expect(cameraUpdateSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls firstPersonCamera.update when gamePausedRef is false', () => Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness()
      const cameraUpdateSpy = vi.fn(() => Effect.void)
      ;(services.firstPersonCamera as unknown as { update: unknown }).update = cameraUpdateSpy

      yield* runFrame(deps, services)

      expect(cameraUpdateSpy).toHaveBeenCalledOnce()
    }))

    it.effect('suppresses hotbarService.update when gamePausedRef is true', () => Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness({ paused: true })
      const hotbarUpdateSpy = vi.fn(() => Effect.void)
      ;(services.hotbarService as unknown as { update: unknown }).update = hotbarUpdateSpy

      yield* runFrame(deps, services)

      expect(hotbarUpdateSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls hotbarService.update when gamePausedRef is false', () => Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness()
      const hotbarUpdateSpy = vi.fn(() => Effect.void)
      ;(services.hotbarService as unknown as { update: unknown }).update = hotbarUpdateSpy

      yield* runFrame(deps, services)

      expect(hotbarUpdateSpy).toHaveBeenCalledOnce()
    }))
  })

  // -------------------------------------------------------------------------
  // Escape key: overlay toggle logic
  // -------------------------------------------------------------------------

  describe('Escape key handling', () => {
    it.effect('closes inventory and sets gamePausedRef to false when Escape is pressed while inventory is open', () => Effect.gen(function* () {
      const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)
      const { deps, services, inventoryState } = yield* arrangeFrameHarness({ paused: true, inventoryOpen: true, pressedKeys })

      yield* runFrame(deps, services)

      // Inventory must now be closed
      expect(inventoryState.open).toBe(false)
      // gamePausedRef must be false
      const paused = yield* Ref.get(deps.gamePausedRef)
      expect(paused).toBe(false)
    }))

    it.effect('closes settings and sets gamePausedRef to false when Escape is pressed while settings is open', () => Effect.gen(function* () {
      const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)
      const { deps, services, settingsState } = yield* arrangeFrameHarness({ paused: true, settingsOpen: true, pressedKeys })

      yield* runFrame(deps, services)

      // Settings must now be closed
      expect(settingsState.open).toBe(false)
      // gamePausedRef must be false
      const paused = yield* Ref.get(deps.gamePausedRef)
      expect(paused).toBe(false)
    }))

    it.effect('opens settings and sets gamePausedRef to true when Escape is pressed while nothing is open', () => Effect.gen(function* () {
      const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)
      const { deps, services, settingsState } = yield* arrangeFrameHarness({ pressedKeys })

      yield* runFrame(deps, services)

      // Settings must now be open
      expect(settingsState.open).toBe(true)
      // gamePausedRef must be true
      const paused = yield* Ref.get(deps.gamePausedRef)
      expect(paused).toBe(true)
    }))

    it.effect('does not change overlay states when Escape is not pressed', () => Effect.gen(function* () {
      const { deps, services, inventoryState, settingsState } = yield* arrangeFrameHarness()

      yield* runFrame(deps, services)

      expect(inventoryState.open).toBe(false)
      expect(settingsState.open).toBe(false)
      const paused = yield* Ref.get(deps.gamePausedRef)
      expect(paused).toBe(false)
    }))
  })

  // -------------------------------------------------------------------------
  // KeyE (inventory) key: overlay toggle logic
  // -------------------------------------------------------------------------

  describe('inventory key (KeyE) handling', () => {
    it.effect('opens inventory and sets gamePausedRef to true when KeyE is pressed while inventory is closed', () => Effect.gen(function* () {
      const invState = { open: false }
      const setState = { open: false }
      const pressedKeys = MutableHashSet.make(KeyMappings.INVENTORY_OPEN)

      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      yield* runFrame(deps, services)

      // Inventory must now be open
      expect(invState.open).toBe(true)
      // gamePausedRef must be true
      const paused = yield* Ref.get(deps.gamePausedRef)
      expect(paused).toBe(true)
    }))

    it.effect('closes inventory and sets gamePausedRef to false when KeyE is pressed while inventory is open', () => Effect.gen(function* () {
      const invState = { open: true }
      const setState = { open: false }
      const pressedKeys = MutableHashSet.make(KeyMappings.INVENTORY_OPEN)

      const deps = yield* makeDeps(true /* paused because inventory is open */)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      yield* runFrame(deps, services)

      // Inventory must now be closed
      expect(invState.open).toBe(false)
      // gamePausedRef must be false
      const paused = yield* Ref.get(deps.gamePausedRef)
      expect(paused).toBe(false)
    }))

    it.effect('closes settings and opens inventory when KeyE is pressed while settings is open', () => Effect.gen(function* () {
      const invState = { open: false }
      const setState = { open: true }
      const pressedKeys = MutableHashSet.make(KeyMappings.INVENTORY_OPEN)

      const deps = yield* makeDeps(true /* paused because settings is open */)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      yield* runFrame(deps, services)

      // Settings must be closed, inventory must be open
      expect(setState.open).toBe(false)
      expect(invState.open).toBe(true)
      // gamePausedRef must be true (inventory now open)
      const paused = yield* Ref.get(deps.gamePausedRef)
      expect(paused).toBe(true)
    }))
  })

  // -------------------------------------------------------------------------
  // Step 1: Chunk streaming
  // -------------------------------------------------------------------------

  describe('step 1 — chunk streaming', () => {
    it.effect('production split handlers keep chunk streaming on maintenance only', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const loadSpy = vi.fn(() => Effect.void)
      const syncSpy = vi.fn(() => Effect.succeed(true as boolean))

      ;(services.chunkManagerService as unknown as { loadChunksAroundPlayer: unknown }).loadChunksAroundPlayer = loadSpy
      ;(services.worldRendererService as unknown as { syncChunksToScene: unknown }).syncChunksToScene = syncSpy

      const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)

      yield* frameHandler(0.016 as DeltaTimeSecs)
      expect(loadSpy).not.toHaveBeenCalled()
      expect(syncSpy).not.toHaveBeenCalled()

      yield* maintenanceHandler()
      expect(loadSpy).toHaveBeenCalledOnce()
      expect(syncSpy).toHaveBeenCalledOnce()
    }))

    it.effect('calls loadChunksAroundPlayer each frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.chunkManagerService as unknown as { loadChunksAroundPlayer: unknown }).loadChunksAroundPlayer = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    }))

    it.effect('calls syncChunksToScene each frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.succeed(true as boolean))
      ;(services.worldRendererService as unknown as { syncChunksToScene: unknown }).syncChunksToScene = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    }))

    it.effect('retries chunk sync on the next stationary frame when sync is incomplete', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const loadedChunks = [{ coord: { x: 0, z: 0 }, blocks: new Uint8Array(0), dirty: false }]
      const loadSpy = vi.fn(() => Effect.void)
      const syncSpy = vi.fn(() => Effect.succeed(false as boolean))
      syncSpy.mockImplementationOnce(() => Effect.succeed(false as boolean))
      syncSpy.mockImplementation(() => Effect.succeed(true as boolean))

      ;(services.chunkManagerService as unknown as { loadChunksAroundPlayer: unknown }).loadChunksAroundPlayer = loadSpy
      ;(services.chunkManagerService as unknown as { getLoadedChunks: unknown }).getLoadedChunks = vi.fn(() => Effect.succeed(loadedChunks))
      ;(services.worldRendererService as unknown as { syncChunksToScene: unknown }).syncChunksToScene = syncSpy

      const handler = yield* createFrameHandler(deps, services)
      yield* handler(0.016 as DeltaTimeSecs)
      yield* handler(0.016 as DeltaTimeSecs)

      expect(loadSpy).toHaveBeenCalledTimes(2)
      expect(syncSpy).toHaveBeenCalledTimes(2)
    }))

    it.effect('calls applyFrustumCulling each frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { applyFrustumCulling: unknown }).applyFrustumCulling = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    }))

    it.effect('skips applyFrustumCulling once the camera pose stabilizes', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { applyFrustumCulling: unknown }).applyFrustumCulling = spy

      const handler = yield* createFrameHandler(deps, services)
      yield* handler(0.016 as DeltaTimeSecs)
      yield* handler(0.016 as DeltaTimeSecs)
      yield* handler(0.016 as DeltaTimeSecs)

      expect(spy).toHaveBeenCalledTimes(2)
    }))

    it.effect('preserves dirty chunk updates added while maintenance requeues remaining work', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      const queuedTargets = [0, 16, 32, 48, 64, 80].map((x) => ({ x, y: 64, z: 0 }))
      let clickCount = 0
      let maintenanceInjectionDone = false
      let updateCount = 0

      ;(services.inputService as unknown as { consumeMouseClick: (button: number) => Effect.Effect<boolean, never> }).consumeMouseClick = (button: number) =>
        Effect.succeed(button === 0 && clickCount < queuedTargets.length)

      ;(services.blockHighlight as unknown as { getTargetBlock: () => Effect.Effect<Option.Option<{ x: number; y: number; z: number }>, never> }).getTargetBlock = () =>
        Effect.succeed(clickCount < queuedTargets.length ? Option.some(queuedTargets[clickCount]!) : Option.none())

      ;(services.blockHighlight as unknown as { getTargetHit: () => Effect.Effect<Option.Option<never>, never> }).getTargetHit = () => Effect.succeed(Option.none())

      ;(services.blockService as unknown as { breakBlock: (pos: { x: number; y: number; z: number }) => Effect.Effect<void, never> }).breakBlock = () =>
        Effect.sync(() => {
          clickCount += 1
        })

      ;(services.chunkManagerService as unknown as { getChunk: (coord: { x: number; z: number }) => Effect.Effect<{ coord: { x: number; z: number }; blocks: Uint8Array; dirty: false }, never> }).getChunk = (coord) =>
        Effect.succeed({ coord, blocks: new Uint8Array(0), dirty: false })

      const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)

      ;(services.worldRendererService as unknown as { updateChunkInScene: (chunk: { coord: { x: number; z: number } }, scene: THREE.Scene) => Effect.Effect<void, never> }).updateChunkInScene = () =>
        Effect.suspend(() => {
          updateCount += 1
          if (!maintenanceInjectionDone) {
            maintenanceInjectionDone = true
            return frameHandler(0.016 as DeltaTimeSecs).pipe(Effect.asVoid)
          }
          return Effect.void
        })

      for (let index = 0; index < 5; index += 1) {
        yield* frameHandler(0.016 as DeltaTimeSecs)
      }

      yield* maintenanceHandler()
      yield* maintenanceHandler()

      expect(updateCount).toBe(6)
    }))

  })

  // -------------------------------------------------------------------------
  // Step 2: Day/night cycle
  // -------------------------------------------------------------------------

  describe('step 2 — day/night cycle', () => {
    it.effect('calls timeService.advanceTick each frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.timeService as unknown as { advanceTick: unknown }).advanceTick = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    }))
  })

  // -------------------------------------------------------------------------
  // Step 3.5: Fall damage
  // -------------------------------------------------------------------------

  describe('step 3.5 — fall damage', () => {
    it.effect('calls healthService.processFallDamage each frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.succeed(0))
      ;(services.healthService as unknown as { processFallDamage: unknown }).processFallDamage = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    }))

    it.effect('calls healthService.applyDamage when processFallDamage returns > 0', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.healthService as unknown as { processFallDamage: unknown }).processFallDamage = vi.fn(() =>
        Effect.succeed(5)
      )
      const applyDamageSpy = vi.fn(() => Effect.void)
      ;(services.healthService as unknown as { applyDamage: unknown }).applyDamage = applyDamageSpy

      yield* runFrame(deps, services)

      expect(applyDamageSpy).toHaveBeenCalledOnce()
      expect(applyDamageSpy).toHaveBeenCalledWith(5)
    }))

    it.effect('does NOT call healthService.applyDamage when processFallDamage returns 0', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.healthService as unknown as { processFallDamage: unknown }).processFallDamage = vi.fn(() =>
        Effect.succeed(0)
      )
      const applyDamageSpy = vi.fn(() => Effect.void)
      ;(services.healthService as unknown as { applyDamage: unknown }).applyDamage = applyDamageSpy

      yield* runFrame(deps, services)

      expect(applyDamageSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls healthService.tick each frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.healthService as unknown as { tick: unknown }).tick = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    }))

    it.effect('applies hostile contact damage when the entity manager reports an attacker in range', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.entityManager as unknown as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
        Effect.succeed(3)
      )
      const applyDamageSpy = vi.fn(() => Effect.void)
      ;(services.healthService as unknown as { applyDamage: unknown }).applyDamage = applyDamageSpy

      yield* runFrame(deps, services)

      expect(applyDamageSpy).toHaveBeenCalledWith(3)
    }))

    it.effect('resets health and respawns the player when health reaches zero', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.healthService as unknown as { isDead: unknown }).isDead = vi.fn(() => Effect.succeed(true))
      const resetSpy = vi.fn(() => Effect.void)
      const respawnSpy = vi.fn(() => Effect.void)
      ;(services.healthService as unknown as { reset: unknown }).reset = resetSpy
      ;(services.gameState as unknown as { respawn: unknown }).respawn = respawnSpy

      yield* runFrame(deps, services)

      expect(resetSpy).toHaveBeenCalledOnce()
      expect(respawnSpy).toHaveBeenCalledOnce()
      expect(respawnSpy).toHaveBeenCalledWith(deps.respawnPosition)
    }))
  })

  // -------------------------------------------------------------------------
  // Step 7: Block interaction
  // -------------------------------------------------------------------------

  describe('step 7 — block interaction', () => {
    it.effect('damages an entity under the crosshair before falling back to block breaking', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      deps.camera.position.set(0, 0, 0)
      deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

      const inputService = makeInputService()
      ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
        Effect.succeed(btn === 0)

      const services = makeServices({
        inputService,
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
        Effect.succeed(Option.none())
      )
      ;(services.entityManager as unknown as { getEntities: unknown }).getEntities = vi.fn(() =>
        Effect.succeed([{ entityId: 'entity-1', position: { x: 0, y: 64, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, rotation: {} as THREE.Quaternion, health: 20, type: 'Zombie' }])
      )
      const applyDamageSpy = vi.fn(() => Effect.succeed(Option.some([{ blockType: 'DIRT', count: 2 }])))
      const addBlockSpy = vi.fn(() => Effect.succeed(true))
      const breakSpy = vi.fn(() => Effect.void)
      ;(services.entityManager as unknown as { applyDamage: unknown }).applyDamage = applyDamageSpy
      ;(services.inventoryService as unknown as { addBlock: unknown }).addBlock = addBlockSpy
      ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

      yield* runFrame(deps, services)

      expect(applyDamageSpy).toHaveBeenCalledWith('entity-1', 4)
      expect(addBlockSpy).toHaveBeenCalledWith('DIRT', 2)
      expect(breakSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls blockService.breakBlock on left-click when a target block is available', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const inputService = makeInputService()
      // Override consumeMouseClick to return true for button 0
      ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
        Effect.succeed(btn === 0)
      const services = makeServices({
        inputService,
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      // Provide a target block
      ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
        Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
      )
      ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
        Effect.succeed(Option.none())
      )
      const breakSpy = vi.fn(() => Effect.void)
      ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

      yield* runFrame(deps, services)

      expect(breakSpy).toHaveBeenCalledOnce()
      expect(breakSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 })
    }))

    it.effect('does NOT call blockService.breakBlock when no target block', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const inputService = makeInputService()
      ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
        Effect.succeed(btn === 0)
      const services = makeServices({
        inputService,
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      // No target block (Option.none)
      ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
        Effect.succeed(Option.none())
      )
      ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
        Effect.succeed(Option.none())
      )
      const breakSpy = vi.fn(() => Effect.void)
      ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

      yield* runFrame(deps, services)

      expect(breakSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls blockService.placeBlock on right-click when a target hit and hotbar block are available', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const inputService = makeInputService()
      ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
        Effect.succeed(btn === 2)
      const services = makeServices({
        inputService,
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
        Effect.succeed(Option.none())
      )
      ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
        Effect.succeed(Option.some({ blockX: 0, blockY: 64, blockZ: 0, normal: { x: 0, y: 1, z: 0 } }))
      )
      ;(services.hotbarService as unknown as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
        Effect.succeed(Option.some('GRASS'))
      )
      ;(services.hotbarService as unknown as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
        Effect.succeed(2)
      )
      const placeSpy = vi.fn(() => Effect.void)
      ;(services.blockService as unknown as { placeBlock: unknown }).placeBlock = placeSpy

      yield* runFrame(deps, services)

      expect(placeSpy).toHaveBeenCalledOnce()
      // Adjacent position = block + normal = (0+0, 64+1, 0+0) = (0, 65, 0)
      expect(placeSpy).toHaveBeenCalledWith({ x: 0, y: 65, z: 0 }, 'GRASS', 29)
    }))

    it.effect('plays placement audio only after a successful placeBlock call', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const inputService = makeInputService()
      ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
        Effect.succeed(btn === 2)
      const services = makeServices({
        inputService,
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
        Effect.succeed(Option.some({ blockX: 0, blockY: 64, blockZ: 0, normal: { x: 0, y: 1, z: 0 } }))
      )
      ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
        Effect.succeed(Option.none())
      )
      ;(services.hotbarService as unknown as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
        Effect.succeed(Option.some('GRASS'))
      )
      ;(services.hotbarService as unknown as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
        Effect.succeed(0)
      )
      const placeSpy = vi.fn(() => Effect.fail(new Error('no item')))
      const playEffectSpy = vi.fn(() => Effect.void)
      ;(services.blockService as unknown as { placeBlock: unknown }).placeBlock = placeSpy
      ;(services.soundManager as unknown as { playEffect: unknown }).playEffect = playEffectSpy

      yield* runFrame(deps, services)

      expect(placeSpy).toHaveBeenCalledOnce()
      expect(playEffectSpy).not.toHaveBeenCalledWith('blockPlace', expect.anything())
    }))

    it.effect('suppresses block interaction when game is paused', () => Effect.gen(function* () {
      const deps = yield* makeDeps(true /* paused */)
      const inputService = makeInputService()
      ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
        Effect.succeed(btn === 0)
      const services = makeServices({
        inputService,
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
        Effect.succeed(Option.some({ x: 0, y: 64, z: 0 }))
      )
      const breakSpy = vi.fn(() => Effect.void)
      ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

      yield* runFrame(deps, services)

      expect(breakSpy).not.toHaveBeenCalled()
    }))
  })

  describe('inventory crafting runtime wiring', () => {
    it.effect('routes inventory overlay navigation keys to crafting controls when inventory is open', () => Effect.gen(function* () {
      const deps = yield* makeDeps(true)
      const pressedKeys = MutableHashSet.make('ArrowDown', 'ArrowUp', 'Enter')
      const inventoryState = { open: true }
      const inventoryRenderer = makeInventoryRenderer(inventoryState)
      const cycleSpy = vi.fn(() => Effect.void)
      const craftSpy = vi.fn(() => Effect.succeed(true))
      ;(inventoryRenderer as unknown as { cycleRecipes: unknown }).cycleRecipes = cycleSpy
      ;(inventoryRenderer as unknown as { craftSelectedRecipe: unknown }).craftSelectedRecipe = craftSpy

      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer,
        settingsOverlay: makeSettingsOverlay({ open: false }),
        tradingPresentation: makeTradingPresentation({ open: false }),
      })

      yield* runFrame(deps, services)

      expect(cycleSpy).toHaveBeenCalledWith(-1)
      expect(cycleSpy).toHaveBeenCalledWith(1)
      expect(craftSpy).toHaveBeenCalledOnce()
    }))
  })

  // -------------------------------------------------------------------------
  // Step 8: Camera sync
  // -------------------------------------------------------------------------

  describe('step 8 — camera sync', () => {
    it.effect('sets camera position to playerPos with EYE_LEVEL_OFFSET applied', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      // Override getPlayerPosition to return a known position
      ;(services.gameState as unknown as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() =>
        Effect.succeed({ x: 5, y: 64, z: 3 })
      )

      yield* runFrame(deps, services)

      expect(deps.camera.position.x).toBe(5)
      expect(deps.camera.position.y).toBeCloseTo(64 + 0.72)
      expect(deps.camera.position.z).toBe(3)
    }))

    it.effect('toggles to third person with F5 and moves the camera behind the player', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const pressedKeys = MutableHashSet.make(KeyMappings.CAMERA_TOGGLE)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.gameState as unknown as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() =>
        Effect.succeed({ x: 5, y: 64, z: 3 })
      )

      yield* runFrame(deps, services)

      expect(services.cameraState.mode).toBe('thirdPerson')
      expect(deps.camera.position.x).toBeCloseTo(5)
      expect(deps.camera.position.y).toBeCloseTo(64 + 0.72 + 1.5)
      expect(deps.camera.position.z).toBeCloseTo(3 - 4)
    }))
  })

  // -------------------------------------------------------------------------
  // Step 9: FPS display
  // -------------------------------------------------------------------------

  describe('step 9 — FPS display', () => {
    it.effect('calls fpsCounter.getFPS each frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.succeed(60))
      ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    }))

    it.effect('calls fpsCounter.tick with the deltaTime each frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.fpsCounter as unknown as { tick: unknown }).tick = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
      expect(spy).toHaveBeenCalledWith(0.016)
    }))

    it.effect('updates fpsElement.textContent when fpsElement is non-null', () => Effect.gen(function* () {
      // Use a plain stub instead of document.createElement (env is 'node', not jsdom)
      const fpsElement = { textContent: '' } as unknown as HTMLElement
      const deps = yield* makeDeps(false)
      const depsWithEl: FrameHandlerDeps = { ...deps, fpsElement: Option.some(fpsElement) }
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = vi.fn(() => Effect.succeed(42))

      yield* runFrame(depsWithEl, services)

      expect(fpsElement.textContent).toBe('42.0')
    }))
  })

  describe('adaptive performance mode', () => {
    it.effect('does not auto-degrade quality when adaptivePerformanceMode is disabled', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
        Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: false, graphicsQuality: 'high' as const })
      )
      const updateSpy = vi.fn(() => Effect.void)
      ;(services.settingsService as unknown as { updateSettings: unknown }).updateSettings = updateSpy
      ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = vi.fn(() => Effect.succeed(100))

      yield* runFrame(deps, services)

      expect(updateSpy).not.toHaveBeenCalled()
    }))

    it.effect('lowers graphicsQuality when adaptivePerformanceMode is enabled and FPS drops', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
        Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: true, graphicsQuality: 'high' as const })
      )
      const updateSpy = vi.fn(() => Effect.void)
      ;(services.settingsService as unknown as { updateSettings: unknown }).updateSettings = updateSpy
      ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = vi.fn(() => Effect.succeed(100))

      yield* runFrame(deps, services)

      expect(updateSpy).toHaveBeenCalledWith({ graphicsQuality: 'medium' })
    }))

    it.effect('lowers renderDistance when adaptivePerformanceMode is enabled and quality is already low', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
        Effect.succeed({ ...DEFAULT_SETTINGS, adaptivePerformanceMode: true, graphicsQuality: 'low' as const, renderDistance: 8 })
      )
      const updateSpy = vi.fn(() => Effect.void)
      ;(services.settingsService as unknown as { updateSettings: unknown }).updateSettings = updateSpy
      ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = vi.fn(() => Effect.succeed(100))

      yield* runFrame(deps, services)

      expect(updateSpy).toHaveBeenCalledWith({ renderDistance: 7 })
    }))
  })

  // -------------------------------------------------------------------------
  // Step 11: HUD render
  // -------------------------------------------------------------------------

  describe('step 11 — HUD render', () => {
    it.effect('calls hotbarRenderer.render every frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.hotbarRenderer as unknown as { render: unknown }).render = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    }))
  })

  // -------------------------------------------------------------------------
  // Frame completes without error for the nominal (unpaused, no keys) case
  // -------------------------------------------------------------------------

  describe('nominal frame execution', () => {
    it.effect('completes without error when no keys are pressed and game is not paused', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      // Should complete without error
      yield* runFrame(deps, services)
    }))

    it.effect('completes without error when game is paused', () => Effect.gen(function* () {
      const deps = yield* makeDeps(true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      yield* runFrame(deps, services)
    }))

    it.effect('calls renderer.render every frame when composer is absent', () => Effect.gen(function* () {
      const deps = yield* makeDeps(true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      yield* runFrame(deps, services)

      expect((deps.renderer as unknown as { render: ReturnType<typeof vi.fn> }).render).toHaveBeenCalledOnce()
    }))

    it.effect('calls composer.render every frame when composer is present', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false, true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      yield* runFrame(deps, services)

      const composer = Option.getOrNull(deps.composer)
      expect((composer as unknown as { render: ReturnType<typeof vi.fn> }).render).toHaveBeenCalledOnce()
      expect((deps.renderer as unknown as { render: ReturnType<typeof vi.fn> }).render).not.toHaveBeenCalled()
    }))
  })

  // -------------------------------------------------------------------------
  // FR-009: Refraction pre-pass skip on low quality
  // -------------------------------------------------------------------------

  describe('FR-009 — refraction pre-pass skip on low quality', () => {
    it.effect('does NOT call doRefractionPrePass when graphicsQuality is low', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      // Override settingsService to return low quality
      ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
        Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
      )
      const refractionSpy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

      yield* runFrame(deps, services)

      expect(refractionSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls doRefractionPrePass when graphicsQuality is high', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      // Default settings already have graphicsQuality: 'high'
      const refractionSpy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

      yield* runFrame(deps, services)

      expect(refractionSpy).toHaveBeenCalledOnce()
    }))

    it.effect('calls doRefractionPrePass when graphicsQuality is medium', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
        Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'medium' as const })
      )
      const refractionSpy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

      yield* runFrame(deps, services)

      expect(refractionSpy).toHaveBeenCalledOnce()
    }))

    it.effect('skips doRefractionPrePass on the second identical ultra-quality frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
        Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'ultra' as const })
      )
      const refractionSpy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

      const handler = yield* createFrameHandler(deps, services)
      yield* handler(0.016 as DeltaTimeSecs)
      yield* handler(0.016 as DeltaTimeSecs)

      expect(refractionSpy).toHaveBeenCalledOnce()
    }))
  })

  // -------------------------------------------------------------------------
  // Step 2.8 / 2.85: Sun intensity + entity rendering (Phase 2.2c)
  // -------------------------------------------------------------------------

  describe('step 2.8 — sun intensity wiring', () => {
    it.effect('calls chunkMeshService.setSunIntensity each frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.chunkMeshService as unknown as { setSunIntensity: unknown }).setSunIntensity = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    }))

    it.effect('passes a clamped [0,1] sun intensity to setSunIntensity', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      // Force noon (timeOfDay = 0.5) so sin curve peaks at 1.0
      ;(services.timeService as unknown as { getTimeOfDay: unknown }).getTimeOfDay = vi.fn(() =>
        Effect.succeed(0.5)
      )
      const spy = vi.fn(() => Effect.void)
      ;(services.chunkMeshService as unknown as { setSunIntensity: unknown }).setSunIntensity = spy

      yield* runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
      const arg = spy.mock.calls[0]?.[0] as number
      expect(arg).toBeGreaterThanOrEqual(0)
      expect(arg).toBeLessThanOrEqual(1)
      // At timeOfDay=0.5 (noon), sin((0.5-0.25)*2π) = sin(π/2) = 1
      expect(arg).toBeCloseTo(1, 5)
    }))

    it.effect('reports zero sun intensity at midnight (timeOfDay=0)', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.timeService as unknown as { getTimeOfDay: unknown }).getTimeOfDay = vi.fn(() =>
        Effect.succeed(0)
      )
      const spy = vi.fn(() => Effect.void)
      ;(services.chunkMeshService as unknown as { setSunIntensity: unknown }).setSunIntensity = spy

      yield* runFrame(deps, services)

      // sin((0-0.25)*2π) = sin(-π/2) = -1, clamped to 0
      const arg = spy.mock.calls[0]?.[0] as number
      expect(arg).toBe(0)
    }))
  })

  describe('step 2.85 — entity renderer wiring', () => {
    it.effect('calls entityRenderer.syncEntities on the first frame with the live entity snapshot', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const entitiesStub = [{ entityId: 'entity-1', position: { x: 0, y: 0, z: 0 } }] as unknown as ReadonlyArray<unknown>
      ;(services.entityManager as unknown as { getEntities: unknown }).getEntities = vi.fn(() =>
        Effect.succeed(entitiesStub)
      )
      const syncSpy = vi.fn(() => Effect.void)
      ;(services.entityRenderer as unknown as { syncEntities: unknown }).syncEntities = syncSpy

      yield* runFrame(deps, services)

      expect(syncSpy).toHaveBeenCalledOnce()
      // First arg is the snapshot, second arg is the scene
      expect(syncSpy.mock.calls[0]?.[0]).toBe(entitiesStub)
      expect(syncSpy.mock.calls[0]?.[1]).toBe(deps.scene)
    }))

    it.effect('skips entityRenderer.syncEntities when entity structure version is unchanged', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const entitiesStub = [{ entityId: 'entity-1', position: { x: 0, y: 0, z: 0 } }] as unknown as ReadonlyArray<unknown>
      ;(services.entityManager as unknown as { getEntities: unknown }).getEntities = vi.fn(() =>
        Effect.succeed(entitiesStub)
      )
      ;(services.entityManager as unknown as { getStructureVersion: unknown }).getStructureVersion = vi.fn(() =>
        Effect.succeed(7)
      )
      const syncSpy = vi.fn(() => Effect.void)
      ;(services.entityRenderer as unknown as { syncEntities: unknown }).syncEntities = syncSpy

      const handler = yield* createFrameHandler(deps, services)
      yield* handler(0.016 as DeltaTimeSecs)
      yield* handler(0.016 as DeltaTimeSecs)

      expect(syncSpy).toHaveBeenCalledTimes(1)
    }))

    it.effect('calls entityRenderer.updateEntityTransforms with deltaTime each frame', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const updateSpy = vi.fn(() => Effect.void)
      ;(services.entityRenderer as unknown as { updateEntityTransforms: unknown }).updateEntityTransforms = updateSpy

      yield* runFrame(deps, services)

      expect(updateSpy).toHaveBeenCalledOnce()
      // (entities, totalTimeSecs, deltaTimeSecs)
      const callArgs = updateSpy.mock.calls[0] as readonly [unknown, number, number]
      expect(callArgs[2]).toBeCloseTo(0.016)
    }))

    it.effect('passes monotonically growing totalTimeSecs to updateEntityTransforms', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const updateSpy = vi.fn(() => Effect.void)
      ;(services.entityRenderer as unknown as { updateEntityTransforms: unknown }).updateEntityTransforms = updateSpy

      const handler = yield* createFrameHandler(deps, services)
      yield* handler(0.016 as DeltaTimeSecs)
      yield* handler(0.016 as DeltaTimeSecs)

      const total1 = updateSpy.mock.calls[0]?.[1] as number
      const total2 = updateSpy.mock.calls[1]?.[1] as number
      expect(total2).toBeGreaterThan(total1)
    }))
  })

  // -------------------------------------------------------------------------
  // FR-008: Graphics quality caching (pass enable sync)
  // -------------------------------------------------------------------------

  describe('FR-008 — graphics quality caching', () => {
    it.effect('skips doRefractionPrePass on second frame when quality stays low both times', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
        Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
      )
      const refractionSpy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

      // Run two frames with the same handler instance to test caching
      const handler = yield* createFrameHandler(deps, services)
      yield* handler(0.016 as DeltaTimeSecs)
      yield* handler(0.016 as DeltaTimeSecs)

      // doRefractionPrePass should never be called (low quality skips it)
      expect(refractionSpy).not.toHaveBeenCalled()
    }))

    it.effect('throttles doRefractionPrePass based on quality preset (high = every 2 frames)', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const refractionSpy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

      // Run three frames: high quality (refractionThrottleFrames=2) runs on frames 1 and 3
      const handler = yield* createFrameHandler(deps, services)
      yield* handler(0.016 as DeltaTimeSecs)
      yield* handler(0.016 as DeltaTimeSecs)
      yield* handler(0.016 as DeltaTimeSecs)

      // The unchanged-frame cache suppresses the repeated render, so only the first frame runs.
      expect(refractionSpy).toHaveBeenCalledTimes(1)
    }))

    it.effect('resumes doRefractionPrePass when quality changes from low to high', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      let callCount = 0
      ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() => {
        callCount++
        // First frame: low quality, second frame: high quality
        const quality = callCount <= 1 ? 'low' : 'high'
        return Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: quality as 'low' | 'high' })
      })
      const refractionSpy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { doRefractionPrePass: unknown }).doRefractionPrePass = refractionSpy

      const handler = yield* createFrameHandler(deps, services)
      yield* handler(0.016 as DeltaTimeSecs) // low — skip refraction
      yield* handler(0.016 as DeltaTimeSecs) // high — call refraction

      // Only the second frame should call doRefractionPrePass
      expect(refractionSpy).toHaveBeenCalledOnce()
    }))

    it.effect('applies a reduced pixel ratio for low quality', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
        Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
      )

      const handler = yield* createFrameHandler(deps, services)
      yield* handler(0.016 as DeltaTimeSecs)

      expect((deps.renderer.setPixelRatio as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(0.5)
    }))

    it.effect('applies the reduced pixel ratio to composer when present', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false, true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.settingsService as unknown as { getSettings: unknown }).getSettings = vi.fn(() =>
        Effect.succeed({ ...DEFAULT_SETTINGS, graphicsQuality: 'low' as const })
      )

      const handler = yield* createFrameHandler(deps, services)
      yield* handler(0.016 as DeltaTimeSecs)

      const composer = Option.getOrNull(deps.composer)
      expect((composer as unknown as { setPixelRatio: ReturnType<typeof vi.fn> }).setPixelRatio).toHaveBeenCalledWith(0.5)
    }))
  })
})
