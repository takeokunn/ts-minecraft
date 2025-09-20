import { describe, it, expect } from 'vitest'
import { Effect, Exit } from 'effect'
import * as THREE from 'three'
import { CameraService, DEFAULT_CAMERA_CONFIG } from '../CameraService.js'
import { ThirdPersonCameraLive } from '../ThirdPersonCamera.js'

describe('ThirdPersonCamera', () => {
  describe('初期化', () => {
    it('デフォルト設定でカメラを初期化できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const config = {
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        }
        const camera = yield* service.initialize(config)
        const state = yield* service.getState()
        return { camera, state }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { camera, state } = result.value
        expect(camera).toBeInstanceOf(THREE.PerspectiveCamera)
        expect(camera.fov).toBe(75)
        expect(camera.near).toBe(0.1)
        expect(camera.far).toBe(1000)
        // 三人称視点は離れた位置から開始
        const distance = Math.sqrt(
          state.position.x * state.position.x +
          state.position.z * state.position.z
        )
        expect(distance).toBeGreaterThan(0) // 原点から離れている
        expect(state.position.y).toBeGreaterThan(0)
      }
    })

    it('カスタム距離と高さで初期化できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const config = {
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
          thirdPersonDistance: 10,
          thirdPersonHeight: 5,
        }
        const camera = yield* service.initialize(config)
        const state = yield* service.getState()
        return { camera, state }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { state } = result.value
        // ターゲットの高さが反映される
        expect(state.target.y).toBe(5)
      }
    })
  })

  describe('カメラ更新', () => {
    it('ターゲット位置を追跡する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        // カメラ更新
        yield* service.update(0.016, { x: 10, y: 0, z: 20 })
        const state = yield* service.getState()

        return state
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const state = result.value
        // ターゲット位置が更新される
        expect(state.target.x).not.toBe(0)
        expect(state.target.z).not.toBe(0)
      }
    })

    it('スムージングが適用される', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
          smoothing: 0.1, // 強いスムージング
        })

        // 複数フレームで徐々に位置が更新される
        const positions: Array<{ x: number; y: number; z: number }> = []
        for (let i = 0; i < 10; i++) {
          yield* service.update(0.016, { x: 50, y: 0, z: 50 })
          const state = yield* service.getState()
          positions.push(state.target)
        }

        return positions
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const positions = result.value
        // 徐々に目標位置に近づいていることを確認
        for (let i = 1; i < positions.length; i++) {
          const prevDist = Math.sqrt(Math.pow(50 - positions[i - 1].x, 2) + Math.pow(50 - positions[i - 1].z, 2))
          const currDist = Math.sqrt(Math.pow(50 - positions[i].x, 2) + Math.pow(50 - positions[i].z, 2))
          expect(currDist).toBeLessThanOrEqual(prevDist + 0.01) // 浮動小数点の誤差を考慮
        }
      }
    })

    it('カメラがターゲットを見続ける', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        const camera = yield* service.getCamera()
        const initialLookAt = camera ? new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion) : null

        // ターゲットを移動
        yield* service.update(0.016, { x: 30, y: 0, z: 30 })

        const updatedCamera = yield* service.getCamera()
        const updatedLookAt = updatedCamera
          ? new THREE.Vector3(0, 0, -1).applyQuaternion(updatedCamera.quaternion)
          : null

        return { initialLookAt, updatedLookAt }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { initialLookAt, updatedLookAt } = result.value
        expect(initialLookAt).not.toBeNull()
        expect(updatedLookAt).not.toBeNull()
        // 視線方向が変化していることを確認
        if (initialLookAt && updatedLookAt) {
          expect(initialLookAt.x).not.toBeCloseTo(updatedLookAt.x, 2)
        }
      }
    })
  })

  describe('カメラ回転', () => {
    it('水平回転（ヨー）でカメラが円周上を移動する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        const initialState = yield* service.getState()
        yield* service.rotate(200, 0) // 水平方向のみ
        const rotatedState = yield* service.getState()

        return { initialState, rotatedState }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { initialState, rotatedState } = result.value
        expect(rotatedState.rotation.yaw).not.toBe(initialState.rotation.yaw)
        // 水平回転ではピッチは変更されない
        expect(rotatedState.rotation.pitch).toBe(initialState.rotation.pitch)
      }
    })

    it('垂直回転（ピッチ）でカメラが上下に移動する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        const initialState = yield* service.getState()
        yield* service.rotate(0, 100) // 垂直方向のみ
        const rotatedState = yield* service.getState()

        return { initialState, rotatedState }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { initialState, rotatedState } = result.value
        expect(rotatedState.rotation.yaw).toBe(initialState.rotation.yaw)
        expect(rotatedState.rotation.pitch).not.toBe(initialState.rotation.pitch)
      }
    })

    it('垂直回転が制限範囲内に収まる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        // 上限を超えて回転
        yield* service.rotate(0, -10000)
        const topState = yield* service.getState()

        // リセット
        yield* service.reset()

        // 下限を超えて回転
        yield* service.rotate(0, 10000)
        const bottomState = yield* service.getState()

        return { topState, bottomState }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { topState, bottomState } = result.value
        // φ (phi) は 0.1 から π-0.1 の範囲内
        // pitchは φ - π/2 で計算される
        expect(topState.rotation.pitch).toBeGreaterThan(-Math.PI / 2 - 0.1)
        expect(bottomState.rotation.pitch).toBeLessThan(Math.PI / 2 + 0.1)
      }
    })

    it('感度設定が回転速度に影響する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        // デフォルト感度
        yield* service.rotate(100, 0)
        const defaultRotation = yield* service.getState()

        // リセットして高感度に設定
        yield* service.reset()
        yield* service.setSensitivity(3.0)
        yield* service.rotate(100, 0)
        const highSensitivityRotation = yield* service.getState()

        return { defaultRotation, highSensitivityRotation }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

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
    it('三人称視点の距離を変更できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        yield* service.setThirdPersonDistance(15)
        const config = yield* service.getConfig()

        return config.thirdPersonDistance
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        expect(result.value).toBe(15)
      }
    })

    it('距離が範囲内に制限される', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        yield* service.setThirdPersonDistance(0) // 最小値以下
        const minDistance = yield* service.getConfig()

        yield* service.setThirdPersonDistance(100) // 最大値以上
        const maxDistance = yield* service.getConfig()

        return { minDistance: minDistance.thirdPersonDistance, maxDistance: maxDistance.thirdPersonDistance }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { minDistance, maxDistance } = result.value
        expect(minDistance).toBe(1)
        expect(maxDistance).toBe(50)
      }
    })

    it('FOVを変更できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        yield* service.setFOV(60)
        return camera.fov
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        expect(result.value).toBe(60)
      }
    })

    it('スムージング値を変更できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        yield* service.setSmoothing(0.3)
        const config = yield* service.getConfig()

        return config.smoothing
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        expect(result.value).toBe(0.3)
      }
    })
  })

  describe('リセットと破棄', () => {
    it('カメラをリセットすると初期状態に戻る', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        // 状態を変更
        yield* service.rotate(200, 100)
        yield* service.update(0.016, { x: 50, y: 10, z: 30 })
        yield* service.setThirdPersonDistance(20)

        // リセット
        yield* service.reset()

        const state = yield* service.getState()
        const config = yield* service.getConfig()

        return { state, config }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { state } = result.value
        expect(state.rotation.yaw).toBe(0) // デフォルトのthirdPersonAngleが0
        expect(state.rotation.pitch).toBeCloseTo(Math.PI / 3 - Math.PI / 2, 5) // phiが60度の初期値
      }
    })

    it('リソースを破棄するとカメラがnullになる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        const beforeDispose = yield* service.getCamera()
        yield* service.dispose()
        const afterDispose = yield* service.getCamera()

        return { beforeDispose, afterDispose }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { beforeDispose, afterDispose } = result.value
        expect(beforeDispose).toBeInstanceOf(THREE.PerspectiveCamera)
        expect(afterDispose).toBeNull()
      }
    })

    it('破棄後も設定は初期値に戻る', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
          thirdPersonDistance: 20,
        })

        yield* service.dispose()
        const config = yield* service.getConfig()

        return config
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const config = result.value
        expect(config.mode).toBe('third-person')
        expect(config.thirdPersonDistance).toBe(DEFAULT_CAMERA_CONFIG.thirdPersonDistance)
      }
    })
  })

  describe('エラーハンドリング', () => {
    it('初期化前の更新操作はエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.update(0.016, { x: 0, y: 0, z: 0 })
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('初期化前の回転操作はエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.rotate(100, 50)
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('初期化前のリセット操作はエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.reset()
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('初期化前のFOV設定はエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.setFOV(90)
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('無効なカメラモードの切り替えはエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })
        yield* service.switchMode('invalid' as any)
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })
  })

  describe('アスペクト比更新', () => {
    it('アスペクト比を正しく更新できる', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person' as const,
        })

        yield* service.updateAspectRatio(1920, 1080)
        const wideAspect = camera.aspect

        yield* service.updateAspectRatio(1080, 1920)
        const tallAspect = camera.aspect

        return { wideAspect, tallAspect }
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isSuccess(result)).toBe(true)

      if (Exit.isSuccess(result)) {
        const { wideAspect, tallAspect } = result.value
        expect(wideAspect).toBeCloseTo(1920 / 1080, 5)
        expect(tallAspect).toBeCloseTo(1080 / 1920, 5)
      }
    })

    it('初期化前のアスペクト比更新はエラーを返す', async () => {
      const program = Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.updateAspectRatio(1920, 1080)
      }).pipe(Effect.provide(ThirdPersonCameraLive))

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
    })
  })
})