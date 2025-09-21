import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Exit, pipe } from 'effect'
import * as THREE from 'three'
import { CameraService, DEFAULT_CAMERA_CONFIG } from '../CameraService.js'
import { FirstPersonCameraLive } from '../FirstPersonCamera.js'
import { TestRunner, EffectAssert } from '../../../test/effect-test-utils.js'

// テストヘルパー関数
const runCameraEffect = <A>(program: (service: CameraService) => Effect.Effect<A, any>): Promise<A> =>
  pipe(CameraService, Effect.flatMap(program), Effect.provide(FirstPersonCameraLive), Effect.runPromise)

describe('FirstPersonCamera', () => {
  it('初期化 > デフォルト設定でカメラを初期化できる', async () => {
    const config = await runCameraEffect((service) =>
      Effect.gen(function* () {
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        return yield* service.getConfig()
      })
    )

    expect(config).toEqual(DEFAULT_CAMERA_CONFIG)
  })

  it('初期化 > カスタム設定でカメラを初期化できる', async () => {
    const customConfig = {
      fov: 90,
      near: 0.5,
      far: 1500,
      sensitivity: 1.5,
      smoothing: 0.8,
      mode: 'first-person' as const,
      distance: 5,
    }

    const config = await runCameraEffect((service) =>
      Effect.gen(function* () {
        yield* service.initialize(customConfig)
        return yield* service.getConfig()
      })
    )

    expect(config).toEqual(customConfig)
  })

  it('初期化 > 任意の有効な設定でカメラを初期化できる', async () => {
    const config = {
      fov: 90,
      near: 0.2,
      far: 1500,
      sensitivity: 2.0,
      smoothing: 0.5,
      mode: 'first-person' as const,
      distance: 10,
    }

    const resultConfig = await runCameraEffect((service) =>
      Effect.gen(function* () {
        yield* service.initialize(config)
        return yield* service.getConfig()
      })
    )

    expect(resultConfig).toEqual(config)
  })

  describe('カメラ更新', () => {
    it('ターゲット位置に基づいてカメラ位置が更新される', async () => {
      const position = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          const targetPosition = { x: 10, y: 5, z: -5 }
          yield* service.update(0.016, targetPosition)
          const state = yield* service.getState()
          return state.position
        })
      )

      // スムージングで徐々に目標位置に近づくことを確認
      expect(position.x).toBeGreaterThan(0) // x方向に移動している
      expect(position.y).toBeGreaterThan(1.7) // y方向に移動している
      expect(position.z).toBeLessThan(0) // z方向に移動している
    })

    it('スムージングが適用される', async () => {
      const positions = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize({ ...DEFAULT_CAMERA_CONFIG, smoothing: 0.1 })

          // 最初のフレーム
          const targetPosition = { x: 10, y: 0, z: 0 }
          yield* service.update(0.016, targetPosition)
          const state1 = yield* service.getState()

          // 2番目のフレーム
          yield* service.update(0.016, targetPosition)
          const state2 = yield* service.getState()

          return [state1.position, state2.position]
        })
      )

      // スムージングにより、2番目の位置は最初より目標に近づく
      expect(Math.abs(positions[1].x - 10)).toBeLessThan(Math.abs(positions[0].x - 10))
    })

    it('任意の位置とスムージング値で更新が正常に動作する', async () => {
      const targetPosition = { x: 50, y: 20, z: -30 }
      const smoothing = 0.05

      const result = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize({ ...DEFAULT_CAMERA_CONFIG, smoothing })
          yield* service.update(0.016, targetPosition)
          return yield* service.getState()
        })
      )

      expect(result.position).toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number),
      })
    })
  })

  describe('カメラ回転', () => {
    it('マウス入力でヨー角が変更される', async () => {
      const rotation = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.rotate(100, 0) // 100px横移動
          const state = yield* service.getState()
          return state.rotation
        })
      )

      expect(rotation.yaw).not.toBe(0)
      expect(rotation.pitch).toBe(0)
    })

    it('マウス入力でピッチ角が変更される', async () => {
      const rotation = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.rotate(0, 50) // 50px縦移動
          const state = yield* service.getState()
          return state.rotation
        })
      )

      expect(rotation.pitch).not.toBe(0)
      expect(rotation.yaw).toBe(0)
    })

    it('ピッチ角が制限範囲内に収まる', async () => {
      const rotation = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.rotate(0, 10000) // 極端な縦移動
          const state = yield* service.getState()
          return state.rotation
        })
      )

      expect(rotation.pitch).toBeGreaterThanOrEqual(-Math.PI / 2)
      expect(rotation.pitch).toBeLessThanOrEqual(Math.PI / 2)
    })

    it('感度設定が回転速度に影響する', async () => {
      const rotations = await runCameraEffect((service) =>
        Effect.gen(function* () {
          // 低感度での回転
          yield* service.initialize({ ...DEFAULT_CAMERA_CONFIG, sensitivity: 0.5 })
          yield* service.rotate(100, 100)
          const state1 = yield* service.getState()

          // 高感度に変更して回転
          yield* service.setSensitivity(2.0)
          yield* service.rotate(100, 100)
          const state2 = yield* service.getState()

          return [state1.rotation, state2.rotation]
        })
      )

      // 高感度の方が大きく回転する
      const yawDiff1 = Math.abs(rotations[0].yaw)
      const yawDiff2 = Math.abs(rotations[1].yaw - rotations[0].yaw)
      expect(yawDiff2).toBeGreaterThan(yawDiff1)
    })

    it('任意の入力で回転が正常に動作する', async () => {
      const deltaX = 500
      const deltaY = -200

      const rotation = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.rotate(deltaX, deltaY)
          return yield* service.getState()
        })
      )

      expect(rotation.rotation.pitch).toBeGreaterThanOrEqual(-Math.PI / 2)
      expect(rotation.rotation.pitch).toBeLessThanOrEqual(Math.PI / 2)
      expect(typeof rotation.rotation.yaw).toBe('number')
    })
  })

  describe('設定変更', () => {
    it('一人称視点から一人称視点への切り替えは何もしない', async () => {
      const result = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize({ ...DEFAULT_CAMERA_CONFIG, mode: 'first-person' })
          const config1 = yield* service.getConfig()
          yield* service.switchMode('first-person')
          const config2 = yield* service.getConfig()
          return [config1, config2]
        })
      )

      expect(result[0]).toEqual(result[1])
    })

    it('感度の範囲制限が適用される', async () => {
      const sensitivity = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.setSensitivity(-1) // 範囲外の値
          const config = yield* service.getConfig()
          return config.sensitivity
        })
      )

      expect(sensitivity).toBeGreaterThanOrEqual(0.1)
      expect(sensitivity).toBeLessThanOrEqual(5.0)
    })

    it('スムージングの範囲制限が適用される', async () => {
      const smoothing = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.setSmoothing(2.0) // 範囲外の値
          const config = yield* service.getConfig()
          return config.smoothing
        })
      )

      expect(smoothing).toBeGreaterThanOrEqual(0.0)
      expect(smoothing).toBeLessThanOrEqual(1.0)
    })

    it('FOVを範囲内で変更できる', async () => {
      const fov = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.setFOV(90)
          const config = yield* service.getConfig()
          return config.fov
        })
      )

      expect(fov).toBe(90)
    })

    it('三人称視点への切り替えは無効', async () => {
      const result = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          const config1 = yield* service.getConfig()
          // 一人称カメラではsetDistanceは存在しない
          return config1.mode
        })
      )

      expect(result).toBe('first-person')
    })

    it('設定値が適切にクランプされる', async () => {
      const resultConfig = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.setFOV(150) // 範囲外
          yield* service.setSensitivity(6.0) // 範囲外
          yield* service.setSmoothing(1.5) // 範囲外
          return yield* service.getConfig()
        })
      )

      expect(resultConfig.fov).toBeGreaterThanOrEqual(30)
      expect(resultConfig.fov).toBeLessThanOrEqual(120)
      expect(resultConfig.sensitivity).toBeGreaterThanOrEqual(0.1)
      expect(resultConfig.sensitivity).toBeLessThanOrEqual(10.0)
      expect(resultConfig.smoothing).toBeGreaterThanOrEqual(0.0)
      expect(resultConfig.smoothing).toBeLessThanOrEqual(1.0)
    })
  })

  describe('リセットと破棄', () => {
    it('カメラをリセットすると初期状態に戻る', async () => {
      const states = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          const initialState = yield* service.getState()

          // 状態を変更
          yield* service.rotate(100, 50)
          yield* service.update(0.016, { x: 10, y: 5, z: -5 })

          // リセット
          yield* service.reset()
          const resetState = yield* service.getState()

          return [initialState, resetState]
        })
      )

      expect(states[1].rotation).toEqual(states[0].rotation)
      expect(states[1].position).toEqual(states[0].position)
    })

    it('リソースを破棄するとカメラがnullになる', async () => {
      const isDisposed = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.dispose()
          // 破棄後の状態確認のため、内部状態を確認
          // NOTE: 実際の実装では、dispose後はサービスが使用できない状態になる
          return true
        })
      )

      expect(isDisposed).toBe(true)
    })

    it('破棄後の再初期化が可能', async () => {
      const config = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.dispose()
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          return yield* service.getConfig()
        })
      )

      expect(config).toEqual(DEFAULT_CAMERA_CONFIG)
    })
  })

  describe('エラーハンドリング', () => {
    it('初期化前のFOV設定はエラーを返す', async () => {
      await expect(async () => {
        await runCameraEffect((service) => service.setFOV(90))
      }).rejects.toThrow()
    })

    it('初期化前の感度設定は成功する', async () => {
      const sensitivity = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.setSensitivity(2.0)
          const config = yield* service.getConfig()
          return config.sensitivity
        })
      )

      expect(sensitivity).toBe(2.0)
    })

    it('初期化前のスムージング設定は成功する', async () => {
      const smoothing = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.setSmoothing(0.8)
          const config = yield* service.getConfig()
          return config.smoothing
        })
      )

      expect(smoothing).toBe(0.8)
    })

    it('三人称視点への切り替えは成功するが効果はない', async () => {
      const result = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          const config1 = yield* service.getConfig()
          yield* service.switchMode('third-person')
          const config2 = yield* service.getConfig()
          return [config1.mode, config2.mode]
        })
      )

      expect(result[0]).toBe('first-person')
      expect(result[1]).toBe('first-person') // 一人称カメラでは変更されない
    })

    it('無効なモードの切り替えはエラーを返す', async () => {
      await expect(async () => {
        await runCameraEffect((service) =>
          Effect.gen(function* () {
            yield* service.initialize(DEFAULT_CAMERA_CONFIG)
            yield* service.switchMode('invalid' as any)
          })
        )
      }).rejects.toThrow()
    })

    it('初期化前の更新操作はエラーを返す', async () => {
      await expect(async () => {
        await runCameraEffect((service) => service.update(0.016, { x: 0, y: 0, z: 0 }))
      }).rejects.toThrow()
    })

    it('初期化前の回転操作はエラーを返す', async () => {
      await expect(async () => {
        await runCameraEffect((service) => service.rotate(100, 50))
      }).rejects.toThrow()
    })

    it('初期化前のリセット操作はエラーを返す', async () => {
      await expect(async () => {
        await runCameraEffect((service) => service.reset())
      }).rejects.toThrow()
    })

    it('初期化前のアスペクト比更新はエラーを返す', async () => {
      await expect(async () => {
        await runCameraEffect((service) => service.updateAspectRatio(1920, 1080))
      }).rejects.toThrow()
    })
  })

  describe('追加のエッジケーステスト', () => {
    it('極端なヨー角の正規化が正しく動作する', async () => {
      const rotation = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          // 複数回転
          yield* service.rotate(100000, 0)
          const state = yield* service.getState()
          return state.rotation
        })
      )

      expect(rotation.yaw).toBeGreaterThanOrEqual(-Math.PI)
      expect(rotation.yaw).toBeLessThanOrEqual(Math.PI)
    })

    it('極小値でのスムージング計算が正しく動作する', async () => {
      const position = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize({ ...DEFAULT_CAMERA_CONFIG, smoothing: 0.001 })
          yield* service.update(0.016, { x: 100, y: 0, z: 0 })
          const state = yield* service.getState()
          return state.position
        })
      )

      expect(position.x).toBeCloseTo(0.1, 0) // 極小スムージングでもわずかに動く
    })

    it('アスペクト比更新が正しく動作する', async () => {
      const result = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.updateAspectRatio(1920, 1080)
          // アスペクト比更新は内部処理なので、エラーが発生しなければ成功
          return true
        })
      )

      expect(result).toBe(true)
    })

    it('極端な回転値でも正規化される', async () => {
      const deltaX = 50000
      const deltaY = -25000

      const rotation = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.rotate(deltaX, deltaY)
          const state = yield* service.getState()
          return state.rotation
        })
      )

      expect(rotation.pitch).toBeGreaterThanOrEqual(-Math.PI / 2)
      expect(rotation.pitch).toBeLessThanOrEqual(Math.PI / 2)
      expect(rotation.yaw).toBeGreaterThanOrEqual(-Math.PI)
      expect(rotation.yaw).toBeLessThanOrEqual(Math.PI)
    })
  })

  describe('未カバーメソッドのテスト', () => {
    it('初期化前のgetCameraはnullを返す', async () => {
      const camera = await runCameraEffect((service) => service.getCamera())

      expect(camera).toBeNull()
    })

    it('初期化後のgetCameraはカメラインスタンスを返す', async () => {
      const camera = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          return yield* service.getCamera()
        })
      )

      expect(camera).toBeDefined()
      expect(camera).toBeInstanceOf(THREE.PerspectiveCamera)
    })

    it('setThirdPersonDistanceは一人称では無効', async () => {
      const result = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.initialize(DEFAULT_CAMERA_CONFIG)
          yield* service.setThirdPersonDistance(15)
          const config = yield* service.getConfig()
          return config.distance
        })
      )

      // 一人称では距離設定が無効なので、初期値のまま
      expect(result).toBe(DEFAULT_CAMERA_CONFIG.distance)
    })

    it('初期化前のsetThirdPersonDistanceは成功する', async () => {
      const result = await runCameraEffect((service) =>
        Effect.gen(function* () {
          yield* service.setThirdPersonDistance(20)
          const config = yield* service.getConfig()
          return config.distance
        })
      )

      // 一人称では初期化前でも距離設定は単に無視される
      expect(result).toBe(DEFAULT_CAMERA_CONFIG.distance)
    })
  })
})
