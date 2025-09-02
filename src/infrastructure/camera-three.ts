import { Context, Effect, Layer } from 'effect'
import { PerspectiveCamera, WebGLRenderer } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { clampPitch } from '@/domain/camera-logic'
import { ThreeCamera } from './types'

// --- Constants ---

export const PLAYER_EYE_HEIGHT = 1.6

// --- Service Definition ---

export interface ThreeCameraService {
  readonly camera: ThreeCamera
  readonly syncToComponent: (x: number, y: number, z: number, pitch: number, yaw: number) => Effect.Effect<void, Error>
  readonly moveRight: (delta: number) => Effect.Effect<void, Error>
  readonly rotatePitch: (delta: number) => Effect.Effect<void, Error>
  readonly rotateYaw: (delta: number) => Effect.Effect<void, Error>
  readonly getYaw: Effect.Effect<number, Error>
  readonly getPitch: Effect.Effect<number, Error>
  readonly handleResize: (renderer: WebGLRenderer) => Effect.Effect<void, Error>
  readonly lock: Effect.Effect<void, Error>
  readonly unlock: Effect.Effect<void, Error>
}

export const ThreeCameraService = Context.GenericTag<ThreeCameraService>('app/ThreeCameraService')

// --- Service Implementation ---

export const ThreeCameraLive = (canvas: HTMLElement) =>
  Layer.scoped(
    ThreeCameraService,
    Effect.acquireRelease(
      Effect.sync(() => {
        const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        const controls = new PointerLockControls(camera, canvas)
        controls.getObject().rotation.order = 'YXZ'
        return { camera, controls } as ThreeCamera
      }),
      (threeCamera) => Effect.sync(() => threeCamera.controls.dispose()),
    ).pipe(
      Effect.map((threeCamera) => ({
        camera: threeCamera,
        syncToComponent: (x: number, y: number, z: number, pitch: number, yaw: number) =>
          Effect.try({
            try: () => {
              const controlsObject = threeCamera.controls.getObject()
              controlsObject.position.set(x, y + PLAYER_EYE_HEIGHT, z)
              controlsObject.rotation.y = yaw
              threeCamera.camera.rotation.x = pitch
            },
            catch: (e) => new Error(`Failed to sync camera to component: ${e}`),
          }),
        moveRight: (delta: number) =>
          Effect.try({
            try: () => threeCamera.controls.moveRight(delta),
            catch: (e) => new Error(`Failed to move camera right: ${e}`),
          }),
        rotatePitch: (delta: number) =>
          Effect.try({
            try: () => {
              if (Number.isNaN(delta)) return
              const newPitch = threeCamera.camera.rotation.x + delta
              threeCamera.camera.rotation.x = clampPitch(newPitch)
            },
            catch: (e) => new Error(`Failed to rotate camera pitch: ${e}`),
          }),
        rotateYaw: (delta: number) =>
          Effect.try({
            try: () => (threeCamera.controls.getObject().rotation.y += delta),
            catch: (e) => new Error(`Failed to rotate camera yaw: ${e}`),
          }),
        getYaw: Effect.try({
          try: () => threeCamera.controls.getObject().rotation.y,
          catch: (e) => new Error(`Failed to get camera yaw: ${e}`),
        }),
        getPitch: Effect.try({
          try: () => threeCamera.camera.rotation.x,
          catch: (e) => new Error(`Failed to get camera pitch: ${e}`),
        }),
        handleResize: (renderer: WebGLRenderer) =>
          Effect.try({
            try: () => {
              threeCamera.camera.aspect = window.innerWidth / window.innerHeight
              threeCamera.camera.updateProjectionMatrix()
              renderer.setSize(window.innerWidth, window.innerHeight)
            },
            catch: (e) => new Error(`Failed to handle resize: ${e}`),
          }),
        lock: Effect.try({
          try: () => threeCamera.controls.lock(),
          catch: (e) => new Error(`Failed to lock camera controls: ${e}`),
        }),
        unlock: Effect.try({
          try: () => threeCamera.controls.unlock(),
          catch: (e) => new Error(`Failed to unlock camera controls: ${e}`),
        }),
      })),
    ),
  )
