import { Effect } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { ThreeCameraLive, ThreeCameraService, PLAYER_EYE_HEIGHT } from '../camera-three'
import { Position, CameraState } from '@/domain/components'

const mockControlsObject = {
  position: { set: vi.fn() },
  rotation: { y: 0, order: '' },
}

// Mocks
vi.mock('three', async () => {
  const actual = await vi.importActual('three')
  return {
    ...actual,
    PerspectiveCamera: vi.fn(() => ({
      rotation: { x: 0, order: '' },
      aspect: 0,
      updateProjectionMatrix: vi.fn(),
    })),
  }
})

const mockControls = {
  getObject: vi.fn(() => mockControlsObject),
  moveRight: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
}
vi.mock('three/examples/jsm/controls/PointerLockControls.js', () => ({
  PointerLockControls: vi.fn(() => mockControls),
}))

const mockedPerspectiveCamera = vi.mocked(THREE.PerspectiveCamera)
const mockedPointerLockControls = vi.mocked(PointerLockControls)

describe('ThreeCameraLive', () => {
  let canvas: HTMLElement
  let cameraInstance: any
  let controlsInstance: any

  beforeEach(() => {
    vi.clearAllMocks()
    canvas = document.createElement('div')
    mockControlsObject.position.set.mockClear()
    mockControlsObject.rotation.y = 0
    mockControlsObject.rotation.order = ''

    // Reset mocks with fresh instances for each test
    cameraInstance = {
      rotation: { x: 0, order: '' },
      aspect: 0,
      updateProjectionMatrix: vi.fn(),
    }
    controlsInstance = {
      getObject: vi.fn(() => mockControlsObject),
      moveRight: vi.fn(),
      lock: vi.fn(),
      unlock: vi.fn(),
    }
    mockedPerspectiveCamera.mockReturnValue(cameraInstance)
    mockedPointerLockControls.mockReturnValue(controlsInstance)
  })

  const run = <A, E>(program: Effect.Effect<A, E, ThreeCameraService>) => {
    return Effect.runPromise(Effect.provide(program, ThreeCameraLive(canvas)))
  }

  it('should initialize camera and controls', async () => {
    await run(Effect.void)
    expect(mockedPerspectiveCamera).toHaveBeenCalledWith(75, expect.any(Number), 0.1, 1000)
    expect(mockedPointerLockControls).toHaveBeenCalledWith(expect.any(Object), canvas)
    expect(controlsInstance.getObject().rotation.order).toBe('YXZ')
  })

  it('should sync camera to component state', async () => {
    const position = new Position({ x: 1, y: 2, z: 3 })
    const cameraState = new CameraState({ pitch: 0.5, yaw: 1.5 })

    const program = Effect.gen(function* (_) {
      const service = yield* _(ThreeCameraService)
      yield* _(service.syncToComponent(position, cameraState))

      const controlsObject = service.camera.controls.getObject()
      expect(controlsObject.position.set).toHaveBeenCalledWith(1, 2 + PLAYER_EYE_HEIGHT, 3)
      expect(controlsObject.rotation.y).toBe(1.5)
      expect(service.camera.camera.rotation.x).toBe(0.5)
    })

    await run(program)
  })

  it('should move right', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(ThreeCameraService)
      yield* _(service.moveRight(0.5))
      expect(service.camera.controls.moveRight).toHaveBeenCalledWith(0.5)
    })
    await run(program)
  })

  it('should rotate pitch and clamp it', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(ThreeCameraService)

      // Initial pitch is 0
      yield* _(service.rotatePitch(1.0))
      expect(service.camera.camera.rotation.x).toBe(1.0)

      // Clamp upper bound
      yield* _(service.rotatePitch(1.0))
      expect(service.camera.camera.rotation.x).toBe(Math.PI / 2)

      // Reset
      service.camera.camera.rotation.x = 0

      // Clamp lower bound
      yield* _(service.rotatePitch(-2.0))
      expect(service.camera.camera.rotation.x).toBe(-Math.PI / 2)
    })
    await run(program)
  })

  it('should rotate yaw', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(ThreeCameraService)
      yield* _(service.rotateYaw(0.5))
      expect(service.camera.controls.getObject().rotation.y).toBe(0.5)
    })
    await run(program)
  })

  it('should get yaw and pitch', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(ThreeCameraService)
      service.camera.controls.getObject().rotation.y = 1.23
      service.camera.camera.rotation.x = 0.45

      const yaw = yield* _(service.getYaw)
      const pitch = yield* _(service.getPitch)

      expect(yaw).toBe(1.23)
      expect(pitch).toBe(0.45)
    })
    await run(program)
  })

  it('should handle resize', async () => {
    const renderer = { setSize: vi.fn() } as any
    const program = Effect.gen(function* (_) {
      const service = yield* _(ThreeCameraService)
      yield* _(service.handleResize(renderer))

      expect(service.camera.camera.aspect).toBe(window.innerWidth / window.innerHeight)
      expect(service.camera.camera.updateProjectionMatrix).toHaveBeenCalled()
      expect(renderer.setSize).toHaveBeenCalledWith(window.innerWidth, window.innerHeight)
    })
    await run(program)
  })

  it('should lock and unlock controls', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(ThreeCameraService)
      yield* _(service.lock)
      expect(service.camera.controls.lock).toHaveBeenCalled()
      yield* _(service.unlock)
      expect(service.camera.controls.unlock).toHaveBeenCalled()
    })
    await run(program)
  })
})
