import { describe, it, expect } from 'vitest'
import { Effect, Exit } from 'effect'
import * as THREE from 'three'
import { CameraService, DEFAULT_CAMERA_CONFIG } from '../CameraService.js'
import { FirstPersonCameraLive } from '../FirstPersonCamera.js'

describe('FirstPersonCamera', () => {
  describe('初期化', () => {
    it('デフォルト設定でカメラを初期化できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        const state = yield* service.getState()
        return { camera, state }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { camera, state } = result.value
        expect(camera).toBeInstanceOf(THREE.PerspectiveCamera)
        expect(camera.fov).toBe(75)
        expect(camera.near).toBe(0.1)
        expect(camera.far).toBe(1000)
        expect(camera.position.y).toBeCloseTo(1.7, 1)
        expect(state.position.y).toBeCloseTo(1.7, 1)
      }
    })

    it('カスタム設定でカメラを初期化できる', async () => {
      const customConfig = {
        ...DEFAULT_CAMERA_CONFIG,
        fov: 90,
        near: 0.5,
        far: 2000,
      }

      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize(customConfig)
        return camera
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const camera = result.value
        expect(camera.fov).toBe(90)
        expect(camera.near).toBe(0.5)
        expect(camera.far).toBe(2000)
      }
    })
  })

  describe('カメラ更新', () => {
    it('ターゲット位置に基づいてカメラ位置が更新される', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        // 初期状態
        const initialState = yield* service.getState()

        // カメラ更新
        yield* service.update(0.016, { x: 10, y: 0, z: 20 })
        const updatedState = yield* service.getState()

        return { initialState, updatedState }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { initialState, updatedState } = result.value
        expect(updatedState.target.x).toBe(10)
        expect(updatedState.target.z).toBe(20)
        expect(updatedState.target.y).toBeCloseTo(1.7, 1)
        expect(updatedState.position).not.toEqual(initialState.position)
      }
    })

    it('スムージングが適用される', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          smoothing: 0.5,
        })

        // 複数フレームで徐々に位置が更新される
        const positions: Array<{ x: number; y: number; z: number }> = []
        for (let i = 0; i < 5; i++) {
          yield* service.update(0.016, { x: 100, y: 0, z: 100 })
          const state = yield* service.getState()
          positions.push(state.position)
        }

        return positions
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const positions = result.value
        // 徐々に目標位置に近づいていることを確認
        for (let i = 1; i < positions.length; i++) {
          const prev = positions[i - 1]
          const curr = positions[i]
          expect(prev).toBeDefined()
          expect(curr).toBeDefined()
          if (prev && curr) {
            const prevDist = Math.sqrt(
              Math.pow(100 - prev.x, 2) + Math.pow(100 - prev.z, 2)
            )
            const currDist = Math.sqrt(Math.pow(100 - curr.x, 2) + Math.pow(100 - curr.z, 2))
            expect(currDist).toBeLessThanOrEqual(prevDist)
          }
        }
      }
    })
  })

  describe('カメラ回転', () => {
    it('マウス入力でヨー角が変更される', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const initialState = yield* service.getState()
        yield* service.rotate(100, 0) // X軸方向のみ
        const rotatedState = yield* service.getState()

        return { initialState, rotatedState }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { initialState, rotatedState } = result.value
        expect(rotatedState.rotation.yaw).not.toBe(initialState.rotation.yaw)
        expect(rotatedState.rotation.pitch).toBe(initialState.rotation.pitch)
      }
    })

    it('マウス入力でピッチ角が変更される', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const initialState = yield* service.getState()
        yield* service.rotate(0, 50) // Y軸方向のみ
        const rotatedState = yield* service.getState()

        return { initialState, rotatedState }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { initialState, rotatedState } = result.value
        expect(rotatedState.rotation.yaw).toBe(initialState.rotation.yaw)
        expect(rotatedState.rotation.pitch).not.toBe(initialState.rotation.pitch)
      }
    })

    it('ピッチ角が制限範囲内に収まる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        // 上方向に大きく回転（Y軸負の方向 => pitchは正になる）
        yield* service.rotate(0, -10000)
        const upState = yield* service.getState()

        // リセット
        yield* service.reset()

        // 下方向に大きく回転（Y軸正の方向 => pitchは負になる）
        yield* service.rotate(0, 10000)
        const downState = yield* service.getState()

        return { upState, downState }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { upState, downState } = result.value
        // -π/2 から π/2 の範囲内
        // 実装: pitchDelta = -deltaY * sensitivity なので
        // deltaYが負(-10000) => pitchは正（上向き）
        // deltaYが正(10000) => pitchは負（下向き）
        expect(upState.rotation.pitch).toBeGreaterThan(0)
        expect(upState.rotation.pitch).toBeLessThanOrEqual(Math.PI / 2)
        expect(downState.rotation.pitch).toBeLessThan(0)
        expect(downState.rotation.pitch).toBeGreaterThanOrEqual(-Math.PI / 2)
      }
    })

    it('感度設定が回転速度に影響する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        // デフォルト感度での回転
        yield* service.rotate(100, 0)
        const defaultRotation = yield* service.getState()

        // リセットして感度を上げる
        yield* service.reset()
        yield* service.setSensitivity(2.0)
        yield* service.rotate(100, 0)
        const highSensitivityRotation = yield* service.getState()

        return { defaultRotation, highSensitivityRotation }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { defaultRotation, highSensitivityRotation } = result.value
        expect(Math.abs(highSensitivityRotation.rotation.yaw)).toBeGreaterThan(
          Math.abs(defaultRotation.rotation.yaw)
        )
      }
    })
  })

  describe('設定変更', () => {
    it('一人称視点から一人称視点への切り替えは何もしない', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        const beforeConfig = yield* service.getConfig()
        yield* service.switchMode('first-person')
        const afterConfig = yield* service.getConfig()
        return { beforeConfig, afterConfig }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value.afterConfig.mode).toBe('first-person')
        expect(result.value.beforeConfig.mode).toBe('first-person')
      }
    })

    it('感度の最小値設定', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.setSensitivity(0)
        const config = yield* service.getConfig()
        return config.sensitivity
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toBe(0.1)
      }
    })

    it('感度の最大値設定', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.setSensitivity(100)
        const config = yield* service.getConfig()
        return config.sensitivity
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toBe(10)
      }
    })

    it('スムージングの最小値設定', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.setSmoothing(-1)
        const config = yield* service.getConfig()
        return config.smoothing
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toBe(0)
      }
    })

    it('スムージングの最大値設定', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.setSmoothing(2)
        const config = yield* service.getConfig()
        return config.smoothing
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toBe(1)
      }
    })

    it('FOVを範囲内で変更できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        yield* service.setFOV(30)
        const minFov = camera.fov

        yield* service.setFOV(120)
        const maxFov = camera.fov

        yield* service.setFOV(150) // 範囲外
        const clampedFov = camera.fov

        return { minFov, maxFov, clampedFov }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { minFov, maxFov, clampedFov } = result.value
        expect(minFov).toBe(30)
        expect(maxFov).toBe(120)
        expect(clampedFov).toBe(120)
      }
    })

    it('スムージング値を変更できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        yield* service.setSmoothing(0.8)
        const config = yield* service.getConfig()

        return config.smoothing
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        expect(result.value).toBe(0.8)
      }
    })

    it('三人称視点の距離設定は無視される', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const beforeConfig = yield* service.getConfig()
        yield* service.setThirdPersonDistance(10)
        const afterConfig = yield* service.getConfig()

        return { beforeConfig, afterConfig }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { beforeConfig, afterConfig } = result.value
        // 一人称視点では変更されない
        expect(afterConfig.thirdPersonDistance).toBe(beforeConfig.thirdPersonDistance)
      }
    })
  })

  describe('リセットと破棄', () => {
    it('カメラをリセットすると初期状態に戻る', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        // 状態を変更
        yield* service.rotate(100, 50)
        yield* service.update(0.016, { x: 50, y: 10, z: 30 })
        yield* service.setFOV(90)

        // リセット
        yield* service.reset()

        const state = yield* service.getState()
        const camera = yield* service.getCamera()

        return { state, camera }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { state, camera } = result.value
        expect(state.rotation.yaw).toBe(0)
        expect(state.rotation.pitch).toBe(0)
        expect(state.position.x).toBe(0)
        expect(state.position.y).toBeCloseTo(1.7, 1)
        expect(state.position.z).toBe(0)
        // FOVは保持される
        expect(camera?.fov).toBe(90)
      }
    })

    it('リソースを破棄するとカメラがnullになる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const beforeDispose = yield* service.getCamera()
        yield* service.dispose()
        const afterDispose = yield* service.getCamera()

        return { beforeDispose, afterDispose }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { beforeDispose, afterDispose } = result.value
        expect(beforeDispose).toBeInstanceOf(THREE.PerspectiveCamera)
        expect(afterDispose).toBeNull()
      }
    })
  })

  describe('エラーハンドリング', () => {
    it('初期化前のFOV設定はエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.setFOV(90)
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('初期化前の感度設定は成功する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.setSensitivity(2.0)
        const config = yield* service.getConfig()
        return config.sensitivity
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toBe(2.0)
      }
    })

    it('初期化前のスムージング設定は成功する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.setSmoothing(0.5)
        const config = yield* service.getConfig()
        return config.smoothing
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toBe(0.5)
      }
    })

    it('三人称視点への切り替えはモードを変更しない', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const beforeConfig = yield* service.getConfig()
        yield* service.switchMode('third-person')
        const afterConfig = yield* service.getConfig()
        return { beforeConfig, afterConfig }
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        // FirstPersonCameraLive は三人称モードへの切り替えを行わない
        expect(result.value.beforeConfig.mode).toBe('first-person')
        expect(result.value.afterConfig.mode).toBe('first-person')
      }
    })

    it('無効なモードの切り替えはエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        yield* service.switchMode('invalid' as any)
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('初期化前の更新操作はエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.update(0.016, { x: 0, y: 0, z: 0 })
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('初期化前の回転操作はエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.rotate(100, 50)
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('初期化前のリセット操作はエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.reset()
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('初期化前のアスペクト比更新はエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.updateAspectRatio(1920, 1080)
      }).pipe(Effect.provide(FirstPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })
  })
})