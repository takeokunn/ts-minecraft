import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { it as effectIt } from '@effect/vitest'
import { ThirdPersonCamera, ThirdPersonCameraTest, TargetState, defaultThirdPersonConfig } from './ThirdPersonCamera'
import { CameraServiceTest } from './CameraService'

describe('ThirdPersonCamera', () => {
  const testLayer = Layer.mergeAll(CameraServiceTest, ThirdPersonCameraTest)

  const defaultTarget: TargetState = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    isMoving: false,
  }

  describe('updateFromTarget', () => {
    effectIt.effect('ターゲットの後方にカメラを配置する', () =>
      Effect.gen(function* () {
        const camera = yield* ThirdPersonCamera
        const config = yield* camera.getConfig()

        const state = yield* camera.updateFromTarget(
          {
            ...defaultTarget,
            position: { x: 10, y: 5, z: -3 },
          },
          0.016
        )

        expect(state.mode).toBe('third-person')
        // カメラはターゲットから離れた位置にあることを確認
        // rotation.yaw = 0, pitch = -20の場合、主にZ軸方向に離れる
        const dx = state.position.x - 10
        const dy = state.position.y - 5
        const dz = state.position.z - -3
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        expect(distance).toBeGreaterThan(1) // 最低でも1ユニット以上離れている
      }).pipe(Effect.provide(testLayer))
    )

    effectIt.effect('カメラ距離を維持する', () =>
      Effect.gen(function* () {
        const camera = yield* ThirdPersonCamera
        const config = yield* camera.getConfig()

        const state = yield* camera.updateFromTarget(defaultTarget, 0.016)

        // カメラとターゲットの距離を計算
        const dx = state.position.x - defaultTarget.position.x
        const dy = state.position.y - (defaultTarget.position.y + config.heightOffset)
        const dz = state.position.z - defaultTarget.position.z
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

        // 距離が設定値に近いことを確認（誤差許容）
        expect(distance).toBeCloseTo(config.defaultDistance, 1)
      }).pipe(Effect.provide(testLayer))
    )
  })

  describe('handleMouseInput', () => {
    effectIt.effect('マウス入力でカメラを回転させる', () =>
      Effect.gen(function* () {
        const camera = yield* ThirdPersonCamera
        const config = yield* camera.getConfig()

        // 初期状態
        const initialState = yield* camera.updateFromTarget(defaultTarget, 0.016)

        // マウス移動
        yield* camera.handleMouseInput(90, 45)

        // 回転後の状態
        const rotatedState = yield* camera.updateFromTarget(defaultTarget, 0.016)

        // 位置が変わることを確認（カメラが回転した）
        expect(rotatedState.position.x).not.toBeCloseTo(initialState.position.x, 2)
      }).pipe(Effect.provide(testLayer))
    )

    effectIt.effect('ピッチを-80〜80度に制限する', () =>
      Effect.gen(function* () {
        const camera = yield* ThirdPersonCamera

        // 大きな上向き入力
        yield* camera.handleMouseInput(0, 2000)
        const state1 = yield* camera.updateFromTarget(defaultTarget, 0.016)

        // 大きな下向き入力
        yield* camera.handleMouseInput(0, -2000)
        const state2 = yield* camera.updateFromTarget(defaultTarget, 0.016)

        // どちらも範囲内に収まることを確認
        expect(state1.rotation.pitch).toBeLessThanOrEqual(80)
        expect(state1.rotation.pitch).toBeGreaterThanOrEqual(-80)
        expect(state2.rotation.pitch).toBeLessThanOrEqual(80)
        expect(state2.rotation.pitch).toBeGreaterThanOrEqual(-80)
      }).pipe(Effect.provide(testLayer))
    )
  })

  describe('handleZoom', () => {
    effectIt.effect('ズームイン/アウトでカメラ距離を変更する', () =>
      Effect.gen(function* () {
        const camera = yield* ThirdPersonCamera
        const config = yield* camera.getConfig()

        const initialState = yield* camera.updateFromTarget(defaultTarget, 0.016)

        // ズームイン
        yield* camera.handleZoom(2)
        const zoomedInState = yield* camera.updateFromTarget(defaultTarget, 0.016)

        // ズームアウト
        yield* camera.handleZoom(-4)
        const zoomedOutState = yield* camera.updateFromTarget(defaultTarget, 0.016)

        // 距離が変わることを確認
        expect(zoomedInState.distance).toBeLessThan(initialState.distance)
        expect(zoomedOutState.distance).toBeGreaterThan(zoomedInState.distance)
      }).pipe(Effect.provide(testLayer))
    )

    effectIt.effect('ズーム距離を制限内に保つ', () =>
      Effect.gen(function* () {
        const camera = yield* ThirdPersonCamera
        const config = yield* camera.getConfig()

        // 最大までズームアウト
        yield* camera.handleZoom(-100)
        const maxState = yield* camera.updateFromTarget(defaultTarget, 0.016)
        expect(maxState.distance).toBeLessThanOrEqual(config.maxDistance)

        // 最小までズームイン
        yield* camera.handleZoom(100)
        const minState = yield* camera.updateFromTarget(defaultTarget, 0.016)
        expect(minState.distance).toBeGreaterThanOrEqual(config.minDistance)
      }).pipe(Effect.provide(testLayer))
    )

    effectIt.effect('ズーム無効時は距離が変わらない', () =>
      Effect.gen(function* () {
        const camera = yield* ThirdPersonCamera

        // ズームを無効化
        yield* camera.setConfig({ allowZoom: false })

        const beforeState = yield* camera.updateFromTarget(defaultTarget, 0.016)
        yield* camera.handleZoom(5)
        const afterState = yield* camera.updateFromTarget(defaultTarget, 0.016)

        expect(afterState.distance).toBe(beforeState.distance)
      }).pipe(Effect.provide(testLayer))
    )
  })

  describe('checkCollision', () => {
    effectIt.effect('衝突チェックを実行できる', () =>
      Effect.gen(function* () {
        const camera = yield* ThirdPersonCamera

        const collision = yield* camera.checkCollision({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 10 })

        expect(collision.hasCollision).toBe(false) // テスト実装では常にfalse
        expect(collision.adjustedDistance).toBeDefined()
      }).pipe(Effect.provide(testLayer))
    )
  })

  describe('config', () => {
    effectIt.effect('設定を取得できる', () =>
      Effect.gen(function* () {
        const camera = yield* ThirdPersonCamera
        const config = yield* camera.getConfig()

        expect(config.minDistance).toBe(defaultThirdPersonConfig.minDistance)
        expect(config.maxDistance).toBe(defaultThirdPersonConfig.maxDistance)
        expect(config.defaultDistance).toBe(defaultThirdPersonConfig.defaultDistance)
      }).pipe(Effect.provide(testLayer))
    )

    effectIt.effect('設定を更新できる', () =>
      Effect.gen(function* () {
        const camera = yield* ThirdPersonCamera

        yield* camera.setConfig({
          mouseSensitivity: 1.5,
          autoRotate: true,
          defaultDistance: 10,
        })

        const config = yield* camera.getConfig()
        expect(config.mouseSensitivity).toBe(1.5)
        expect(config.autoRotate).toBe(true)
        expect(config.defaultDistance).toBe(10)
        expect(config.minDistance).toBe(defaultThirdPersonConfig.minDistance) // 変更していない値は保持
      }).pipe(Effect.provide(testLayer))
    )
  })
})
