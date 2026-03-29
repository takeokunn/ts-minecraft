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
import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableHashSet, Option, Ref } from 'effect'
import * as THREE from 'three'
import { createFrameHandler, type FrameHandlerDeps, type FrameHandlerServices } from '@/frame-handler'
import { KeyMappings } from '@/application/input/key-mappings'
import type { DeltaTimeSecs } from '@/shared/kernel'

type CameraMode = 'firstPerson' | 'thirdPerson'

interface CameraStateStub {
  mode: CameraMode
}

// ---------------------------------------------------------------------------
// Minimal DayNightLights stub (shape required by FrameHandlerDeps.lights)
//
// DayNightLights = { light, ambientLight, renderer: { setClearColor }, skyNight, skyDay, skyCurrent }
// ---------------------------------------------------------------------------

const makeLights = () =>
  ({
    light: { position: { set: vi.fn() }, intensity: 1, castShadow: true, color: { setHSL: vi.fn() }, target: { position: { set: vi.fn() }, updateMatrixWorld: vi.fn() }, shadow: { camera: { left: -128, right: 128, top: 128, bottom: -128, updateProjectionMatrix: vi.fn() } } } as unknown as THREE.DirectionalLight,
    ambientLight: { intensity: 0.3, color: { setHSL: vi.fn() } } as unknown as THREE.AmbientLight,
    renderer: { setClearColor: vi.fn() },
    skyNight: new THREE.Color(0x001133),
    skyDay: new THREE.Color(0x87ceeb),
    skyCurrent: new THREE.Color(0x87ceeb),
    sky: Option.none(),
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
    domElement: { clientWidth: 800, clientHeight: 600 },
  }) as unknown as THREE.WebGLRenderer

const makeCamera = () => {
  const cam = new THREE.PerspectiveCamera()
  // Stub updateProjectionMatrix to avoid WebGL warnings in jsdom
  cam.updateProjectionMatrix = vi.fn()
  return cam
}

const makeCameraState = (initialMode: CameraMode = 'firstPerson') => {
  const state: CameraStateStub = { mode: initialMode }

  const service = {
    getRotation: () => Effect.succeed({ yaw: 0, pitch: 0 }),
    getMode: () => Effect.sync(() => state.mode),
    setYaw: (_yaw: number) => Effect.void,
    setPitch: (_pitch: number) => Effect.void,
    addYaw: (_delta: number) => Effect.void,
    addPitch: (_delta: number) => Effect.void,
    setMode: (mode: CameraMode) =>
      Effect.sync(() => {
        state.mode = mode
      }),
    toggleMode: () =>
      Effect.sync(() => {
        state.mode = state.mode === 'firstPerson' ? 'thirdPerson' : 'firstPerson'
      }),
    reset: () =>
      Effect.sync(() => {
        state.mode = 'firstPerson'
      }),
  } as unknown as InstanceType<typeof import('@/application/camera/camera-state').PlayerCameraStateService>

  return { service, state }
}

const makeDeps = (paused = false): Effect.Effect<FrameHandlerDeps & { gamePausedRef: Ref.Ref<boolean> }> =>
  Effect.flatMap(
    Ref.make(paused),
    (gamePausedRef) => Effect.succeed({
      renderer: makeRenderer(),
      scene: new THREE.Scene(),
      camera: makeCamera(),
      lights: makeLights(),
      fpsElement: Option.none(),
      healthValueElement: Option.none(),
      healthMaxElement: Option.none(),
      skyMesh: Option.none(),
      gamePausedRef,
      composer: Option.none(),
      gtaoPass: Option.none(),
      bloomPass: Option.none(),
      dofPass: Option.none(),
      godRaysPass: Option.none(),
      smaaPass: Option.none(),
    })
  )

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

const makeTradingPresentation = (state: OverlayState) =>
  ({
    open: (_villagerId: string) =>
      Effect.sync(() => {
        state.open = true
        return true
      }),
    close: () =>
      Effect.sync(() => {
        state.open = false
      }),
    isOpen: () => Effect.sync(() => state.open),
    cycleSelection: (_delta: number) => Effect.void,
    refresh: () => Effect.void,
    executeSelectedTrade: () => Effect.succeed(false),
  }) as unknown as InstanceType<typeof import('@/presentation/trading').TradingPresentationService>

/**
 * Build a minimal InputService stub.
 * `consumeKeyPress` returns true for keys listed in `pressedKeys`.
 * `consumeMouseClick` always returns false (block interaction not under test here).
 */
const makeInputService = (pressedKeys: MutableHashSet.MutableHashSet<string> = MutableHashSet.empty()) =>
  ({
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (MutableHashSet.has(pressedKeys, key)) {
          MutableHashSet.remove(pressedKeys, key) // consume — same as real service
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

const DEFAULT_SETTINGS = {
  renderDistance: 8,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  graphicsQuality: 'high' as const,
  audioEnabled: true,
  masterVolume: 0.8,
  sfxVolume: 1,
  musicVolume: 0.55,
}

/**
 * Build a complete FrameHandlerServices stub.
 * Only the services exercised by overlay-toggle and pause-gate tests need
 * non-trivial stubs — everything else returns void / empty values.
 */
const makeServices = (opts: {
  inputService: ReturnType<typeof makeInputService>
  inventoryRenderer: ReturnType<typeof makeInventoryRenderer>
  settingsOverlay: ReturnType<typeof makeSettingsOverlay>
  tradingPresentation?: ReturnType<typeof makeTradingPresentation>
}): FrameHandlerServices & { cameraState: CameraStateStub } => {
  const { inputService, inventoryRenderer, settingsOverlay } = opts
  const tradingPresentation = opts.tradingPresentation ?? makeTradingPresentation({ open: false })
  const cameraState = makeCameraState()

  const gameState = {
    getPlayerPosition: (_id: unknown) => Effect.succeed({ x: 0, y: 64, z: 0 }),
    update: (_dt: unknown) => Effect.void,
    isPlayerGrounded: () => Effect.succeed(true),
    updateGroundY: (_y: unknown) => Effect.void,
  } as unknown as InstanceType<typeof import('@/application/game-state').GameStateService>

  const firstPersonCamera = {
    update: (_cam: unknown) => Effect.void,
  } as unknown as InstanceType<typeof import('@/application/camera/first-person-camera-service').FirstPersonCameraService>

  const thirdPersonCamera = {
    update: (cam: THREE.PerspectiveCamera, playerPos: { x: number; y: number; z: number }, eyeLevelOffset = 0.7) =>
      Effect.sync(() => {
        const distance = 4
        const shoulderHeight = 1.5
        const eyeY = playerPos.y + eyeLevelOffset
        cam.position.set(playerPos.x, eyeY + shoulderHeight, playerPos.z - distance)
        cam.lookAt(playerPos.x, eyeY, playerPos.z)
      }),
  } as unknown as InstanceType<typeof import('@/application/camera/third-person-camera-service').ThirdPersonCameraService>

  const blockHighlight = {
    update: (_cam: unknown, _scene: unknown) => Effect.void,
    getTargetBlock: () => Effect.succeed(Option.none()),
    getTargetHit: () => Effect.succeed(Option.none()),
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
    syncChunksToScene: (_chunks: unknown, _scene: unknown) => Effect.succeed(true as boolean),
    applyFrustumCulling: (_cam: unknown) => Effect.void,
    updateChunkInScene: (_chunk: unknown, _scene: unknown) => Effect.void,
    clearScene: (_scene: unknown) => Effect.void,
    doRefractionPrePass: (_renderer: unknown, _scene: unknown, _camera: unknown) => Effect.void,
    updateWaterUniforms: (_time: number, _camPos: unknown) => Effect.void,
    updateWaterResolution: (_w: number, _h: number) => Effect.void,
    resizeRefractionRT: (_w: number, _h: number) => Effect.void,
    resizeRefractionCamera: (_aspect: number) => Effect.void,
    getWaterMeshes: () => Effect.succeed([] as THREE.Mesh[]),
    setRefractionValid: (_valid: boolean) => Effect.void,
  } as unknown as InstanceType<typeof import('@/infrastructure/three/world-renderer').WorldRendererService>

  const healthService = {
    getHealth: () => Effect.succeed({ current: 20, max: 20 }),
    applyDamage: (_amount: unknown) => Effect.void,
    tick: () => Effect.void,
    processFallDamage: (_y: unknown, _grounded: unknown) => Effect.succeed(0),
  } as unknown as InstanceType<typeof import('@/application/player/health-service').HealthService>

  const soundManager = {
    applySettings: (_settings: unknown) => Effect.void,
    setListenerPosition: (_position: unknown) => Effect.void,
    playEffect: (_effect: unknown, _options?: unknown) => Effect.void,
    getState: () => Effect.succeed({
      enabled: true,
      masterVolume: 0.8,
      sfxVolume: 1,
      listenerPosition: { x: 0, y: 64, z: 0 },
    }),
  } as unknown as InstanceType<typeof import('@/audio').SoundManager>

  const musicManager = {
    applySettings: (_settings: unknown) => Effect.void,
    setEnvironment: (_environment: unknown) => Effect.void,
    updateFromContext: (_context: unknown) => Effect.void,
    stop: () => Effect.void,
    getCurrentEnvironment: () => Effect.succeed(Option.none()),
    getState: () => Effect.succeed({
      enabled: true,
      masterVolume: 0.8,
      musicVolume: 0.55,
    }),
  } as unknown as InstanceType<typeof import('@/audio').MusicManager>

  const entityManager = {
    addEntity: (_type: unknown, _position: unknown) => Effect.succeed('entity-1' as unknown),
    removeEntity: (_entityId: unknown) => Effect.succeed(false),
    getEntity: (_entityId: unknown) => Effect.succeed(Option.none()),
    getEntities: () => Effect.succeed([]),
    getEntityAIState: (_entityId: unknown) => Effect.succeed(Option.none()),
    getCount: () => Effect.succeed(0),
    update: (_deltaTime: unknown, _playerPosition: unknown) => Effect.void,
    applyDamage: (_entityId: unknown, _amount: unknown) => Effect.succeed(Option.none()),
  } as unknown as InstanceType<typeof import('@/entity/entityManager').EntityManager>

  const mobSpawner = {
    trySpawn: (_playerPosition: unknown) => Effect.succeed(Option.none()),
    getSpawnBounds: () => Effect.succeed({ minDistance: 16, maxDistance: 40 }),
    getMaxPopulation: () => Effect.succeed(24),
  } as unknown as InstanceType<typeof import('@/entity/spawner').MobSpawner>

  const villageService = {
    ensureVillageNear: (_playerPosition: unknown) =>
      Effect.succeed({ villageId: 'village-1', center: { x: 0, y: 64, z: 0 }, structures: [], villagers: [] }),
    getVillages: () => Effect.succeed([]),
    getVillagers: () => Effect.succeed([]),
    getVillager: (_villagerId: unknown) => Effect.succeed(Option.none()),
    findNearestVillager: (_position: unknown, _maxDistance: unknown) => Effect.succeed(Option.none()),
    addVillagerExperience: (_villagerId: unknown, _amount: unknown) => Effect.succeed(Option.none()),
    update: (_playerPosition: unknown, _timeOfDay: unknown, _deltaTime: unknown) => Effect.void,
  } as unknown as InstanceType<typeof import('@/village/village-service').VillageService>

  const redstoneService = {
    setComponent: (_position: unknown, _type: unknown) =>
      Effect.succeed({ type: 'wire', position: { x: 0, y: 0, z: 0 }, state: { active: false, buttonTicksRemaining: 0, pistonExtended: false } }),
    removeComponent: (_position: unknown) => Effect.void,
    getComponent: (_position: unknown) => Effect.succeed(Option.none()),
    getComponents: () => Effect.succeed([]),
    toggleLever: (_position: unknown) => Effect.succeed(Option.none()),
    pressButton: (_position: unknown, _durationTicks?: unknown) => Effect.succeed(Option.none()),
    toggleTorch: (_position: unknown) => Effect.succeed(Option.none()),
    getPowerAt: (_position: unknown) => Effect.succeed(0),
    getPowerSnapshot: () => Effect.succeed({ tick: 0, poweredPositions: [] }),
    tick: () => Effect.succeed({ tick: 0, poweredPositions: [] }),
  } as unknown as InstanceType<typeof import('@/redstone/redstone-service').RedstoneService>

  const fluidService = {
    notifyBlockChanged: (_position: unknown) => Effect.void,
    seedWater: (_position: unknown) => Effect.void,
    removeWater: (_position: unknown) => Effect.void,
    syncLoadedChunks: (_chunks: unknown) => Effect.void,
    tick: () => Effect.void,
  } as unknown as InstanceType<typeof import('@/application/fluid/fluid-service').FluidService>

  return {
    gameState,
    playerCameraState: cameraState.service,
    firstPersonCamera,
    thirdPersonCamera,
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
    soundManager,
    musicManager,
    entityManager,
    mobSpawner,
    villageService,
    tradingPresentation,
    redstoneService,
    fluidService,
    cameraState: cameraState.state,
  }
}

// Convenience: run one frame with the provided deps and services.
// createFrameHandler is now an Effect (initialises Refs) — yield* before calling the handler.
const runFrame = (deps: FrameHandlerDeps, services: FrameHandlerServices): Effect.Effect<void> =>
  Effect.gen(function* () {
    const handler = yield* createFrameHandler(deps, services)
    yield* handler(0.016 as DeltaTimeSecs)
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
      const deps = yield* makeDeps(true /* paused */)
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

      yield* runFrame(deps, services)

      expect(cameraUpdateSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls firstPersonCamera.update when gamePausedRef is false', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false /* not paused */)
      const cameraUpdateSpy = vi.fn(() => Effect.void)

      const invState = { open: false }
      const setState = { open: false }
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })
      ;(services.firstPersonCamera as unknown as { update: unknown }).update = cameraUpdateSpy

      yield* runFrame(deps, services)

      expect(cameraUpdateSpy).toHaveBeenCalledOnce()
    }))

    it.effect('suppresses hotbarService.update when gamePausedRef is true', () => Effect.gen(function* () {
      const deps = yield* makeDeps(true)
      const hotbarUpdateSpy = vi.fn(() => Effect.void)

      const invState = { open: false }
      const setState = { open: false }
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })
      ;(services.hotbarService as unknown as { update: unknown }).update = hotbarUpdateSpy

      yield* runFrame(deps, services)

      expect(hotbarUpdateSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls hotbarService.update when gamePausedRef is false', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const hotbarUpdateSpy = vi.fn(() => Effect.void)

      const invState = { open: false }
      const setState = { open: false }
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })
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
      const invState = { open: true }
      const setState = { open: false }
      const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)

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

    it.effect('closes settings and sets gamePausedRef to false when Escape is pressed while settings is open', () => Effect.gen(function* () {
      const invState = { open: false }
      const setState = { open: true }
      const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)

      const deps = yield* makeDeps(true /* paused because settings is open */)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      yield* runFrame(deps, services)

      // Settings must now be closed
      expect(setState.open).toBe(false)
      // gamePausedRef must be false
      const paused = yield* Ref.get(deps.gamePausedRef)
      expect(paused).toBe(false)
    }))

    it.effect('opens settings and sets gamePausedRef to true when Escape is pressed while nothing is open', () => Effect.gen(function* () {
      const invState = { open: false }
      const setState = { open: false }
      const pressedKeys = MutableHashSet.make(KeyMappings.ESCAPE)

      const deps = yield* makeDeps(false /* not paused */)
      const services = makeServices({
        inputService: makeInputService(pressedKeys),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      yield* runFrame(deps, services)

      // Settings must now be open
      expect(setState.open).toBe(true)
      // gamePausedRef must be true
      const paused = yield* Ref.get(deps.gamePausedRef)
      expect(paused).toBe(true)
    }))

    it.effect('does not change overlay states when Escape is not pressed', () => Effect.gen(function* () {
      const invState = { open: false }
      const setState = { open: false }

      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(/* no pressed keys */),
        inventoryRenderer: makeInventoryRenderer(invState),
        settingsOverlay: makeSettingsOverlay(setState),
      })

      yield* runFrame(deps, services)

      expect(invState.open).toBe(false)
      expect(setState.open).toBe(false)
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
  })

  // -------------------------------------------------------------------------
  // Step 7: Block interaction
  // -------------------------------------------------------------------------

  describe('step 7 — block interaction', () => {
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
      const placeSpy = vi.fn(() => Effect.void)
      ;(services.blockService as unknown as { placeBlock: unknown }).placeBlock = placeSpy

      yield* runFrame(deps, services)

      expect(placeSpy).toHaveBeenCalledOnce()
      // Adjacent position = block + normal = (0+0, 64+1, 0+0) = (0, 65, 0)
      expect(placeSpy).toHaveBeenCalledWith({ x: 0, y: 65, z: 0 }, 'GRASS')
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
      expect(deps.camera.position.y).toBeCloseTo(64 + 0.7)
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
      expect(deps.camera.position.y).toBeCloseTo(64 + 0.7 + 1.5)
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

    it.effect('calls renderer.render every frame regardless of pause state', () => Effect.gen(function* () {
      const deps = yield* makeDeps(true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      yield* runFrame(deps, services)

      expect((deps.renderer as unknown as { render: ReturnType<typeof vi.fn> }).render).toHaveBeenCalledOnce()
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

      // high quality: refractionThrottleFrames=2, so frames 1 and 3 run (2 calls in 3 frames)
      expect(refractionSpy).toHaveBeenCalledTimes(2)
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
  })
})
