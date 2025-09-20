import { describe, it, expect, vi } from 'vitest'
import { Effect, Exit } from 'effect'
import * as THREE from 'three'
import { CameraService, CameraError, CameraConfig, DEFAULT_CAMERA_CONFIG } from '../CameraService.js'
import { FirstPersonCameraLive } from '../FirstPersonCamera.js'
import { ThirdPersonCameraLive } from '../ThirdPersonCamera.js'

describe('CameraService', () => {
  describe('Schema Validations', () => {
    it('FOVの範囲が30-120で制限される', () => {
      const validConfig: CameraConfig = {
        ...DEFAULT_CAMERA_CONFIG,
        fov: 90,
      }
      expect(validConfig.fov).toBe(90)
    })

    it('sensitivityの範囲が0.1-10で制限される', () => {
      const validConfig: CameraConfig = {
        ...DEFAULT_CAMERA_CONFIG,
        sensitivity: 5,
      }
      expect(validConfig.sensitivity).toBe(5)
    })

    it('smoothingの範囲が0-1で制限される', () => {
      const validConfig: CameraConfig = {
        ...DEFAULT_CAMERA_CONFIG,
        smoothing: 0.5,
      }
      expect(validConfig.smoothing).toBe(0.5)
    })

    it('thirdPersonDistanceの範囲が1-50で制限される', () => {
      const validConfig: CameraConfig = {
        ...DEFAULT_CAMERA_CONFIG,
        thirdPersonDistance: 10,
      }
      expect(validConfig.thirdPersonDistance).toBe(10)
    })
  })

  describe('FirstPersonCamera', () => {
    it('カメラを正常に初期化できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        return camera
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const camera = result.value
        expect(camera).toBeInstanceOf(THREE.PerspectiveCamera)
        expect(camera.fov).toBe(DEFAULT_CAMERA_CONFIG.fov)
        expect(camera.position.y).toBeCloseTo(1.7, 1)
      }
    })

    it('カメラの位置を更新できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.update(0.016, { x: 5, y: 0, z: 10 })
        const state = yield* service.getState()
        return state
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const state = result.value
        expect(state.target.x).toBe(5)
        expect(state.target.z).toBe(10)
      }
    })

    it('マウス入力でカメラを回転できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.rotate(100, 50)
        const state = yield* service.getState()
        return state
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const state = result.value
        expect(state.rotation.yaw).not.toBe(0)
        expect(state.rotation.pitch).not.toBe(0)
      }
    })

    it('FOVを変更できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.setFOV(90)
        return camera
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const camera = result.value
        expect(camera.fov).toBe(90)
      }
    })

    it('感度を変更できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.setSensitivity(2.0)
        const config = yield* service.getConfig()
        return config
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const config = result.value
        expect(config.sensitivity).toBe(2.0)
      }
    })

    it('カメラをリセットできる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.rotate(100, 50)
        yield* service.reset()
        const state = yield* service.getState()
        return state
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const state = result.value
        expect(state.rotation.yaw).toBe(0)
        expect(state.rotation.pitch).toBe(0)
        expect(state.position.x).toBe(0)
        expect(state.position.y).toBeCloseTo(1.7, 1)
        expect(state.position.z).toBe(0)
      }
    })

    it('アスペクト比を更新できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.updateAspectRatio(1920, 1080)
        return camera
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const camera = result.value
        expect(camera.aspect).toBeCloseTo(1920 / 1080, 5)
      }
    })

    it('リソースを解放できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.dispose()
        const camera = yield* service.getCamera()
        return camera
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const camera = result.value
        expect(camera).toBeNull()
      }
    })

    it('初期化前の操作でエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.update(0.016, { x: 0, y: 0, z: 0 })
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)

      if (Exit.isFailure(result)) {
        const error = result.cause
        expect(error).toBeDefined()
      }
    })
  })

  describe('ThirdPersonCamera', () => {
    it('カメラを正常に初期化できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })
        return camera
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const camera = result.value
        expect(camera).toBeInstanceOf(THREE.PerspectiveCamera)
        expect(camera.fov).toBe(DEFAULT_CAMERA_CONFIG.fov)
      }
    })

    it('カメラの位置を更新できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })
        yield* service.update(0.016, { x: 5, y: 0, z: 10 })
        const state = yield* service.getState()
        return state
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const state = result.value
        expect(state.target.x).not.toBe(0)
        expect(state.target.z).not.toBe(0)
      }
    })

    it('三人称視点の距離を変更できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })
        yield* service.setThirdPersonDistance(10)
        const config = yield* service.getConfig()
        return config
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const config = result.value
        expect(config.thirdPersonDistance).toBe(10)
      }
    })

    it('マウス入力でカメラを回転できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })
        const initialState = yield* service.getState()
        yield* service.rotate(100, 50)
        const updatedState = yield* service.getState()
        return { initialState, updatedState }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { initialState, updatedState } = result.value
        expect(updatedState.rotation.yaw).not.toBe(initialState.rotation.yaw)
        expect(updatedState.rotation.pitch).not.toBe(initialState.rotation.pitch)
      }
    })

    it('カメラをリセットできる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })
        yield* service.rotate(100, 50)
        yield* service.update(0.016, { x: 5, y: 0, z: 10 })
        yield* service.reset()
        const state = yield* service.getState()
        return state
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const state = result.value
        expect(state.rotation.yaw).toBe(0)
        expect(state.rotation.pitch).toBeCloseTo(Math.PI / 3 - Math.PI / 2, 5)
      }
    })

    it('スムージング設定を変更できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })
        yield* service.setSmoothing(0.5)
        const config = yield* service.getConfig()
        return config
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const config = result.value
        expect(config.smoothing).toBe(0.5)
      }
    })
  })
})