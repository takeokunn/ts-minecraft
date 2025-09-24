import { Context, Effect, Layer, Match, Ref, Schema, pipe, Option, Queue, Stream, Duration } from 'effect'
import type { InputTimestamp } from './schemas'

// タッチ入力エラー
export const TouchInputErrorSchema = Schema.TaggedError('TouchInputError', {
  message: Schema.String,
  touchId: Schema.optional(Schema.Number),
})
export const TouchInputError = Schema.TaggedError(TouchInputErrorSchema)
export type TouchInputError = Schema.Schema.Type<typeof TouchInputErrorSchema>

// ジェスチャータイプ
export const GestureTypeSchema = Schema.Union(
  Schema.Literal('tap'),
  Schema.Literal('doubleTap'),
  Schema.Literal('hold'),
  Schema.Literal('swipeUp'),
  Schema.Literal('swipeDown'),
  Schema.Literal('swipeLeft'),
  Schema.Literal('swipeRight'),
  Schema.Literal('pinch'),
  Schema.Literal('spread'),
  Schema.Literal('rotate')
)
export type GestureType = Schema.Schema.Type<typeof GestureTypeSchema>

// タッチポイント
export const TouchPointSchema = Schema.Struct({
  _tag: Schema.Literal('TouchPoint'),
  identifier: Schema.Number,
  x: Schema.Number,
  y: Schema.Number,
  clientX: Schema.Number,
  clientY: Schema.Number,
  pageX: Schema.Number,
  pageY: Schema.Number,
  screenX: Schema.Number,
  screenY: Schema.Number,
  radiusX: Schema.optional(Schema.Number),
  radiusY: Schema.optional(Schema.Number),
  rotationAngle: Schema.optional(Schema.Number),
  force: Schema.optional(Schema.Number),
})
export type TouchPoint = Schema.Schema.Type<typeof TouchPointSchema>

// ジェスチャー
export const GestureSchema = Schema.TaggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('Tap'),
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    duration: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('DoubleTap'),
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    interval: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Hold'),
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    duration: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Swipe'),
    startPosition: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    endPosition: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    direction: Schema.Union(
      Schema.Literal('up'),
      Schema.Literal('down'),
      Schema.Literal('left'),
      Schema.Literal('right')
    ),
    velocity: Schema.Number,
    distance: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Pinch'),
    center: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    scale: Schema.Number,
    distance: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Rotate'),
    center: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    angle: Schema.Number,
    timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  }),
])
export type Gesture = Schema.Schema.Type<typeof GestureSchema>

// タッチ入力設定
export const TouchSettingsSchema = Schema.Struct({
  _tag: Schema.Literal('TouchSettings'),
  tapThreshold: Schema.Number.pipe(Schema.between(100, 500)), // ms
  holdThreshold: Schema.Number.pipe(Schema.between(300, 1000)), // ms
  swipeThreshold: Schema.Number.pipe(Schema.between(30, 100)), // pixels
  doubleTapThreshold: Schema.Number.pipe(Schema.between(200, 500)), // ms
  pinchThreshold: Schema.Number.pipe(Schema.between(10, 50)), // pixels
  rotateThreshold: Schema.Number.pipe(Schema.between(5, 30)), // degrees
})
export type TouchSettings = Schema.Schema.Type<typeof TouchSettingsSchema>

// タッチ入力サービスインターフェース
export interface TouchInputService {
  readonly initialize: () => Effect.Effect<void, TouchInputError>
  readonly cleanup: () => Effect.Effect<void, TouchInputError>
  readonly updateSettings: (settings: TouchSettings) => Effect.Effect<void, TouchInputError>
  readonly getSettings: () => Effect.Effect<TouchSettings, TouchInputError>
  readonly detectGesture: (touches: ReadonlyArray<TouchPoint>) => Effect.Effect<Gesture | null, TouchInputError>
  readonly createGestureStream: () => Effect.Effect<Stream.Stream<Gesture, TouchInputError>, never>
  readonly getTouchPoints: () => Effect.Effect<ReadonlyArray<TouchPoint>, TouchInputError>
  readonly isMultiTouchSupported: () => Effect.Effect<boolean, never>
}

export const TouchInputService = Context.GenericTag<TouchInputService>('@minecraft/TouchInputService')

// デフォルト設定
const DEFAULT_SETTINGS: TouchSettings = {
  _tag: 'TouchSettings',
  tapThreshold: 200,
  holdThreshold: 500,
  swipeThreshold: 50,
  doubleTapThreshold: 300,
  pinchThreshold: 20,
  rotateThreshold: 15,
}

// タッチトラッキング状態
interface TouchTrackingState {
  readonly startTime: number
  readonly startPosition: { x: number; y: number }
  readonly currentPosition: { x: number; y: number }
  readonly lastTapTime: number
  readonly touchCount: number
  readonly initialDistance?: number
  readonly initialAngle?: number
}

// タッチ入力サービス実装
export const makeTouchInputService = Effect.gen(function* () {
  // 設定の状態管理
  const settingsRef = yield* Ref.make<TouchSettings>(DEFAULT_SETTINGS)

  // タッチトラッキング
  const trackingRef = yield* Ref.make<Map<number, TouchTrackingState>>(new Map())

  // ジェスチャーキュー
  const gestureQueue = yield* Queue.bounded<Gesture>(100)

  // 最後のタップ時刻（ダブルタップ検出用）
  const lastTapRef = yield* Ref.make<{ time: number; position: { x: number; y: number } } | null>(null)

  // 初期化
  const initialize = (): Effect.Effect<void, TouchInputError> =>
    Effect.gen(function* () {
      const hasSupport = yield* Effect.sync(() => 'ontouchstart' in window)

      yield* Effect.when(
        Effect.succeed(!hasSupport),
        () => Effect.logWarning('Touch input not supported on this device')
      )

      yield* Effect.logInfo('TouchInputService initialized')
    })

  // クリーンアップ
  const cleanup = (): Effect.Effect<void, TouchInputError> =>
    Effect.gen(function* () {
      yield* Ref.set(trackingRef, new Map())
      yield* Queue.shutdown(gestureQueue)
      yield* Effect.logInfo('TouchInputService cleaned up')
    })

  // 設定更新
  const updateSettings = (settings: TouchSettings): Effect.Effect<void, TouchInputError> =>
    Effect.gen(function* () {
      const validated = yield* Schema.decode(TouchSettingsSchema)(settings).pipe(
        Effect.mapError(e => TouchInputError.make({ message: `Invalid settings: ${e}` }) as TouchInputError)
      )
      yield* Ref.set(settingsRef, validated)
    })

  // 設定取得
  const getSettings = (): Effect.Effect<TouchSettings, TouchInputError> =>
    Ref.get(settingsRef)

  // 距離計算
  const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number =>
    Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))

  // 角度計算
  const calculateAngle = (p1: { x: number; y: number }, p2: { x: number; y: number }): number =>
    Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI

  // スワイプ方向判定
  const determineSwipeDirection = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): 'up' | 'down' | 'left' | 'right' =>
    pipe(
      Math.abs(end.x - start.x) > Math.abs(end.y - start.y),
      horizontal => horizontal
        ? (end.x > start.x ? 'right' : 'left')
        : (end.y > start.y ? 'down' : 'up')
    )

  // ジェスチャー検出
  const detectGesture = (touches: ReadonlyArray<TouchPoint>): Effect.Effect<Gesture | null, TouchInputError> =>
    Effect.gen(function* () {
      const settings = yield* Ref.get(settingsRef)
      const tracking = yield* Ref.get(trackingRef)
      const currentTime = Date.now()

      return yield* Match.value(touches.length).pipe(
        Match.when(0, () => Effect.gen(function* () {
          // タッチ終了時のジェスチャー判定
          const states = Array.from(tracking.values())

          return yield* Match.value(states.length).pipe(
            Match.when(0, () => Effect.succeed(null)),
            Match.when(1, () => Effect.gen(function* () {
              const state = states[0]
              const duration = currentTime - state.startTime
              const distance = calculateDistance(state.startPosition, state.currentPosition)

              // ホールド判定
              yield* Effect.when(
                Effect.succeed(duration >= settings.holdThreshold && distance < settings.swipeThreshold),
                () => Queue.offer(gestureQueue, {
                  _tag: 'Hold',
                  position: state.startPosition,
                  duration,
                  timestamp: currentTime as InputTimestamp,
                })
              )

              // スワイプ判定
              yield* Effect.when(
                Effect.succeed(distance >= settings.swipeThreshold),
                () => Queue.offer(gestureQueue, {
                  _tag: 'Swipe',
                  startPosition: state.startPosition,
                  endPosition: state.currentPosition,
                  direction: determineSwipeDirection(state.startPosition, state.currentPosition),
                  velocity: distance / duration,
                  distance,
                  timestamp: currentTime as InputTimestamp,
                })
              )

              // タップ判定
              yield* Effect.when(
                Effect.succeed(duration < settings.tapThreshold && distance < settings.swipeThreshold),
                () => Effect.gen(function* () {
                  const lastTap = yield* Ref.get(lastTapRef)

                  // ダブルタップ判定
                  const isDoubleTap = yield* pipe(
                    Option.fromNullable(lastTap),
                    Option.match({
                      onNone: () => Effect.succeed(false),
                      onSome: (lt) => Effect.succeed(
                        currentTime - lt.time < settings.doubleTapThreshold &&
                        calculateDistance(lt.position, state.startPosition) < 30
                      )
                    })
                  )

                  yield* Effect.if(isDoubleTap, {
                    onTrue: () => Queue.offer(gestureQueue, {
                      _tag: 'DoubleTap',
                      position: state.startPosition,
                      interval: currentTime - (lastTap?.time || 0),
                      timestamp: currentTime as InputTimestamp,
                    }),
                    onFalse: () => Effect.gen(function* () {
                      yield* Queue.offer(gestureQueue, {
                        _tag: 'Tap',
                        position: state.startPosition,
                        duration,
                        timestamp: currentTime as InputTimestamp,
                      })
                      yield* Ref.set(lastTapRef, { time: currentTime, position: state.startPosition })
                    })
                  })
                })
              )

              yield* Ref.set(trackingRef, new Map())
              return null
            })),
            Match.orElse(() => Effect.succeed(null))
          )
        })),
        Match.when(1, () => Effect.gen(function* () {
          // シングルタッチの追跡
          const touch = touches[0]
          const position = { x: touch.x, y: touch.y }

          yield* Ref.update(trackingRef, (map) => {
            const existing = map.get(touch.identifier)
            return new Map(map).set(touch.identifier, existing ? {
              ...existing,
              currentPosition: position
            } : {
              startTime: currentTime,
              startPosition: position,
              currentPosition: position,
              lastTapTime: 0,
              touchCount: 1,
            })
          })

          return null
        })),
        Match.when(2, () => Effect.gen(function* () {
          // ピンチ/回転の検出
          const [t1, t2] = touches
          const center = {
            x: (t1.x + t2.x) / 2,
            y: (t1.y + t2.y) / 2,
          }
          const distance = calculateDistance({ x: t1.x, y: t1.y }, { x: t2.x, y: t2.y })
          const angle = calculateAngle({ x: t1.x, y: t1.y }, { x: t2.x, y: t2.y })

          const state = tracking.get(t1.identifier)

          yield* pipe(
            Option.fromNullable(state),
            Option.match({
              onNone: () => Effect.gen(function* () {
                // 初回タッチ
                yield* Ref.update(trackingRef, (map) =>
                  new Map(map).set(t1.identifier, {
                    startTime: currentTime,
                    startPosition: center,
                    currentPosition: center,
                    lastTapTime: 0,
                    touchCount: 2,
                    initialDistance: distance,
                    initialAngle: angle,
                  })
                )
              }),
              onSome: (s) => Effect.gen(function* () {
                // ピンチ判定
                const scaleDiff = Math.abs(distance - (s.initialDistance || distance))
                yield* Effect.when(
                  Effect.succeed(scaleDiff > settings.pinchThreshold),
                  () => Queue.offer(gestureQueue, {
                    _tag: 'Pinch',
                    center,
                    scale: distance / (s.initialDistance || distance),
                    distance,
                    timestamp: currentTime as InputTimestamp,
                  })
                )

                // 回転判定
                const angleDiff = Math.abs(angle - (s.initialAngle || angle))
                yield* Effect.when(
                  Effect.succeed(angleDiff > settings.rotateThreshold),
                  () => Queue.offer(gestureQueue, {
                    _tag: 'Rotate',
                    center,
                    angle: angle - (s.initialAngle || angle),
                    timestamp: currentTime as InputTimestamp,
                  })
                )
              })
            })
          )

          return null
        })),
        Match.orElse(() => Effect.succeed(null))
      )
    })

  // ジェスチャーストリーム作成
  const createGestureStream = (): Effect.Effect<Stream.Stream<Gesture, TouchInputError>, never> =>
    Effect.succeed(Stream.fromQueue(gestureQueue))

  // タッチポイント取得
  const getTouchPoints = (): Effect.Effect<ReadonlyArray<TouchPoint>, TouchInputError> =>
    Effect.gen(function* () {
      const tracking = yield* Ref.get(trackingRef)
      return Array.from(tracking.entries()).map(([id, state]) => ({
        _tag: 'TouchPoint' as const,
        identifier: id,
        x: state.currentPosition.x,
        y: state.currentPosition.y,
        clientX: state.currentPosition.x,
        clientY: state.currentPosition.y,
        pageX: state.currentPosition.x,
        pageY: state.currentPosition.y,
        screenX: state.currentPosition.x,
        screenY: state.currentPosition.y,
      }))
    })

  // マルチタッチサポート確認
  const isMultiTouchSupported = (): Effect.Effect<boolean, never> =>
    Effect.sync(() =>
      'maxTouchPoints' in navigator && navigator.maxTouchPoints > 1
    )

  return {
    initialize,
    cleanup,
    updateSettings,
    getSettings,
    detectGesture,
    createGestureStream,
    getTouchPoints,
    isMultiTouchSupported,
  }
})

// TouchInputServiceレイヤー
export const TouchInputServiceLive = Layer.effect(
  TouchInputService,
  makeTouchInputService
)