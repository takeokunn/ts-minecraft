import { Context, Effect, Layer, Ref } from 'effect'
import { Schema } from 'effect'
import { MouseDelta, MouseButtonState, InputSystemError } from './types'

// マウス位置
export const MousePosition = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  timestamp: Schema.Number.pipe(Schema.positive()),
})
export type MousePosition = Schema.Schema.Type<typeof MousePosition>

// ポインターロック状態
export const PointerLockState = Schema.Struct({
  isLocked: Schema.Boolean,
  element: Schema.optional(Schema.String), // DOM要素ID
  lockTime: Schema.optional(Schema.Number),
})
export type PointerLockState = Schema.Schema.Type<typeof PointerLockState>

// マウス入力エラー
export const MouseInputErrorSchema = Schema.Struct({
  _tag: Schema.Literal('MouseInputError'),
  message: Schema.String,
  cause: Schema.optional(Schema.String),
})

export type MouseInputError = Schema.Schema.Type<typeof MouseInputErrorSchema>

export const MouseInputError = (params: Omit<MouseInputError, '_tag'>): MouseInputError => ({
  _tag: 'MouseInputError' as const,
  ...params,
})

// マウス入力サービス
export interface MouseInput {
  readonly getPosition: () => Effect.Effect<MousePosition, MouseInputError>
  readonly getDelta: () => Effect.Effect<MouseDelta, MouseInputError>
  readonly getButtonState: (button: number) => Effect.Effect<MouseButtonState, MouseInputError>
  readonly isButtonPressed: (button: number) => Effect.Effect<boolean, MouseInputError>
  readonly requestPointerLock: (elementId?: string) => Effect.Effect<void, MouseInputError>
  readonly exitPointerLock: () => Effect.Effect<void, MouseInputError>
  readonly getPointerLockState: () => Effect.Effect<PointerLockState, MouseInputError>
  readonly resetDelta: () => Effect.Effect<void, MouseInputError>
}

export const MouseInput = Context.GenericTag<MouseInput>('@minecraft/MouseInput')

// マウス入力の実装
export const MouseInputLive = Layer.effect(
  MouseInput,
  Effect.gen(function* () {
    // マウス状態の管理
    const position = yield* Ref.make<MousePosition>({ x: 0, y: 0, timestamp: Date.now() })
    const delta = yield* Ref.make<MouseDelta>({ deltaX: 0, deltaY: 0, timestamp: Date.now() })
    const buttonStates = yield* Ref.make<Map<number, MouseButtonState>>(new Map())
    const pointerLockState = yield* Ref.make<PointerLockState>({ isLocked: false })

    // ブラウザAPI利用の安全なwrapper
    const safeDocumentAccess = <T>(operation: () => T, errorMessage: string): Effect.Effect<T, MouseInputError> =>
      Effect.try({
        try: operation,
        catch: (error) =>
          MouseInputError({
            message: errorMessage,
            cause: error instanceof Error ? error.message : String(error),
          }),
      })

    // マウス移動イベントリスナー
    const handleMouseMove = (event: MouseEvent) =>
      Effect.gen(function* () {
        const currentTime = Date.now()
        const currentPosition = yield* Ref.get(position)

        // デルタ計算
        const deltaX = event.movementX || event.clientX - currentPosition.x
        const deltaY = event.movementY || event.clientY - currentPosition.y

        // 状態更新
        yield* Ref.set(position, {
          x: event.clientX,
          y: event.clientY,
          timestamp: currentTime,
        })

        yield* Ref.set(delta, {
          deltaX,
          deltaY,
          timestamp: currentTime,
        })
      }).pipe(Effect.runPromise)

    // マウスボタンイベントリスナー
    const handleMouseButton = (event: MouseEvent, isPressed: boolean) =>
      Effect.gen(function* () {
        const buttonState: MouseButtonState = {
          button: event.button,
          isPressed,
          timestamp: Date.now(),
        }

        yield* Ref.update(buttonStates, (states) => new Map(states.set(event.button, buttonState)))
      }).pipe(Effect.runPromise)

    // ポインターロック状態変更リスナー
    const handlePointerLockChange = () =>
      Effect.gen(function* () {
        const isLocked = typeof document !== 'undefined' && document.pointerLockElement !== null
        const element = (typeof document !== 'undefined' && document.pointerLockElement?.id) || undefined

        yield* Ref.set(pointerLockState, {
          isLocked,
          element,
          lockTime: isLocked ? Date.now() : undefined,
        })
      }).pipe(Effect.runPromise)

    // イベントリスナーの設定
    const setupEventListeners = safeDocumentAccess(() => {
      if (typeof document !== 'undefined') {
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mousedown', (e) => handleMouseButton(e, true))
        document.addEventListener('mouseup', (e) => handleMouseButton(e, false))
        document.addEventListener('pointerlockchange', handlePointerLockChange)
      }
      return undefined
    }, 'イベントリスナーの設定に失敗しました')

    yield* setupEventListeners

    return MouseInput.of({
      getPosition: () => Ref.get(position),

      getDelta: () => Ref.get(delta),

      getButtonState: (button) =>
        Effect.gen(function* () {
          const states = yield* Ref.get(buttonStates)
          const state = states.get(button)

          if (!state) {
            return {
              button,
              isPressed: false,
              timestamp: Date.now(),
            }
          }

          return state
        }),

      isButtonPressed: (button) =>
        Effect.gen(function* () {
          const states = yield* Ref.get(buttonStates)
          const state = states.get(button)
          return state?.isPressed ?? false
        }),

      requestPointerLock: (elementId) =>
        safeDocumentAccess(() => {
          if (typeof document === 'undefined') {
            throw new Error('Document is not available')
          }

          const element = elementId ? document.getElementById(elementId) : document.body

          if (!element) {
            throw new Error(`Element with ID "${elementId}" not found`)
          }

          element.requestPointerLock()
        }, 'ポインターロックの要求に失敗しました'),

      exitPointerLock: () =>
        safeDocumentAccess(() => {
          if (typeof document === 'undefined') {
            throw new Error('Document is not available')
          }

          document.exitPointerLock()
        }, 'ポインターロックの解除に失敗しました'),

      getPointerLockState: () => Ref.get(pointerLockState),

      resetDelta: () =>
        Ref.set(delta, {
          deltaX: 0,
          deltaY: 0,
          timestamp: Date.now(),
        }),
    })
  })
)

// テスト用のモック実装
export const MockMouseInput = Layer.succeed(
  MouseInput,
  MouseInput.of({
    getPosition: () =>
      Effect.succeed({
        x: 100,
        y: 200,
        timestamp: Date.now(),
      }),

    getDelta: () =>
      Effect.succeed({
        deltaX: 5,
        deltaY: -3,
        timestamp: Date.now(),
      }),

    getButtonState: (button) =>
      Effect.succeed({
        button,
        isPressed: false,
        timestamp: Date.now(),
      }),

    isButtonPressed: () => Effect.succeed(false),

    requestPointerLock: () => Effect.succeed(undefined),

    exitPointerLock: () => Effect.succeed(undefined),

    getPointerLockState: () =>
      Effect.succeed({
        isLocked: false,
      }),

    resetDelta: () => Effect.succeed(undefined),
  })
)
