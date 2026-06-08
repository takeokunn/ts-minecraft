import { Effect, MutableHashSet, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { vi } from 'vitest'
import { createFrameHandlers, type FrameHandlerDeps, type FrameHandlerServices } from '@ts-minecraft/app'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import type { DayNightLights } from '@ts-minecraft/game'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { makeInputService, makeInventoryRenderer, makeSettingsOverlay, makeTradingPresentation, makePauseMenu, makeBlockHighlight, makeHotbarRenderer, makeDebugFeatureFlags, makeFPSCounter, makeFurnaceService } from './app-test-kit'
import { makeEntityManager, makeMobSpawner, makeRedstoneService, makeVillageService } from './entities-test-kit'
import { makeGameMode, makeGameState, makeMusicManager, makeSettingsService, makeSoundManager, makeTimeService } from './game-test-kit'
import { makeEquipmentService, makeHotbarService, makeInventoryService } from './inventory-test-kit'
import { makeCameraState, makeFirstPersonCamera, makeFishingService, makeHealthService, makeHungerService, makeThirdPersonCamera, makeXPService } from './player-test-kit'
import { makeChunkMeshService, makeEntityRenderer, makeParticleSystem, makePerfHud, makeWorldRendererService } from './rendering-test-kit'
import { makeBlockService, makeChunkManagerService, makeFluidService, makeNetherService, makeWeatherService } from './terrain-test-kit'

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

/** Creates the day/night light bundle used by frame-handler tests. */
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

/** Creates a WebGL renderer fake with the fields read by frame render stages. */
export const makeRenderer = (): THREE.WebGLRenderer => ({
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
} as unknown as InstanceType<typeof import('three').WebGLRenderer>)

/** Creates a perspective camera fake with inert projection updates. */
export const makeCamera = () => {
  const camera = new THREE.PerspectiveCamera()
  camera.updateProjectionMatrix = () => {}
  return camera
}

/** Creates an EffectComposer fake for post-processing frame tests. */
export const makeComposer = (): EffectComposer => ({
  render: vi.fn(),
  setPixelRatio: vi.fn(),
  setSize: vi.fn(),
} as unknown as InstanceType<typeof import('three/addons/postprocessing/EffectComposer.js').EffectComposer>)

/** Creates frame-handler dependencies with optional paused and composer state. */
export const makeDeps = (paused = false, withComposer = false): Effect.Effect<FrameHandlerDeps & { gamePausedRef: Ref.Ref<boolean> }> =>
  Effect.flatMap(
    Ref.make(paused),
    (gamePausedRef) => Effect.succeed({
      renderer: makeRenderer(),
      scene: new THREE.Scene(),
      camera: makeCamera(),
      respawnPositionRef: MutableRef.make({ x: 0, y: 64, z: 0 }),
      lights: makeLights(),
      fpsElement: Option.none(),
      healthValueElement: Option.none(),
      healthMaxElement: Option.none(),
      hungerValueElement: Option.none(),
      hungerMaxElement: Option.none(),
      xpLevelElement: Option.none(),
      xpBarElement: Option.none(),
      armorValueElement: Option.none(),
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

/** Creates the complete frame-handler service graph from focused package fakes. */
export const makeServices = (opts: {
  inputService: ReturnType<typeof makeInputService>
  inventoryRenderer: ReturnType<typeof makeInventoryRenderer>
  settingsOverlay: ReturnType<typeof makeSettingsOverlay>
  tradingPresentation?: ReturnType<typeof makeTradingPresentation>
}): FrameHandlerServices & { cameraState: CameraStateStub } => {
  const { inputService, inventoryRenderer, settingsOverlay } = opts
  const tradingPresentation = opts.tradingPresentation ?? makeTradingPresentation({ open: false })
  const cameraState = makeCameraState()

  return {
    gameState: makeGameState(),
    playerCameraState: cameraState.service,
    firstPersonCamera: makeFirstPersonCamera(),
    thirdPersonCamera: makeThirdPersonCamera(),
    blockHighlight: makeBlockHighlight(),
    inputService,
    blockService: makeBlockService(),
    hotbarService: makeHotbarService(),
    hotbarRenderer: makeHotbarRenderer(),
    chunkManagerService: makeChunkManagerService(),
    timeService: makeTimeService(),
    settingsService: makeSettingsService(),
    debugFeatureFlags: makeDebugFeatureFlags(),
    settingsOverlay,
    pauseMenu: makePauseMenu(),
    inventoryRenderer,
    inventoryService: makeInventoryService(),
    equipmentService: makeEquipmentService(),
    xpService: makeXPService(),
    fishingService: makeFishingService(),
    fpsCounter: makeFPSCounter(),
    worldRendererService: makeWorldRendererService(),
    entityRenderer: makeEntityRenderer(),
    chunkMeshService: makeChunkMeshService(),
    particleSystem: makeParticleSystem(),
    healthService: makeHealthService(),
    hungerService: makeHungerService(),
    soundManager: makeSoundManager(),
    musicManager: makeMusicManager(),
    entityManager: makeEntityManager(),
    mobSpawner: makeMobSpawner(),
    villageService: makeVillageService(),
    tradingPresentation,
    redstoneService: makeRedstoneService(),
    fluidService: makeFluidService(),
    furnaceService: makeFurnaceService(),
    netherService: makeNetherService(),
    weatherService: makeWeatherService(),
    perfHud: makePerfHud(),
    gameMode: makeGameMode(),
    cameraState: cameraState.state,
  }
}

/** Runs one maintenance pass followed by one frame-handler pass. */
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

/** Arranges a complete frame-handler test harness with mutable overlay states. */
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
