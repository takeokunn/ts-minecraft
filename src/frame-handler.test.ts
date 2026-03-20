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
import { Effect, Ref } from 'effect'
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
    light: { position: { set: vi.fn() }, intensity: 1 } as unknown as THREE.DirectionalLight,
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
    healthElement: null,
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
    initialize: () => Effect.void,
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
    initialize: () => Effect.void,
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

  const crosshair = {} as unknown as InstanceType<typeof import('@/presentation/hud/crosshair').CrosshairService>

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
    crosshair,
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
