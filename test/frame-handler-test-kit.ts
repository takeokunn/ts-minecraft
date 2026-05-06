import { Effect, MutableHashSet, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { vi } from 'vitest'
import { createFrameHandlers, type FrameHandlerDeps, type FrameHandlerServices } from '@ts-minecraft/app'
import {
  DEBUG_FEATURE_FLAG_CATALOG,
  DEBUG_FEATURE_FLAG_DEFAULTS,
  type DebugFeatureFlagGroup,
  type DebugFeatureFlagId,
} from '@ts-minecraft/app/debug-feature-flags'
import type { DeltaTimeSecs } from '@ts-minecraft/kernel'
import type { DayNightLights } from '@ts-minecraft/game'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'

const testDouble = <T>(value: object): T => value as T

export type CameraMode = 'firstPerson' | 'thirdPerson'

export interface CameraStateStub {
  mode: CameraMode
}

export interface OverlayState {
  open: boolean
}

export const DEFAULT_SETTINGS = {
  renderDistance: 8,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  graphicsQuality: 'high' as const,
  adaptivePerformanceMode: false,
  audioEnabled: true,
  masterVolume: 0.8,
  sfxVolume: 1,
  musicVolume: 0.55,
}

export const makeLights = (): DayNightLights => {
  const light = new THREE.DirectionalLight(0xffffff, 1)
  light.castShadow = true
  light.shadow.camera.left = -128
  light.shadow.camera.right = 128
  light.shadow.camera.top = 128
  light.shadow.camera.bottom = -128

  return {
    light,
    ambientLight: new THREE.AmbientLight(0xffffff, 0.3),
    renderer: { setClearColor: () => {} },
    skyNight: new THREE.Color(0x001133),
    skyDay: new THREE.Color(0x87ceeb),
    skyCurrent: new THREE.Color(0x87ceeb),
    sky: Option.none(),
  }
}

export const makeRenderer = () =>
  testDouble<THREE.WebGLRenderer>({
    render: vi.fn(),
    setPixelRatio: vi.fn(),
    getPixelRatio: vi.fn(() => 1),
    setSize: vi.fn(),
    autoClear: true,
    domElement: { clientWidth: 800, clientHeight: 600 },
    shadowMap: { needsUpdate: false },
    // `info.render.calls` is read by frame-handler.renderStage to feed the
    // perf-HUD draw-call counter. Stub the entire `info` shape so tests
    // exercising real frames don't crash on undefined access.
    info: { render: { calls: 0, triangles: 0, points: 0, lines: 0, frame: 0 } },
  })

export const makeCamera = () => {
  const camera = new THREE.PerspectiveCamera()
  camera.updateProjectionMatrix = () => {}
  return camera
}

export const makeComposer = () =>
  testDouble<EffectComposer>({
    render: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
  })

export const makeCameraState = (initialMode: CameraMode = 'firstPerson') => {
  const state: CameraStateStub = { mode: initialMode }

  const service = testDouble<InstanceType<typeof import('@ts-minecraft/player').PlayerCameraStateService>>({
    getRotation: () => Effect.succeed({ yaw: 0, pitch: 0 }),
    getMode: () => Effect.sync(() => state.mode),
    setYaw: (_yaw: number) => Effect.void,
    setPitch: (_pitch: number) => Effect.void,
    addYaw: (_delta: number) => Effect.void,
    addPitch: (_delta: number) => Effect.void,
    setMode: (mode: CameraMode) => Effect.sync(() => { state.mode = mode }),
    toggleMode: () => Effect.sync(() => { state.mode = state.mode === 'firstPerson' ? 'thirdPerson' : 'firstPerson' }),
    reset: () => Effect.sync(() => { state.mode = 'firstPerson' }),
  })

  return { service, state }
}

export const makeDeps = (paused = false, withComposer = false): Effect.Effect<FrameHandlerDeps & { gamePausedRef: Ref.Ref<boolean> }> =>
  Effect.flatMap(
    Ref.make(paused),
    (gamePausedRef) => Effect.succeed({
      renderer: makeRenderer(),
      scene: new THREE.Scene(),
      camera: makeCamera(),
      respawnPosition: { x: 0, y: 64, z: 0 },
      lights: makeLights(),
      fpsElement: Option.none(),
      healthValueElement: Option.none(),
      healthMaxElement: Option.none(),
      skyMesh: Option.none(),
      gamePausedRef,
      // Tests default to "session not paused" — pause-matrix gating is verified
      // by dedicated tests that override this ref via spread.
      sessionPausedRef: MutableRef.make(false),
      composer: withComposer ? Option.some(makeComposer()) : Option.none(),
      gtaoPass: Option.none(),
      bloomPass: Option.none(),
      dofPass: Option.none(),
      godRaysPass: Option.none(),
      smaaPass: Option.none(),
    })
  )

export const makeInventoryRenderer = (state: OverlayState) =>
  ({
    isOpen: () => Effect.sync(() => state.open),
    toggle: () => Effect.sync(() => {
      state.open = !state.open
      return state.open
    }),
    update: () => Effect.void,
    cycleRecipes: (_delta: number) => Effect.void,
    craftSelectedRecipe: () => Effect.succeed(false),
  }) as InstanceType<typeof import('@ts-minecraft/app/presentation/inventory/inventory-renderer').InventoryRendererService>

export const makeSettingsOverlay = (state: OverlayState) =>
  ({
    isOpen: () => Effect.sync(() => state.open),
    toggle: () => Effect.sync(() => {
      state.open = !state.open
      return state.open
    }),
    syncFromSettings: () => Effect.void,
    applyToSettings: () => Effect.void,
  }) as InstanceType<typeof import('@ts-minecraft/app/presentation/settings/settings-overlay').SettingsOverlayService>

export const makePauseMenu = (state: OverlayState = { open: false }) =>
  testDouble<InstanceType<typeof import('@ts-minecraft/app/presentation/menu/pause-menu').PauseMenuService>>({
    isOpen: () => Effect.sync(() => state.open),
    openIfClosed: () => Effect.sync(() => { state.open = true }),
    attach: (_control: unknown, _persist: unknown) => Effect.void,
  })

export const makeTradingPresentation = (state: OverlayState) =>
  testDouble<InstanceType<typeof import('@ts-minecraft/app/presentation/trading').TradingPresentationService>>({
    open: (_villagerId: string) => Effect.sync(() => {
      state.open = true
      return true
    }),
    close: () => Effect.sync(() => {
      state.open = false
    }),
    isOpen: () => Effect.sync(() => state.open),
    cycleSelection: (_delta: number) => Effect.void,
    refresh: () => Effect.void,
    executeSelectedTrade: () => Effect.succeed(false),
  })

export const makeInputService = (pressedKeys: MutableHashSet.MutableHashSet<string> = MutableHashSet.empty()) =>
  ({
    consumeKeyPress: (key: string) => Effect.sync(() => {
      if (MutableHashSet.has(pressedKeys, key)) {
        MutableHashSet.remove(pressedKeys, key)
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
  }) as InstanceType<typeof import('@ts-minecraft/app/presentation/input/input-service').InputService>

export const makeServices = (opts: {
  inputService: ReturnType<typeof makeInputService>
  inventoryRenderer: ReturnType<typeof makeInventoryRenderer>
  settingsOverlay: ReturnType<typeof makeSettingsOverlay>
  tradingPresentation?: ReturnType<typeof makeTradingPresentation>
}): FrameHandlerServices & { cameraState: CameraStateStub } => {
  const { inputService, inventoryRenderer, settingsOverlay } = opts
  const tradingPresentation = opts.tradingPresentation ?? makeTradingPresentation({ open: false })
  const pauseMenu = makePauseMenu()
  const gameMode = {
    get: () => Effect.succeed('survival' as const),
    set: (_mode: unknown) => Effect.void,
    isCreative: () => Effect.succeed(false),
    isSurvival: () => Effect.succeed(true),
  } as InstanceType<typeof import('@ts-minecraft/game').GameModeService>
  const cameraState = makeCameraState()

  const gameState = testDouble<InstanceType<typeof import('@ts-minecraft/game').GameStateService>>({
    getPlayerPosition: (_id: unknown) => Effect.succeed({ x: 0, y: 64, z: 0 }),
    update: (_dt: unknown) => Effect.void,
    respawn: (_position: unknown) => Effect.void,
    isPlayerGrounded: () => Effect.succeed(true),
  })

  const firstPersonCamera = {
    update: (_cam: unknown) => Effect.void,
  } as InstanceType<typeof import('@ts-minecraft/player').FirstPersonCameraService>

  const thirdPersonCamera = {
    update: (camera: THREE.PerspectiveCamera, playerPos: { x: number; y: number; z: number }, eyeLevelOffset = 0.72) =>
      Effect.sync(() => {
        const distance = 4
        const shoulderHeight = 1.5
        const eyeY = playerPos.y + eyeLevelOffset
        camera.position.set(playerPos.x, eyeY + shoulderHeight, playerPos.z - distance)
        camera.lookAt(playerPos.x, eyeY, playerPos.z)
      }),
  } as InstanceType<typeof import('@ts-minecraft/player').ThirdPersonCameraService>

  const blockHighlight = {
    update: (_cam: unknown, _scene: unknown) => Effect.void,
    invalidateCache: () => Effect.void,
    setVisible: (_visible: boolean) => Effect.void,
    getTargetBlock: () => Effect.succeed(Option.none()),
    getTargetHit: () => Effect.succeed(Option.none()),
  } as InstanceType<typeof import('@ts-minecraft/app/presentation/highlight/block-highlight').BlockHighlightService>

  const blockService = testDouble<InstanceType<typeof import('@ts-minecraft/terrain').BlockService>>({
    breakBlock: (_pos: unknown) => Effect.void,
    placeBlock: (_pos: unknown, _type: unknown, _slot?: unknown) => Effect.void,
  })

  const inventoryService = testDouble<InstanceType<typeof import('@ts-minecraft/inventory').InventoryService>>({
    getAllSlots: () => Effect.succeed([]),
    getSlot: (_index: unknown) => Effect.succeed(Option.none()),
    setSlot: (_index: unknown, _stack: unknown) => Effect.void,
    moveStack: (_from: unknown, _to: unknown) => Effect.void,
    addBlock: (_type: unknown, _count: unknown) => Effect.succeed(true),
    removeBlock: (_type: unknown, _count: unknown, _slot?: unknown) => Effect.succeed(true),
    getHotbarSlots: () => Effect.succeed([]),
    serialize: () => Effect.succeed({ slots: [] }),
    deserialize: (_data: unknown) => Effect.void,
  })

  const hotbarService = testDouble<InstanceType<typeof import('@ts-minecraft/inventory').HotbarService>>({
    update: () => Effect.void,
    getSlots: () => Effect.succeed([]),
    getSelectedSlot: () => Effect.succeed(0),
    getSelectedBlockType: () => Effect.succeed({ _tag: 'None' }),
  })

  const hotbarRenderer = {
    update: (_slots: unknown, _sel: unknown) => Effect.void,
    render: (_renderer: unknown) => Effect.void,
  } as InstanceType<typeof import('@ts-minecraft/app/presentation/hud/hotbar-three').HotbarRendererService>

  const chunkManagerService = testDouble<InstanceType<typeof import('@ts-minecraft/terrain').ChunkManagerService>>({
    loadChunksAroundPlayer: (_pos: unknown) => Effect.void,
    getLoadedChunks: () => Effect.succeed([]),
    drainRenderDirtyChunks: () => Effect.succeed([]),
    getChunk: (_coord: unknown) => Effect.succeed({ coord: { x: 0, z: 0 }, blocks: new Uint8Array(0), dirty: false }),
  })

  const timeService = {
    advanceTick: (_dt: unknown) => Effect.void,
    getTimeOfDay: () => Effect.succeed(0.5),
    isNight: () => Effect.succeed(false),
    getDayLength: () => Effect.succeed(DEFAULT_SETTINGS.dayLengthSeconds),
    setDayLength: (_seconds: unknown) => Effect.void,
    setTimeOfDay: (_time: unknown) => Effect.void,
  } as InstanceType<typeof import('@ts-minecraft/game').TimeService>

  const settingsService = {
    getSettings: () => Effect.succeed({ ...DEFAULT_SETTINGS }),
    updateSettings: (_patch: unknown) => Effect.void,
    resetToDefaults: () => Effect.void,
  } as InstanceType<typeof import('@ts-minecraft/game').SettingsService>

  const debugFlagsState = { current: { ...DEBUG_FEATURE_FLAG_DEFAULTS } }
  const resetDebugFeatureGroup = (group: DebugFeatureFlagGroup): Effect.Effect<void, never> =>
    Effect.sync(() => {
      let nextFlags = { ...debugFlagsState.current }
      for (const entry of DEBUG_FEATURE_FLAG_CATALOG) {
        if (entry.group === group) {
          nextFlags = { ...nextFlags, [entry.id]: DEBUG_FEATURE_FLAG_DEFAULTS[entry.id] }
        }
      }
      debugFlagsState.current = nextFlags
    })
  const debugFeatureFlags = testDouble<InstanceType<typeof import('@ts-minecraft/app/debug-feature-flags').DebugFeatureFlagsService>>({
    catalog: DEBUG_FEATURE_FLAG_CATALOG,
    getSnapshot: () => Effect.succeed({
      catalog: DEBUG_FEATURE_FLAG_CATALOG,
      flags: { ...debugFlagsState.current },
    }),
    getFlags: () => Effect.succeed({ ...debugFlagsState.current }),
    isEnabled: (id: DebugFeatureFlagId) => Effect.succeed(debugFlagsState.current[id]),
    setEnabled: (id: DebugFeatureFlagId, enabled: boolean) =>
      Effect.sync(() => {
        const changed = debugFlagsState.current[id] !== enabled
        debugFlagsState.current = { ...debugFlagsState.current, [id]: enabled }
        return changed
      }),
    resetAll: () => Effect.sync(() => {
      debugFlagsState.current = { ...DEBUG_FEATURE_FLAG_DEFAULTS }
    }),
    resetGroup: resetDebugFeatureGroup,
  })

  const fpsCounter = testDouble<InstanceType<typeof import('@ts-minecraft/app/presentation/fps-counter').FPSCounterService>>({
    tick: (_dt: unknown) => Effect.void,
    getFPS: () => Effect.succeed(60),
    getFrameCount: () => Effect.succeed(0),
    reset: () => Effect.void,
  })

  const worldRendererService = testDouble<InstanceType<typeof import('@ts-minecraft/rendering').WorldRendererService>>({
    syncChunksToScene: (_chunks: unknown, _scene: unknown) => Effect.succeed(true as boolean),
    applyFrustumCulling: (_camera: unknown) => Effect.void,
    updateChunkInScene: (_chunk: unknown, _scene: unknown) => Effect.void,
    clearScene: (_scene: unknown) => Effect.void,
    doRefractionPrePass: (_renderer: unknown, _scene: unknown, _camera: unknown) => Effect.void,
    updateWaterUniforms: (_time: number, _cameraPosition: unknown) => Effect.void,
    updateWaterResolution: (_width: number, _height: number) => Effect.void,
    resizeRefractionRT: (_width: number, _height: number) => Effect.void,
    resizeRefractionCamera: (_aspect: number) => Effect.void,
    getWaterMeshes: () => Effect.succeed([] as THREE.Mesh[]),
    getSceneVersion: () => Effect.succeed(0),
    setRefractionValid: (_valid: boolean) => Effect.void,
  })

  const entityRenderer = {
    syncEntities: (_entities: unknown, _scene: unknown) => Effect.void,
    updateEntityTransforms: (_entities: unknown, _total: unknown, _delta: unknown) => Effect.void,
    clearScene: (_scene: unknown) => Effect.void,
    _getTrackedGroup: (_id: unknown) => Effect.succeed(Option.none()),
  } as InstanceType<typeof import('@ts-minecraft/rendering').EntityRendererService>

  const chunkMeshService = {
    setSunIntensity: (_value: number) => Effect.void,
  } as InstanceType<typeof import('@ts-minecraft/rendering').ChunkMeshService>

  // ParticleSystem stub: spawnBurst/update/getActiveCount no-op. Real impl
  // requires an InstancedMesh + atlas texture which the test-kit avoids.
  const particleSystem = testDouble<InstanceType<typeof import('@ts-minecraft/rendering/particles/particle-system').ParticleSystemService>>({
    attach: (_scene: unknown) => Effect.void,
    spawnBurst: (_x: number, _y: number, _z: number, _u: number, _v: number, _count?: number) => Effect.void,
    update: (_dtSecs: number) => Effect.void,
    getActiveCount: () => Effect.succeed(0),
  })

  const healthService = {
    getHealth: () => Effect.succeed({ current: 20, max: 20, invincibilityTicks: 0 }),
    applyDamage: (_amount: unknown) => Effect.void,
    isDead: () => Effect.succeed(false),
    tick: () => Effect.void,
    processFallDamage: (_y: unknown, _grounded: unknown) => Effect.succeed(0),
    reset: () => Effect.void,
  } as InstanceType<typeof import('@ts-minecraft/player').HealthService>

  const soundManager = {
    applySettings: (_settings: unknown) => Effect.void,
    setListenerPosition: (_position: unknown) => Effect.void,
    playEffect: (_effect: unknown, _options?: unknown) => Effect.void,
    getState: () => Effect.succeed({ enabled: true, masterVolume: 0.8, sfxVolume: 1, listenerPosition: { x: 0, y: 64, z: 0 } }),
  } as InstanceType<typeof import('@ts-minecraft/game').SoundManager>

  const musicManager = {
    applySettings: (_settings: unknown) => Effect.void,
    setEnvironment: (_environment: unknown) => Effect.void,
    updateFromContext: (_context: unknown) => Effect.void,
    stop: () => Effect.void,
    getCurrentEnvironment: () => Effect.succeed(Option.none()),
    getState: () => Effect.succeed({ enabled: true, masterVolume: 0.8, musicVolume: 0.55 }),
  } as InstanceType<typeof import('@ts-minecraft/game').MusicManager>

  const entityManager = testDouble<InstanceType<typeof import('@ts-minecraft/entities').EntityManager>>({
    addEntity: (_type: unknown, _position: unknown) => Effect.succeed('entity-1' as unknown),
    removeEntity: (_entityId: unknown) => Effect.succeed(false),
    getEntity: (_entityId: unknown) => Effect.succeed(Option.none()),
    getEntities: () => Effect.succeed([]),
    getEntityAIState: (_entityId: unknown) => Effect.succeed(Option.none()),
    getCount: () => Effect.succeed(0),
    getStructureVersion: () => Effect.succeed(0),
    getPlayerContactDamage: (_playerPosition: unknown) => Effect.succeed(0),
    update: (_deltaTime: unknown, _playerPosition: unknown) => Effect.void,
    applyDamage: (_entityId: unknown, _amount: unknown) => Effect.succeed(Option.none()),
  })

  const mobSpawner = {
    trySpawn: (_playerPosition: unknown) => Effect.succeed(Option.none()),
    getSpawnBounds: () => Effect.succeed({ minDistance: 16, maxDistance: 40 }),
    getMaxPopulation: () => Effect.succeed(24),
  } as InstanceType<typeof import('@ts-minecraft/entities').MobSpawner>

  const villageService = testDouble<InstanceType<typeof import('@ts-minecraft/entities').VillageService>>({
    ensureVillageNear: (_playerPosition: unknown) => Effect.succeed({ villageId: 'village-1', center: { x: 0, y: 64, z: 0 }, structures: [], villagers: [] }),
    getVillages: () => Effect.succeed([]),
    getVillagers: () => Effect.succeed([]),
    getVillager: (_villagerId: unknown) => Effect.succeed(Option.none()),
    findNearestVillager: (_position: unknown, _maxDistance: unknown) => Effect.succeed(Option.none()),
    addVillagerExperience: (_villagerId: unknown, _amount: unknown) => Effect.succeed(Option.none()),
    update: (_playerPosition: unknown, _timeOfDay: unknown, _deltaTime: unknown) => Effect.void,
  })

  const redstoneService = testDouble<InstanceType<typeof import('@ts-minecraft/entities').RedstoneService>>({
    setComponent: (_position: unknown, _type: unknown) => Effect.succeed({ type: 'wire', position: { x: 0, y: 0, z: 0 }, state: { active: false, buttonTicksRemaining: 0, pistonExtended: false } }),
    removeComponent: (_position: unknown) => Effect.void,
    getComponent: (_position: unknown) => Effect.succeed(Option.none()),
    getComponents: () => Effect.succeed([]),
    toggleLever: (_position: unknown) => Effect.succeed(Option.none()),
    pressButton: (_position: unknown, _durationTicks?: unknown) => Effect.succeed(Option.none()),
    toggleTorch: (_position: unknown) => Effect.succeed(Option.none()),
    getPowerAt: (_position: unknown) => Effect.succeed(0),
    getPowerSnapshot: () => Effect.succeed({ tick: 0, poweredPositions: [] }),
    tick: () => Effect.succeed({ tick: 0, poweredPositions: [] }),
  })

  const fluidService = {
    notifyBlockChanged: (_position: unknown) => Effect.void,
    seedWater: (_position: unknown) => Effect.void,
    removeWater: (_position: unknown) => Effect.void,
    syncLoadedChunks: (_chunks: unknown) => Effect.void,
    tick: () => Effect.void,
  } as InstanceType<typeof import('@ts-minecraft/terrain').FluidService>

  const furnaceService = testDouble<InstanceType<typeof import('@ts-minecraft/furnace').FurnaceService>>({
    getState: () => Effect.succeed({ active: Option.none() }),
    getNearestFurnaceState: () => Effect.succeed(Option.none()),
    hasNearbyFurnace: () => Effect.succeed(false),
    setSelectedFurnace: (_position: unknown) => Effect.void,
    startSmelting: (_recipeId: unknown) => Effect.void,
    collectOutput: () => Effect.succeed(true),
    clearFurnace: (_position: unknown) => Effect.succeed([]),
    dismantleFurnace: (_position: unknown) => Effect.succeed(true),
    serialize: () => Effect.succeed([]),
    deserialize: (_serialized: unknown) => Effect.void,
    tick: (_deltaTime: unknown) => Effect.void,
  })

  // PerfHud stub: no-op for all four methods. Real implementation activates only
  // under `?debug=perf`; the test-kit always uses the inert path.
  const perfHud = {
    recordFrame: (_dtSecs: number) => Effect.void,
    setWorkerQueueDepth: (_n: number) => Effect.void,
    setChunkCount: (_n: number) => Effect.void,
    setDrawCalls: (_n: number) => Effect.void,
  } as InstanceType<typeof import('@ts-minecraft/rendering').PerfHudService>

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
    debugFeatureFlags,
    settingsOverlay,
    pauseMenu,
    inventoryRenderer,
    inventoryService,
    fpsCounter,
    worldRendererService,
    entityRenderer,
    chunkMeshService,
    particleSystem,
    healthService,
    soundManager,
    musicManager,
    entityManager,
    mobSpawner,
    villageService,
    tradingPresentation,
    redstoneService,
    fluidService,
    furnaceService,
    perfHud,
    gameMode,
    cameraState: cameraState.state,
  }
}

export const runFrame = (deps: FrameHandlerDeps, services: FrameHandlerServices): Effect.Effect<void> =>
  Effect.gen(function* () {
    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler().pipe(Effect.andThen(frameHandler(0.016 as DeltaTimeSecs)))
  })

export type FrameHarnessOptions = {
  readonly paused?: boolean
  readonly inventoryOpen?: boolean
  readonly settingsOpen?: boolean
  readonly withComposer?: boolean
  readonly pressedKeys?: MutableHashSet.MutableHashSet<string>
}

export const arrangeFrameHarness = ({
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
