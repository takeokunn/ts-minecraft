import { Context, Effect, Exit, Layer, Ref, Option, Match, pipe, Predicate } from 'effect'
import { Schema } from '@effect/schema'
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
    const safeDocumentAccess = <T>(
      operation: () => T,
      errorMessage: string
    ): Effect.Effect<T, MouseInputError, never> =>
      Effect.try({
        try: () => {
          return pipe(
            Predicate.isUndefined(document),
            Match.value,
            Match.when(true, () => {
              throw new Error('Document is not available')
            }),
            Match.orElse(() => operation())
          ) as T
        },
        catch: (error) =>
          MouseInputError({
            message: errorMessage,
            cause: pipe(
              Match.value(error),
              Match.when(
                (e: unknown): e is Error =>
                  Predicate.isRecord(e) && 'message' in e && 'name' in e && Predicate.isString(e['message']),
                (e: Error) => e.message
              ),
              Match.orElse(() => String(error))
            ),
          }),
      })

    // マウス移動イベントリスナー
    const handleMouseMove = (event: MouseEvent) => {
      const effect = Effect.gen(function* () {
        const currentTime = Date.now()
        const currentPosition = yield* Ref.get(position)

        // デルタ計算（movementX/Yの存在チェック）
        const deltaX =
          'movementX' in event && Predicate.isNumber(event.movementX)
            ? event.movementX
            : (event as MouseEvent).clientX - currentPosition.x

        const deltaY =
          'movementY' in event && Predicate.isNumber(event.movementY)
            ? event.movementY
            : (event as MouseEvent).clientY - currentPosition.y

        // 状態更新
        yield* Ref.set(position, {
          x: (event as MouseEvent).clientX,
          y: (event as MouseEvent).clientY,
          timestamp: currentTime,
        })

        yield* Ref.set(delta, {
          deltaX,
          deltaY,
          timestamp: currentTime,
        })
      })

      Effect.runFork(
        effect.pipe(Effect.catchAll((error) => Effect.sync(() => console.error('Mouse move handler failed:', error))))
      )
    }

    // マウスボタンイベントリスナー
    const handleMouseButton = (event: MouseEvent, isPressed: boolean) => {
      const effect = Effect.gen(function* () {
        const buttonState: MouseButtonState = {
          button: event.button,
          isPressed,
          timestamp: Date.now(),
        }

        yield* Ref.update(buttonStates, (states) => new Map(states.set(event.button, buttonState)))
      })

      Effect.runFork(
        effect.pipe(Effect.catchAll((error) => Effect.sync(() => console.error('Mouse button handler failed:', error))))
      )
    }

    // ポインターロック状態変更リスナー
    const handlePointerLockChange = () => {
      const effect = Effect.gen(function* () {
        const documentExists = !Predicate.isUndefined(document)

        const isLocked = documentExists && document.pointerLockElement !== null
        const element = (documentExists && document.pointerLockElement?.id) || undefined

        yield* Ref.set(pointerLockState, {
          isLocked,
          element,
          lockTime: isLocked ? Date.now() : undefined,
        })
      })

      Effect.runFork(
        effect.pipe(
          Effect.catchAll((error) => Effect.sync(() => console.error('Pointer lock change handler failed:', error)))
        )
      )
    }

    // イベントリスナーの設定
    yield* pipe(
      !Predicate.isUndefined(document),
      Match.value,
      Match.when(true, () =>
        safeDocumentAccess(() => {
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mousedown', (e) => handleMouseButton(e, true))
          document.addEventListener('mouseup', (e) => handleMouseButton(e, false))
          document.addEventListener('pointerlockchange', handlePointerLockChange)
          return undefined
        }, 'イベントリスナーの設定に失敗しました')
      ),
      Match.orElse(() => Effect.succeed(undefined))
    )

    return MouseInput.of({
      getPosition: () => Ref.get(position),

      getDelta: () => Ref.get(delta),

      getButtonState: (button) =>
        Effect.gen(function* () {
          const states = yield* Ref.get(buttonStates)
          const state = states.get(button)

          return yield* Option.fromNullable(state).pipe(
            Option.match({
              onNone: () => ({
                button,
                isPressed: false,
                timestamp: Date.now(),
              }),
              onSome: (s) => s,
            }),
            Effect.succeed
          )
        }),

      isButtonPressed: (button) =>
        Effect.gen(function* () {
          const states = yield* Ref.get(buttonStates)
          const state = states.get(button)
          return state?.isPressed ?? false
        }),

      requestPointerLock: (elementId) =>
        safeDocumentAccess(() => {
          const element = elementId ? document.getElementById(elementId) : document.body

          pipe(
            Option.fromNullable(element),
            Option.match({
              onNone: () => {
                throw new Error(`Element with ID "${elementId}" not found`)
              },
              onSome: (el) => {
                el.requestPointerLock()
              },
            })
          )
        }, 'ポインターロックの要求に失敗しました'),

      exitPointerLock: () =>
        safeDocumentAccess(() => {
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
