import { describe, it, expect } from 'vitest'
import { Effect, pipe } from 'effect'
import { it as effectIt } from '@effect/vitest'
import { CameraService, CameraServiceTest, CameraMode, CameraState, defaultCameraState } from '../CameraService'

describe('CameraService', () => {
  describe('getState', () => {
    effectIt.effect('初期状態を取得できる', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        const state = yield* service.getState()

        expect(state.mode).toBe('first-person')
        expect(state.fov).toBe(75)
        expect(state.position.y).toBe(1.7)
      }).pipe(Effect.provide(CameraServiceTest))
    )
  })

  describe('update', () => {
    effectIt.effect('カメラ位置を更新できる', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        const newState = yield* service.update({
          deltaTime: 0.016,
          targetPosition: { x: 10, y: 5, z: -3 },
        })

        expect(newState.position.x).toBe(10)
        expect(newState.position.y).toBe(5)
        expect(newState.position.z).toBe(-3)
      }).pipe(Effect.provide(CameraServiceTest))
    )

    effectIt.effect('カメラ回転を更新できる', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        const newState = yield* service.update({
          deltaTime: 0.016,
          targetRotation: { pitch: 45, yaw: 180 },
        })

        expect(newState.rotation.pitch).toBe(45)
        expect(newState.rotation.yaw).toBe(180)
      }).pipe(Effect.provide(CameraServiceTest))
    )

    effectIt.effect('FOVを更新できる', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        const newState = yield* service.update({
          deltaTime: 0.016,
          fov: 90,
        })

        expect(newState.fov).toBe(90)
      }).pipe(Effect.provide(CameraServiceTest))
    )

    effectIt.effect('カメラモードを更新できる', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        const newState = yield* service.update({
          deltaTime: 0.016,
          mode: 'third-person',
        })

        expect(newState.mode).toBe('third-person')
      }).pipe(Effect.provide(CameraServiceTest))
    )

    effectIt.effect('ピッチを-90〜90度に制限する', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        // 上限を超える値
        yield* service.update({
          deltaTime: 0.016,
          targetRotation: { pitch: 120, yaw: 0 },
        })
        const stateOver = yield* service.getState()
        expect(stateOver.rotation.pitch).toBeLessThanOrEqual(90)

        // 下限を超える値
        yield* service.update({
          deltaTime: 0.016,
          targetRotation: { pitch: -120, yaw: 0 },
        })
        const stateUnder = yield* service.getState()
        expect(stateUnder.rotation.pitch).toBeGreaterThanOrEqual(-90)
      }).pipe(Effect.provide(CameraServiceTest))
    )

    effectIt.effect('FOVを30〜120度に制限する', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        // 上限を超える値
        yield* service.update({
          deltaTime: 0.016,
          fov: 150,
        })
        const stateOver = yield* service.getState()
        expect(stateOver.fov).toBeLessThanOrEqual(120)

        // 下限を超える値
        yield* service.update({
          deltaTime: 0.016,
          fov: 20,
        })
        const stateUnder = yield* service.getState()
        expect(stateUnder.fov).toBeGreaterThanOrEqual(30)
      }).pipe(Effect.provide(CameraServiceTest))
    )
  })

  describe('setMode', () => {
    effectIt.effect('カメラモードを設定できる', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        yield* service.setMode('third-person')
        const state = yield* service.getState()

        expect(state.mode).toBe('third-person')
      }).pipe(Effect.provide(CameraServiceTest))
    )
  })

  describe('setFOV', () => {
    effectIt.effect('FOVを設定できる', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        yield* service.setFOV(100)
        const state = yield* service.getState()

        expect(state.fov).toBe(100)
      }).pipe(Effect.provide(CameraServiceTest))
    )

    effectIt.effect('FOVを範囲内に制限する', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        // 上限を超える値
        yield* service.setFOV(200)
        const stateOver = yield* service.getState()
        expect(stateOver.fov).toBe(120)

        // 下限を超える値
        yield* service.setFOV(10)
        const stateUnder = yield* service.getState()
        expect(stateUnder.fov).toBe(30)
      }).pipe(Effect.provide(CameraServiceTest))
    )
  })

  describe('reset', () => {
    effectIt.effect('デフォルト状態にリセットできる', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        // 状態を変更
        yield* service.update({
          deltaTime: 0.016,
          targetPosition: { x: 100, y: 50, z: 75 },
          mode: 'third-person',
          fov: 110,
        })

        // リセット
        yield* service.reset()
        const state = yield* service.getState()

        expect(state.position.x).toBe(defaultCameraState.position.x)
        expect(state.position.y).toBe(defaultCameraState.position.y)
        expect(state.position.z).toBe(defaultCameraState.position.z)
        expect(state.mode).toBe(defaultCameraState.mode)
        expect(state.fov).toBe(defaultCameraState.fov)
      }).pipe(Effect.provide(CameraServiceTest))
    )
  })
})
