import { Effect, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { vi } from 'vitest'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { DayNightLights } from '@ts-minecraft/game'
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'

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
    moon: Option.none(),
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
  capabilities: { isWebGL2: true },
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
      xpBarMaxElement: Option.none(),
      armorValueElement: Option.none(),
      airElement: Option.none(),
      breakProgressElement: Option.none(),
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
