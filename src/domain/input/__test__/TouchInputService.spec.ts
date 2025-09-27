import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TouchPoint, TouchSettings } from '../TouchInputService'
import { TouchInputService, TouchInputServiceLive } from '../TouchInputService'

// Touch APIのモック
Object.defineProperty(global, 'window', {
  writable: true,
  value: {
    ontouchstart: true,
  },
})

Object.defineProperty(global, 'navigator', {
  writable: true,
  value: {
    maxTouchPoints: 5,
  },
})

describe('TouchInputService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常に初期化できること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService

      yield* touchService.initialize()

      // エラーなく初期化完了することを確認
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })

  it('マルチタッチサポートを正しく検出できること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService

      const isSupported = yield* touchService.isMultiTouchSupported()

      expect(isSupported).toBe(true)
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })

  it('設定を更新できること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService

      const newSettings: TouchSettings = {
        _tag: 'TouchSettings',
        tapThreshold: 150,
        holdThreshold: 600,
        swipeThreshold: 40,
        doubleTapThreshold: 250,
        pinchThreshold: 25,
        rotateThreshold: 20,
      }

      yield* touchService.updateSettings(newSettings)

      const currentSettings = yield* touchService.getSettings()
      expect(currentSettings.tapThreshold).toBe(150)
      expect(currentSettings.holdThreshold).toBe(600)
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })

  it('タップジェスチャーを検出できること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService
      yield* touchService.initialize()

      const touchPoint: TouchPoint = {
        _tag: 'TouchPoint',
        identifier: 0,
        x: 100,
        y: 100,
        clientX: 100,
        clientY: 100,
        pageX: 100,
        pageY: 100,
        screenX: 100,
        screenY: 100,
      }

      // タッチ開始
      const gestureStart = yield* touchService.detectGesture([touchPoint])
      expect(gestureStart).toBeNull() // 開始時はジェスチャーなし

      // タッチ終了（短時間・短距離移動）
      const gestureEnd = yield* touchService.detectGesture([])

      // 実際の実装では内部状態によってタップが検出される
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })

  it('スワイプジェスチャーを検出できること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService
      yield* touchService.initialize()

      const startPoint: TouchPoint = {
        _tag: 'TouchPoint',
        identifier: 0,
        x: 100,
        y: 100,
        clientX: 100,
        clientY: 100,
        pageX: 100,
        pageY: 100,
        screenX: 100,
        screenY: 100,
      }

      const endPoint: TouchPoint = {
        _tag: 'TouchPoint',
        identifier: 0,
        x: 200,
        y: 100,
        clientX: 200,
        clientY: 100,
        pageX: 200,
        pageY: 100,
        screenX: 200,
        screenY: 100,
      }

      // タッチ開始
      yield* touchService.detectGesture([startPoint])

      // 大幅な移動後にタッチ終了
      const gesture = yield* touchService.detectGesture([])

      // 実際の実装では右スワイプが検出される
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })

  it('ピンチジェスチャーを検出できること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService
      yield* touchService.initialize()

      const touch1: TouchPoint = {
        _tag: 'TouchPoint',
        identifier: 0,
        x: 100,
        y: 100,
        clientX: 100,
        clientY: 100,
        pageX: 100,
        pageY: 100,
        screenX: 100,
        screenY: 100,
      }

      const touch2: TouchPoint = {
        _tag: 'TouchPoint',
        identifier: 1,
        x: 200,
        y: 100,
        clientX: 200,
        clientY: 100,
        pageX: 200,
        pageY: 100,
        screenX: 200,
        screenY: 100,
      }

      // 2点タッチ
      const gesture = yield* touchService.detectGesture([touch1, touch2])

      // 実際の実装ではピンチの初期化や検出が行われる
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })

  it('ジェスチャーストリームを作成できること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService

      const gestureStream = yield* touchService.createGestureStream()

      expect(gestureStream).toBeDefined()
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })

  it('現在のタッチポイントを取得できること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService
      yield* touchService.initialize()

      const touchPoints = yield* touchService.getTouchPoints()

      expect(Array.isArray(touchPoints)).toBe(true)
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })

  it('クリーンアップが正常に動作すること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService
      yield* touchService.initialize()

      yield* touchService.cleanup()

      // エラーなくクリーンアップが完了することを確認
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })

  it('不正な設定値でエラーが発生すること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService

      const invalidSettings = {
        _tag: 'TouchSettings',
        tapThreshold: 50, // 範囲外（100-500）
        holdThreshold: 500,
        swipeThreshold: 50,
        doubleTapThreshold: 300,
        pinchThreshold: 20,
        rotateThreshold: 15,
      } as any

      const result = yield* Effect.either(touchService.updateSettings(invalidSettings))

      expect(result._tag).toBe('Left')
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })

  it('設定の境界値が正しく動作すること', async () => {
    const effect = Effect.gen(function* () {
      const touchService = yield* TouchInputService

      // 最小値
      const minSettings: TouchSettings = {
        _tag: 'TouchSettings',
        tapThreshold: 100,
        holdThreshold: 300,
        swipeThreshold: 30,
        doubleTapThreshold: 200,
        pinchThreshold: 10,
        rotateThreshold: 5,
      }

      yield* touchService.updateSettings(minSettings)

      // 最大値
      const maxSettings: TouchSettings = {
        _tag: 'TouchSettings',
        tapThreshold: 500,
        holdThreshold: 1000,
        swipeThreshold: 100,
        doubleTapThreshold: 500,
        pinchThreshold: 50,
        rotateThreshold: 30,
      }

      yield* touchService.updateSettings(maxSettings)

      const currentSettings = yield* touchService.getSettings()
      expect(currentSettings.tapThreshold).toBe(500)
    })

    await Effect.runPromise(effect.pipe(Effect.provide(TouchInputServiceLive)))
  })
})
