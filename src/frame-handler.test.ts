/**
 * Tests for createFrameHandler.
 *
 * Design note: createFrameHandler returns (deltaTime) => Effect<void, never>
 * with R = never — the returned Effect is fully self-contained and requires no
 * Effect.provide call.  We therefore call Effect.runPromise directly on each
 * frame Effect, which keeps tests synchronous-feeling while still exercising
 * the full Effect.gen execution path.
 *
 * Stubs are plain objects that structurally satisfy FrameHandlerDeps /
 * FrameHandlerServices.  We do NOT construct real Effect.Service instances
 * here — the goal is to unit-test the overlay-toggle and pause-gate logic
 * inside createFrameHandler, not the individual services themselves.
 */
import { describe, it, expect, vi } from 'vitest'
import { Effect, Option, Ref } from 'effect'
import * as THREE from 'three'
import { createFrameHandler, type FrameHandlerDeps, type FrameHandlerServices } from '@/frame-handler'
import { KeyMappings } from '@/application/input/key-mappings'
import type { DeltaTimeSecs } from '@/shared/kernel'

// ---------------------------------------------------------------------------
// Minimal DayNightLights stub (shape required by FrameHandlerDeps.lights)
//
// DayNightLights = { light, ambientLight, renderer: { setClearColor }, skyNight, skyDay, skyCurrent }
// ---------------------------------------------------------------------------

const makeLights = () =>
  ({
    light: { position: { set: vi.fn() }, intensity: 1, target: { position: { set: vi.fn() }, updateMatrixWorld: vi.fn() } } as unknown as THREE.DirectionalLight,
    ambientLight: { intensity: 0.3 } as unknown as THREE.AmbientLight,
    renderer: { setClearColor: vi.fn() },
    skyNight: new THREE.Color(0x001133),
    skyDay: new THREE.Color(0x87ceeb),
    skyCurrent: new THREE.Color(0x87ceeb),
  }) as unknown as import('@/application/time/day-night-cycle').DayNightLights

// ---------------------------------------------------------------------------
// FrameHandlerDeps factory
//
// gamePausedRef is a real Ref so we can observe its state after each frame.
// renderer / scene / camera are minimal THREE.js stubs (avoid WebGL init).
// ---------------------------------------------------------------------------

const makeRenderer = () =>
  ({
    render: vi.fn(),
    autoClear: true,
  }) as unknown as THREE.WebGLRenderer

const makeCamera = () => {
  const cam = new THREE.PerspectiveCamera()
  // Stub updateProjectionMatrix to avoid WebGL warnings in jsdom
  cam.updateProjectionMatrix = vi.fn()
  return cam
}

const makeDeps = async (paused = false): Promise<FrameHandlerDeps & { gamePausedRef: Ref.Ref<boolean> }> => {
  const gamePausedRef = await Effect.runPromise(Ref.make(paused))
  return {
    renderer: makeRenderer(),
    scene: new THREE.Scene(),
    camera: makeCamera(),
    lights: makeLights(),
    fpsElement: null,
    healthValueElement: null,
    healthMaxElement: null,
    gamePausedRef,
  }
}

// ---------------------------------------------------------------------------
// FrameHandlerServices factory
//
// Each service method returns a trivial Effect.  Mocked methods use vi.fn()
// wrapped in Effect.sync so we can assert call counts / return values.
// The shape mirrors the return objects of the corresponding Effect.Service
// implementations, but contains no real logic.
// ---------------------------------------------------------------------------

interface OverlayState {
  open: boolean
}

/**
 * Build a minimal InventoryRenderer stub.
 * `toggle` flips `state.open` and returns the new value.
 */
const makeInventoryRenderer = (state: OverlayState) =>
  ({
    isOpen: () => Effect.sync(() => state.open),
    toggle: () =>
      Effect.sync(() => {
        state.open = !state.open
        return state.open
      }),
    update: () => Effect.void,
  }) as unknown as InstanceType<typeof import('@/presentation/inventory/inventory-renderer').InventoryRendererService>

/**
 * Build a minimal SettingsOverlay stub.
 * `toggle` flips `state.open` and returns the new value.
 */
const makeSettingsOverlay = (state: OverlayState) =>
  ({
    isOpen: () => Effect.sync(() => state.open),
    toggle: () =>
      Effect.sync(() => {
        state.open = !state.open
        return state.open
      }),
    syncFromSettings: () => Effect.void,
    applyToSettings: () => Effect.void,
  }) as unknown as InstanceType<typeof import('@/presentation/settings/settings-overlay').SettingsOverlayService>

/**
 * Build a minimal InputService stub.
 * `consumeKeyPress` returns true for keys listed in `pressedKeys`.
 * `consumeMouseClick` always returns false (block interaction not under test here).
 */
const makeInputService = (pressedKeys: Set<string> = new Set()) =>
  ({
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (pressedKeys.has(key)) {
          pressedKeys.delete(key) // consume — same as real service
          return true
        }
        return false
      }),
    consumeMouseClick: (_btn: number) => Effect.succeed(false),
    isKeyPressed: (_key: string) => Effect.succeed(false),
    getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
    isMouseDown: (_btn: number) => Effect.succeed(false),
    requestPointerLock: () => Effect.void,
    exitPointerLock: () => Effect.void,
    isPointerLocked: () => Effect.succeed(false),
    consumeWheelDelta: () => Effect.succeed(0),
  }) as unknown as InstanceType<typeof import('@/presentation/input/input-service').InputService>

const DEFAULT_SETTINGS = { renderDistance: 8, mouseSensitivity: 0.5, dayLengthSeconds: 400 }

/**
 * Build a complete FrameHandlerServices stub.
 * Only the services exercised by overlay-toggle and pause-gate tests need
 * non-trivial stubs — everything else returns void / empty values.
 */
const makeServices = (opts: {
  inputService: ReturnType<typeof makeInputService>
  inventoryRenderer: ReturnType<typeof makeInventoryRenderer>
  settingsOverlay: ReturnType<typeof makeSettingsOverlay>
}): FrameHandlerServices => {
  const { inputService, inventoryRenderer, settingsOverlay } = opts

  const gameState = {
    getPlayerPosition: (_id: unknown) => Effect.succeed({ x: 0, y: 64, z: 0 }),
    update: (_dt: unknown) => Effect.void,
    isPlayerGrounded: () => Effect.succeed(true),
    updateGroundY: (_y: unknown) => Effect.void,
  } as unknown as InstanceType<typeof import('@/application/game-state').GameStateService>

  const firstPersonCamera = {
    update: (_cam: unknown) => Effect.void,
  } as unknown as InstanceType<typeof import('@/application/camera/first-person-camera-service').FirstPersonCameraService>

  const blockHighlight = {
    update: (_cam: unknown, _scene: unknown) => Effect.void,
    getTargetBlock: () => Effect.succeed(null),
    getTargetHit: () => Effect.succeed(null),
  } as unknown as InstanceType<typeof import('@/presentation/highlight/block-highlight').BlockHighlightService>

  const blockService = {
    breakBlock: (_pos: unknown) => Effect.void,
    placeBlock: (_pos: unknown, _type: unknown) => Effect.void,
  } as unknown as InstanceType<typeof import('@/application/block/block-service').BlockService>

  const hotbarService = {
    update: () => Effect.void,
    getSlots: () => Effect.succeed([]),
    getSelectedSlot: () => Effect.succeed(0),
    getSelectedBlockType: () => Effect.succeed({ _tag: 'None' }),
  } as unknown as InstanceType<typeof import('@/application/hotbar/hotbar-service').HotbarService>

  const hotbarRenderer = {
    update: (_slots: unknown, _sel: unknown) => Effect.void,
    render: (_renderer: unknown) => Effect.void,
  } as unknown as InstanceType<typeof import('@/presentation/hud/hotbar-three').HotbarRendererService>

  const chunkManagerService = {
    loadChunksAroundPlayer: (_pos: unknown) => Effect.void,
    getLoadedChunks: () => Effect.succeed([]),
    getChunk: (_coord: unknown) => Effect.succeed({ coord: { x: 0, z: 0 }, blocks: new Uint8Array(0), dirty: false }),
  } as unknown as InstanceType<typeof import('@/application/chunk/chunk-manager-service').ChunkManagerService>

  const timeService = {
    advanceTick: (_dt: unknown) => Effect.void,
    getTimeOfDay: () => Effect.succeed(0.5),
    isNight: () => Effect.succeed(false),
    getDayLength: () => Effect.succeed(DEFAULT_SETTINGS.dayLengthSeconds),
    setDayLength: (_s: unknown) => Effect.void,
    setTimeOfDay: (_f: unknown) => Effect.void,
  } as unknown as InstanceType<typeof import('@/application/time/time-service').TimeService>

  const settingsService = {
    getSettings: () => Effect.succeed({ ...DEFAULT_SETTINGS }),
    updateSettings: (_p: unknown) => Effect.void,
    resetToDefaults: () => Effect.void,
  } as unknown as InstanceType<typeof import('@/application/settings/settings-service').SettingsService>

  const fpsCounter = {
    tick: (_dt: unknown) => Effect.void,
    getFPS: () => Effect.succeed(60),
    getFrameCount: () => Effect.succeed(0),
    reset: () => Effect.void,
  } as unknown as InstanceType<typeof import('@/presentation/fps-counter').FPSCounterService>

  const worldRendererService = {
    syncChunksToScene: (_chunks: unknown, _scene: unknown) => Effect.void,
    applyFrustumCulling: (_cam: unknown) => Effect.void,
    updateChunkInScene: (_chunk: unknown, _scene: unknown) => Effect.void,
  } as unknown as InstanceType<typeof import('@/infrastructure/three/world-renderer').WorldRendererService>

  const healthService = {
    getHealth: () => Effect.succeed({ current: 20, max: 20 }),
    applyDamage: (_amount: unknown) => Effect.void,
    tick: () => Effect.void,
    processFallDamage: (_y: unknown, _grounded: unknown) => Effect.succeed(0),
  } as unknown as InstanceType<typeof import('@/application/player/health-service').HealthService>

  return {
    gameState,
    firstPersonCamera,
    blockHighlight,
    inputService,
    blockService,
    hotbarService,
    hotbarRenderer,
    chunkManagerService,
    timeService,
    settingsService,
    settingsOverlay,
    inventoryRenderer,
    fpsCounter,
    worldRendererService,
    healthService,
  }
}

// Convenience: run one frame with the provided deps and services
const runFrame = (deps: FrameHandlerDeps, services: FrameHandlerServices) => {
  const handler = createFrameHandler(deps, services)
  return Effect.runPromise(handler(0.016 as DeltaTimeSecs))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('frame-handler', () => {
  // -------------------------------------------------------------------------
  // Pause gate: camera update and block interaction
  // -------------------------------------------------------------------------

  describe('pause gate', () => {
    it('suppresses firstPersonCamera.update when gamePausedRef is true', async () => {
      const deps = await makeDeps(true /* paused */)
      const cameraUpdateSpy = vi.fn(() => Effect.void)

      const invState = { open: false }
      const setState = { open: false }
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })
      // Override firstPersonCamera.update with spy
      ;(services.firstPersonCamera as unknown as { update: unknown }).update = cameraUpdateSpy

      await runFrame(deps, services)

      expect(cameraUpdateSpy).not.toHaveBeenCalled()
    })

    it('calls firstPersonCamera.update when gamePausedRef is false', async () => {
      const deps = await makeDeps(false /* not paused */)
      const cameraUpdateSpy = vi.fn(() => Effect.void)

      const invState = { open: false }
      const setState = { open: false }
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })
      ;(services.firstPersonCamera as unknown as { update: unknown }).update = cameraUpdateSpy

      await runFrame(deps, services)

      expect(cameraUpdateSpy).toHaveBeenCalledOnce()
    })

    it('suppresses hotbarService.update when gamePausedRef is true', async () => {
      const deps = await makeDeps(true)
      const hotbarUpdateSpy = vi.fn(() => Effect.void)

      const invState = { open: false }
      const setState = { open: false }
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })
      ;(services.hotbarService as unknown as { update: unknown }).update = hotbarUpdateSpy

      await runFrame(deps, services)

      expect(hotbarUpdateSpy).not.toHaveBeenCalled()
    })

    it('calls hotbarService.update when gamePausedRef is false', async () => {
      const deps = await makeDeps(false)
      const hotbarUpdateSpy = vi.fn(() => Effect.void)

      const invState = { open: false }
      const setState = { open: false }
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })
      ;(services.hotbarService as unknown as { update: unknown }).update = hotbarUpdateSpy

      await runFrame(deps, services)

      expect(hotbarUpdateSpy).toHaveBeenCalledOnce()
    })
  })

  // -------------------------------------------------------------------------
  // Escape key: overlay toggle logic
  // -------------------------------------------------------------------------

  describe('Escape key handling', () => {
    it('closes inventory and sets gamePausedRef to false when Escape is pressed while inventory is open', async () => {
      const invState = { open: true }
      const setState = { open: false }
      const pressedKeys = new Set([KeyMappings.ESCAPE])

      const deps = await makeDeps(true /* paused because inventory is open */)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      await runFrame(deps, services)

      // Inventory must now be closed
      expect(invState.open).toBe(false)
      // gamePausedRef must be false
      const paused = await Effect.runPromise(Ref.get(deps.gamePausedRef))
      expect(paused).toBe(false)
    })

    it('closes settings and sets gamePausedRef to false when Escape is pressed while settings is open', async () => {
      const invState = { open: false }
      const setState = { open: true }
      const pressedKeys = new Set([KeyMappings.ESCAPE])

      const deps = await makeDeps(true /* paused because settings is open */)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      await runFrame(deps, services)

      // Settings must now be closed
      expect(setState.open).toBe(false)
      // gamePausedRef must be false
      const paused = await Effect.runPromise(Ref.get(deps.gamePausedRef))
      expect(paused).toBe(false)
    })

    it('opens settings and sets gamePausedRef to true when Escape is pressed while nothing is open', async () => {
      const invState = { open: false }
      const setState = { open: false }
      const pressedKeys = new Set([KeyMappings.ESCAPE])

      const deps = await makeDeps(false /* not paused */)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      await runFrame(deps, services)

      // Settings must now be open
      expect(setState.open).toBe(true)
      // gamePausedRef must be true
      const paused = await Effect.runPromise(Ref.get(deps.gamePausedRef))
      expect(paused).toBe(true)
    })

    it('does not change overlay states when Escape is not pressed', async () => {
      const invState = { open: false }
      const setState = { open: false }

      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(/* no pressed keys */),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      await runFrame(deps, services)

      expect(invState.open).toBe(false)
      expect(setState.open).toBe(false)
      const paused = await Effect.runPromise(Ref.get(deps.gamePausedRef))
      expect(paused).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // KeyE (inventory) key: overlay toggle logic
  // -------------------------------------------------------------------------

  describe('inventory key (KeyE) handling', () => {
    it('opens inventory and sets gamePausedRef to true when KeyE is pressed while inventory is closed', async () => {
      const invState = { open: false }
      const setState = { open: false }
      const pressedKeys = new Set([KeyMappings.INVENTORY_OPEN])

      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      await runFrame(deps, services)

      // Inventory must now be open
      expect(invState.open).toBe(true)
      // gamePausedRef must be true
      const paused = await Effect.runPromise(Ref.get(deps.gamePausedRef))
      expect(paused).toBe(true)
    })

    it('closes inventory and sets gamePausedRef to false when KeyE is pressed while inventory is open', async () => {
      const invState = { open: true }
      const setState = { open: false }
      const pressedKeys = new Set([KeyMappings.INVENTORY_OPEN])

      const deps = await makeDeps(true /* paused because inventory is open */)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      await runFrame(deps, services)

      // Inventory must now be closed
      expect(invState.open).toBe(false)
      // gamePausedRef must be false
      const paused = await Effect.runPromise(Ref.get(deps.gamePausedRef))
      expect(paused).toBe(false)
    })

    it('closes settings and opens inventory when KeyE is pressed while settings is open', async () => {
      const invState = { open: false }
      const setState = { open: true }
      const pressedKeys = new Set([KeyMappings.INVENTORY_OPEN])

      const deps = await makeDeps(true /* paused because settings is open */)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      await runFrame(deps, services)

      // Settings must be closed, inventory must be open
      expect(setState.open).toBe(false)
      expect(invState.open).toBe(true)
      // gamePausedRef must be true (inventory now open)
      const paused = await Effect.runPromise(Ref.get(deps.gamePausedRef))
      expect(paused).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Step 1: Chunk streaming
  // -------------------------------------------------------------------------

  describe('step 1 — chunk streaming', () => {
    it('calls loadChunksAroundPlayer each frame', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.chunkManagerService as unknown as { loadChunksAroundPlayer: unknown }).loadChunksAroundPlayer = spy

      await runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    })

    it('calls syncChunksToScene each frame', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { syncChunksToScene: unknown }).syncChunksToScene = spy

      await runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    })

    it('calls applyFrustumCulling each frame', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.worldRendererService as unknown as { applyFrustumCulling: unknown }).applyFrustumCulling = spy

      await runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    })
  })

  // -------------------------------------------------------------------------
  // Step 2: Day/night cycle
  // -------------------------------------------------------------------------

  describe('step 2 — day/night cycle', () => {
    it('calls timeService.advanceTick each frame', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.timeService as unknown as { advanceTick: unknown }).advanceTick = spy

      await runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    })
  })

  // -------------------------------------------------------------------------
  // Step 3.5: Fall damage
  // -------------------------------------------------------------------------

  describe('step 3.5 — fall damage', () => {
    it('calls healthService.processFallDamage each frame', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.succeed(0))
      ;(services.healthService as unknown as { processFallDamage: unknown }).processFallDamage = spy

      await runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    })

    it('calls healthService.applyDamage when processFallDamage returns > 0', async () => {
      const deps = await makeDeps(false)
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

      await runFrame(deps, services)

      expect(applyDamageSpy).toHaveBeenCalledOnce()
      expect(applyDamageSpy).toHaveBeenCalledWith(5)
    })

    it('does NOT call healthService.applyDamage when processFallDamage returns 0', async () => {
      const deps = await makeDeps(false)
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

      await runFrame(deps, services)

      expect(applyDamageSpy).not.toHaveBeenCalled()
    })

    it('calls healthService.tick each frame', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.healthService as unknown as { tick: unknown }).tick = spy

      await runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    })
  })

  // -------------------------------------------------------------------------
  // Step 7: Block interaction
  // -------------------------------------------------------------------------

  describe('step 7 — block interaction', () => {
    it('calls blockService.breakBlock on left-click when a target block is available', async () => {
      const deps = await makeDeps(false)
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
        Effect.succeed({ x: 0, y: 64, z: 0 })
      )
      ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
        Effect.succeed(null)
      )
      const breakSpy = vi.fn(() => Effect.void)
      ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

      await runFrame(deps, services)

      expect(breakSpy).toHaveBeenCalledOnce()
      expect(breakSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 })
    })

    it('does NOT call blockService.breakBlock when no target block', async () => {
      const deps = await makeDeps(false)
      const inputService = makeInputService()
      ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
        Effect.succeed(btn === 0)
      const services = makeServices({
        inputService,
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      // No target block (null)
      ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
        Effect.succeed(null)
      )
      ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
        Effect.succeed(null)
      )
      const breakSpy = vi.fn(() => Effect.void)
      ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

      await runFrame(deps, services)

      expect(breakSpy).not.toHaveBeenCalled()
    })

    it('calls blockService.placeBlock on right-click when a target hit and hotbar block are available', async () => {
      const deps = await makeDeps(false)
      const inputService = makeInputService()
      ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
        Effect.succeed(btn === 2)
      const services = makeServices({
        inputService,
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
        Effect.succeed(null)
      )
      ;(services.blockHighlight as unknown as { getTargetHit: unknown }).getTargetHit = vi.fn(() =>
        Effect.succeed({ blockX: 0, blockY: 64, blockZ: 0, normal: { x: 0, y: 1, z: 0 } })
      )
      ;(services.hotbarService as unknown as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
        Effect.succeed(Option.some('GRASS'))
      )
      const placeSpy = vi.fn(() => Effect.void)
      ;(services.blockService as unknown as { placeBlock: unknown }).placeBlock = placeSpy

      await runFrame(deps, services)

      expect(placeSpy).toHaveBeenCalledOnce()
      // Adjacent position = block + normal = (0+0, 64+1, 0+0) = (0, 65, 0)
      expect(placeSpy).toHaveBeenCalledWith({ x: 0, y: 65, z: 0 }, 'GRASS')
    })

    it('suppresses block interaction when game is paused', async () => {
      const deps = await makeDeps(true /* paused */)
      const inputService = makeInputService()
      ;(inputService as unknown as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
        Effect.succeed(btn === 0)
      const services = makeServices({
        inputService,
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.blockHighlight as unknown as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
        Effect.succeed({ x: 0, y: 64, z: 0 })
      )
      const breakSpy = vi.fn(() => Effect.void)
      ;(services.blockService as unknown as { breakBlock: unknown }).breakBlock = breakSpy

      await runFrame(deps, services)

      expect(breakSpy).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Step 8: Camera sync
  // -------------------------------------------------------------------------

  describe('step 8 — camera sync', () => {
    it('sets camera position to playerPos with EYE_LEVEL_OFFSET applied', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      // Override getPlayerPosition to return a known position
      ;(services.gameState as unknown as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() =>
        Effect.succeed({ x: 5, y: 64, z: 3 })
      )

      await runFrame(deps, services)

      expect(deps.camera.position.x).toBe(5)
      expect(deps.camera.position.y).toBeCloseTo(64 + 0.7)
      expect(deps.camera.position.z).toBe(3)
    })
  })

  // -------------------------------------------------------------------------
  // Step 9: FPS display
  // -------------------------------------------------------------------------

  describe('step 9 — FPS display', () => {
    it('calls fpsCounter.getFPS each frame', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.succeed(60))
      ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = spy

      await runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    })

    it('calls fpsCounter.tick with the deltaTime each frame', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.fpsCounter as unknown as { tick: unknown }).tick = spy

      await runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
      expect(spy).toHaveBeenCalledWith(0.016)
    })

    it('updates fpsElement.textContent when fpsElement is non-null', async () => {
      // Use a plain stub instead of document.createElement (env is 'node', not jsdom)
      const fpsElement = { textContent: '' } as unknown as HTMLElement
      const deps = await makeDeps(false)
      const depsWithEl: FrameHandlerDeps = { ...deps, fpsElement }
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      ;(services.fpsCounter as unknown as { getFPS: unknown }).getFPS = vi.fn(() => Effect.succeed(42))

      await runFrame(depsWithEl, services)

      expect(fpsElement.textContent).toBe('42.0')
    })
  })

  // -------------------------------------------------------------------------
  // Step 11: HUD render
  // -------------------------------------------------------------------------

  describe('step 11 — HUD render', () => {
    it('calls hotbarRenderer.render every frame', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const spy = vi.fn(() => Effect.void)
      ;(services.hotbarRenderer as unknown as { render: unknown }).render = spy

      await runFrame(deps, services)

      expect(spy).toHaveBeenCalledOnce()
    })
  })

  // -------------------------------------------------------------------------
  // Frame completes without error for the nominal (unpaused, no keys) case
  // -------------------------------------------------------------------------

  describe('nominal frame execution', () => {
    it('completes without error when no keys are pressed and game is not paused', async () => {
      const deps = await makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      // Should resolve without throwing
      await expect(runFrame(deps, services)).resolves.toBeUndefined()
    })

    it('completes without error when game is paused', async () => {
      const deps = await makeDeps(true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      await expect(runFrame(deps, services)).resolves.toBeUndefined()
    })

    it('calls renderer.render every frame regardless of pause state', async () => {
      const deps = await makeDeps(true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      await runFrame(deps, services)

      expect((deps.renderer as unknown as { render: ReturnType<typeof vi.fn> }).render).toHaveBeenCalledOnce()
    })
  })
})
