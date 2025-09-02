import { Context, Effect, Layer } from 'effect'
import { PerspectiveCamera, WebGLRenderer } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { clampPitch } from '@/domain/camera-logic'
import type { CameraState, Position } from '@/domain/components'
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

export const ThreeCameraService = Context.GenericTag<ThreeCameraService>('app/ThreeCameraService')

// --- Service Implementation ---

export const ThreeCameraLive = (canvas: HTMLElement) =>
  Layer.sync(ThreeCameraService, () => {
    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const controls = new PointerLockControls(camera, canvas)
    controls.getObject().rotation.order = 'YXZ'
    const threeCamera: ThreeCamera = { camera, controls }

    return {
      camera: threeCamera,
      syncToComponent: (position: Position, cameraState: CameraState) =>
        Effect.sync(() => {
          const controlsObject = threeCamera.controls.getObject()
          controlsObject.position.set(position.x, position.y + PLAYER_EYE_HEIGHT, position.z)
          controlsObject.rotation.y = cameraState.yaw
          threeCamera.camera.rotation.x = cameraState.pitch
        }),
      moveRight: (delta: number) => Effect.sync(() => threeCamera.controls.moveRight(delta)),
      rotatePitch: (delta: number) =>
        Effect.sync(() => {
          if (Number.isNaN(delta)) return
          const newPitch = threeCamera.camera.rotation.x + delta
          threeCamera.camera.rotation.x = clampPitch(newPitch)
        }),
      rotateYaw: (delta: number) => Effect.sync(() => (threeCamera.controls.getObject().rotation.y += delta)),
      getYaw: Effect.sync(() => threeCamera.controls.getObject().rotation.y),
      getPitch: Effect.sync(() => threeCamera.camera.rotation.x),
      handleResize: (renderer: WebGLRenderer) =>
        Effect.sync(() => {
          threeCamera.camera.aspect = window.innerWidth / window.innerHeight
          threeCamera.camera.updateProjectionMatrix()
          renderer.setSize(window.innerWidth, window.innerHeight)
        }),
      lock: Effect.sync(() => threeCamera.controls.lock()),
      unlock: Effect.sync(() => threeCamera.controls.unlock()),
    }
  })
