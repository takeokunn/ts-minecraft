import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { PerspectiveCamera, WebGLRenderer } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type { CameraState, Position } from '@/domain/components'
import { clampPitch } from '@/domain/camera-logic'
import { ThreeCamera } from './types'

// --- Constants ---

export const PLAYER_EYE_HEIGHT = 1.6

// --- Service Definition ---

export interface ThreeCameraService {
  readonly camera: ThreeCamera
  readonly syncToComponent: (position: Position, cameraState: CameraState) => Effect.Effect<void>
  readonly moveRight: (delta: number) => Effect.Effect<void>
  readonly rotatePitch: (delta: number) => Effect.Effect<void>
  readonly rotateYaw: (delta: number) => Effect.Effect<void>
  readonly getYaw: Effect.Effect<number>
  readonly getPitch: Effect.Effect<number>
  readonly handleResize: (renderer: WebGLRenderer) => Effect.Effect<void>
  readonly lock: Effect.Effect<void>
  readonly unlock: Effect.Effect<void>
}

export const ThreeCameraService = Context.Tag<ThreeCameraService>()

// --- Service Implementation ---

export const ThreeCameraLive = (canvas: HTMLElement) =>
  Layer.sync(ThreeCameraService, () => {
    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const controls = new PointerLockControls(camera, canvas)
    controls.getObject().rotation.order = 'YXZ'
    const threeCamera: ThreeCamera = { camera, controls }

    return ThreeCameraService.of({
      camera: threeCamera,
      syncToComponent: (position, cameraState) =>
        Effect.sync(() => {
          const controlsObject = threeCamera.controls.getObject()
          controlsObject.position.set(position.x, position.y + PLAYER_EYE_HEIGHT, position.z)
          controlsObject.rotation.y = cameraState.yaw
          threeCamera.camera.rotation.x = cameraState.pitch
        }),
      moveRight: (delta) => Effect.sync(() => threeCamera.controls.moveRight(delta)),
      rotatePitch: (delta) =>
        Effect.sync(() => {
          if (Number.isNaN(delta)) return
          const newPitch = threeCamera.camera.rotation.x + delta
          threeCamera.camera.rotation.x = clampPitch(newPitch)
        }),
      rotateYaw: (delta) => Effect.sync(() => (threeCamera.controls.getObject().rotation.y += delta)),
      getYaw: Effect.sync(() => threeCamera.controls.getObject().rotation.y),
      getPitch: Effect.sync(() => threeCamera.camera.rotation.x),
      handleResize: (renderer) =>
        Effect.sync(() => {
          threeCamera.camera.aspect = window.innerWidth / window.innerHeight
          threeCamera.camera.updateProjectionMatrix()
          renderer.setSize(window.innerWidth, window.innerHeight)
        }),
      lock: Effect.sync(() => threeCamera.controls.lock()),
      unlock: Effect.sync(() => threeCamera.controls.unlock()),
    })
  })
