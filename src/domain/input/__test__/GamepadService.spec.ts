import { Effect, Layer, Stream, TestContext } from 'effect'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GamepadService, GamepadServiceLive } from '../GamepadService'
import type { GamepadSettings } from '../GamepadService'

// Navigator.getGamepads() のモック
const mockGamepads = [
  {
    id: 'Mock Xbox Controller',
    index: 0,
    connected: true,
    timestamp: Date.now(),
    buttons: Array(16).fill({ pressed: false, touched: false, value: 0 }),
    axes: [0, 0, 0, 0],
    vibrationActuator: {
      playEffect: vi.fn().mockResolvedValue(undefined),
    },
  },
  null,
  null,
  null,
]

// グローバルnavigatorのモック
Object.defineProperty(global, 'navigator', {
  writable: true,
  value: {
    getGamepads: vi.fn().mockReturnValue(mockGamepads),
  },
})

describe('GamepadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常に初期化できること', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService

      yield* gamepadService.initialize()

      // エラーなく初期化完了することを確認
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })

  it('接続されているゲームパッドを取得できること', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService
      yield* gamepadService.initialize()

      const gamepads = yield* gamepadService.getConnectedGamepads()

      expect(gamepads).toHaveLength(1)
      expect(gamepads[0]?.id).toBe('Mock Xbox Controller')
      expect(gamepads[0]?.connected).toBe(true)
      expect(gamepads[0]?.buttons).toHaveLength(16)
      expect(gamepads[0]?.axes).toHaveLength(4)
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })

  it('特定のゲームパッド状態を取得できること', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService
      yield* gamepadService.initialize()

      const gamepadState = yield* gamepadService.getGamepadState(0)

      expect(gamepadState).toBeDefined()
      expect(gamepadState!.index).toBe(0)
      expect(gamepadState!.id).toBe('Mock Xbox Controller')
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })

  it('存在しないゲームパッドの場合nullを返すこと', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService
      yield* gamepadService.initialize()

      const gamepadState = yield* gamepadService.getGamepadState(5)

      expect(gamepadState).toBeNull()
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })

  it('設定を更新できること', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService

      const newSettings: GamepadSettings = {
        _tag: 'GamepadSettings',
        sensitivity: 0.08 as any,
        invertX: true,
        invertY: false,
        deadzone: {
          leftStick: 0.2 as any,
          rightStick: 0.25 as any,
          triggers: 0.15 as any,
        },
        vibration: false,
      }

      yield* gamepadService.updateSettings(newSettings)

      const currentSettings = yield* gamepadService.getSettings()
      expect(currentSettings.sensitivity).toBe(0.08)
      expect(currentSettings.invertX).toBe(true)
      expect(currentSettings.vibration).toBe(false)
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })

  it('デッドゾーンを正しく適用できること', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService

      // デッドゾーン内の値
      const smallValue = yield* gamepadService.applyDeadzone(0.1, 0.15 as any)
      expect(smallValue).toBe(0)

      // デッドゾーンを超える値
      const largeValue = yield* gamepadService.applyDeadzone(0.8, 0.15 as any)
      expect(largeValue).toBeGreaterThan(0)
      expect(largeValue).toBeLessThan(0.8) // リマップされて小さくなる

      // 負の値
      const negativeValue = yield* gamepadService.applyDeadzone(-0.6, 0.15 as any)
      expect(negativeValue).toBeLessThan(0)
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })

  it('振動機能が正常に動作すること', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService
      yield* gamepadService.initialize()

      // 振動を実行
      yield* gamepadService.vibrate(0, 500, 0.8)

      // モックが呼ばれたことを確認
      expect(mockGamepads[0]?.vibrationActuator?.playEffect).toHaveBeenCalledWith('dual-rumble', {
        duration: 500,
        strongMagnitude: 0.8,
        weakMagnitude: 0.4,
      })
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })

  it('振動が無効な場合は振動しないこと', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService
      yield* gamepadService.initialize()

      // 振動を無効にする
      const noVibrationSettings: GamepadSettings = {
        _tag: 'GamepadSettings',
        sensitivity: 0.05 as any,
        invertX: false,
        invertY: false,
        deadzone: {
          leftStick: 0.15 as any,
          rightStick: 0.15 as any,
          triggers: 0.1 as any,
        },
        vibration: false,
      }

      yield* gamepadService.updateSettings(noVibrationSettings)
      yield* gamepadService.vibrate(0, 500, 0.8)

      // 振動が実行されていないことを確認
      expect(mockGamepads[0]?.vibrationActuator?.playEffect).not.toHaveBeenCalled()
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })

  it('ポーリングストリームを作成できること', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService
      yield* gamepadService.initialize()

      const pollingStream = yield* gamepadService.createPollingStream()

      expect(pollingStream).toBeDefined()
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })

  it('クリーンアップが正常に動作すること', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService
      yield* gamepadService.initialize()

      yield* gamepadService.cleanup()

      // エラーなくクリーンアップが完了することを確認
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })

  it('不正な設定値でエラーが発生すること', async () => {
    const effect = Effect.gen(function* () {
      const gamepadService = yield* GamepadService

      const invalidSettings = {
        _tag: 'GamepadSettings',
        sensitivity: 2.0, // 範囲外（0.01-0.1）
        invertX: false,
        invertY: false,
        deadzone: {
          leftStick: 0.15 as any,
          rightStick: 0.15 as any,
          triggers: 0.1 as any,
        },
        vibration: true,
      } as any

      const result = yield* Effect.either(gamepadService.updateSettings(invalidSettings))

      expect(result._tag).toBe('Left')
    })

    await Effect.runPromise(effect.pipe(Effect.provide(GamepadServiceLive)))
  })
})
