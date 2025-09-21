import { Context, Effect, Layer, Ref, Schema, Match, Option, pipe } from 'effect'
import { DefaultKeyMap, KeyAction, KeyMappingConfig, KeyMappingError } from './KeyMapping'
import { KeyState } from './types'

// キーボード入力エラー
export const KeyboardInputErrorSchema = Schema.Struct({
  _tag: Schema.Literal('KeyboardInputError'),
  message: Schema.String,
  key: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.String),
})
export type KeyboardInputError = Schema.Schema.Type<typeof KeyboardInputErrorSchema>

export const KeyboardInputError = (params: Omit<KeyboardInputError, '_tag'>): KeyboardInputError => ({
  _tag: 'KeyboardInputError' as const,
  ...params,
})

// キーボード入力サービスインターフェース
export interface KeyboardInput {
  readonly isKeyPressed: (key: string) => Effect.Effect<boolean>
  readonly getKeyState: (key: string) => Effect.Effect<KeyState>
  readonly isActionPressed: (action: KeyAction) => Effect.Effect<boolean, KeyMappingError>
  readonly getPressedKeys: () => Effect.Effect<ReadonlyArray<string>>
  readonly setKeyMapping: (mapping: KeyMappingConfig) => Effect.Effect<void, KeyMappingError>
  readonly getKeyMapping: () => Effect.Effect<KeyMappingConfig>
  readonly getActionForKey: (key: string) => Effect.Effect<KeyAction | undefined>
  readonly resetKeyStates: () => Effect.Effect<void>
}

// Context定義
export const KeyboardInput = Context.GenericTag<KeyboardInput>('@minecraft/KeyboardInput')

// キーボード入力サービスの実装
export const KeyboardInputLive = Layer.effect(
  KeyboardInput,
  Effect.gen(function* () {
    // キー状態の管理
    const keyStates = yield* Ref.make<Map<string, KeyState>>(new Map())
    const keyMapping = yield* Ref.make<KeyMappingConfig>(DefaultKeyMap)
    const actionToKeyCache = yield* Ref.make<Map<KeyAction, string>>(new Map())

    // キャッシュの更新
    const updateActionCache = (mapping: KeyMappingConfig) =>
      Effect.gen(function* () {
        const cache = new Map<KeyAction, string>()
        Object.entries(mapping).forEach(([action, key]) => {
          cache.set(action as KeyAction, key)
        })
        yield* Ref.set(actionToKeyCache, cache)
      })

    // 初期キャッシュ設定
    yield* updateActionCache(DefaultKeyMap)

    // ブラウザAPI利用の安全なwrapper
    const safeWindowAccess = <T>(operation: () => T, errorMessage: string): Effect.Effect<T, KeyboardInputError> =>
      Effect.try({
        try: operation,
        catch: (error) =>
          KeyboardInputError({
            message: errorMessage,
            cause: error instanceof Error ? error.message : String(error),
          }),
      })

    // キー押下イベントハンドラー
    const handleKeyDown = (event: KeyboardEvent) =>
      Effect.gen(function* () {
        const key = event.code || event.key
        const keyState: KeyState = {
          key,
          isPressed: true,
          timestamp: Date.now(),
        }

        yield* Ref.update(keyStates, (states) => new Map(states.set(key, keyState)))
      }).pipe(Effect.runPromise)

    // キー解放イベントハンドラー
    const handleKeyUp = (event: KeyboardEvent) =>
      Effect.gen(function* () {
        const key = event.code || event.key
        const keyState: KeyState = {
          key,
          isPressed: false,
          timestamp: Date.now(),
        }

        yield* Ref.update(keyStates, (states) => new Map(states.set(key, keyState)))
      }).pipe(Effect.runPromise)

    // ウィンドウフォーカス喪失時の処理
    const handleWindowBlur = () =>
      Effect.gen(function* () {
        // 全てのキーの押下状態をリセット
        const currentStates = yield* Ref.get(keyStates)
        const newStates = new Map<string, KeyState>()

        currentStates.forEach((state, key) => {
          newStates.set(key, {
            key,
            isPressed: false,
            timestamp: Date.now(),
          })
        })

        yield* Ref.set(keyStates, newStates)
      }).pipe(Effect.runPromise)

    // イベントリスナーの設定
    const setupEventListeners = safeWindowAccess(() => {
      pipe(
        typeof window !== 'undefined',
        Match.value,
        Match.when(true, () => {
          window.addEventListener('keydown', handleKeyDown)
          window.addEventListener('keyup', handleKeyUp)
          window.addEventListener('blur', handleWindowBlur)

          // コンテキストメニュー無効化（ゲーム操作時の誤動作防止）
          window.addEventListener('contextmenu', (e) => e.preventDefault())
        }),
        Match.orElse(() => undefined)
      )
      return undefined
    }, 'イベントリスナーの設定に失敗しました')

    yield* setupEventListeners

    return KeyboardInput.of({
      isKeyPressed: (key) =>
        Effect.gen(function* () {
          const states = yield* Ref.get(keyStates)
          const state = states.get(key)
          return state?.isPressed ?? false
        }),

      getKeyState: (key) =>
        Effect.gen(function* () {
          const states = yield* Ref.get(keyStates)
          return pipe(
            Option.fromNullable(states.get(key)),
            Option.match({
              onNone: () => ({
                key,
                isPressed: false,
                timestamp: Date.now(),
              }),
              onSome: (state) => state,
            })
          )
        }),

      isActionPressed: (action) =>
        Effect.gen(function* () {
          const mapping = yield* Ref.get(keyMapping)
          const key = yield* pipe(
            Option.fromNullable(mapping[action]),
            Option.match({
              onNone: () =>
                Effect.fail(
                  KeyMappingError({
                    message: `アクション「${action}」に対するキーマッピングが見つかりません`,
                    action,
                  })
                ),
              onSome: (key) => Effect.succeed(key),
            })
          )

          const states = yield* Ref.get(keyStates)
          const state = states.get(key)
          return state?.isPressed ?? false
        }),

      getPressedKeys: () =>
        Effect.gen(function* () {
          const states = yield* Ref.get(keyStates)
          const pressedKeys: string[] = []

          states.forEach((state, key) => {
            pipe(
              state.isPressed,
              Match.value,
              Match.when(true, () => {
                pressedKeys.push(key)
              }),
              Match.orElse(() => undefined)
            )
          })

          return pressedKeys
        }),

      setKeyMapping: (mapping) =>
        Effect.gen(function* () {
          // 重複チェック
          const values = Object.values(mapping)
          const uniqueValues = new Set(values)

          yield* pipe(
            values.length !== uniqueValues.size,
            Match.value,
            Match.when(true, () =>
              Effect.fail(
                KeyMappingError({
                  message: 'キーマッピングに重複があります',
                })
              )
            ),
            Match.orElse(() => Effect.succeed(undefined))
          )

          yield* Ref.set(keyMapping, mapping)
          yield* updateActionCache(mapping)
        }),

      getKeyMapping: () => Ref.get(keyMapping),

      getActionForKey: (key) =>
        Effect.gen(function* () {
          const mapping = yield* Ref.get(keyMapping)

          return pipe(
            Object.entries(mapping).find(([action, mappedKey]) => mappedKey === key),
            Option.fromNullable,
            Option.match({
              onNone: () => undefined,
              onSome: ([action, _]) => action as KeyAction,
            })
          )
        }),

      resetKeyStates: () => Ref.set(keyStates, new Map()),
    })
  })
)

// モック実装（テスト用）
export const MockKeyboardInput = Layer.succeed(
  KeyboardInput,
  KeyboardInput.of({
    isKeyPressed: () => Effect.succeed(false),
    getKeyState: (key) =>
      Effect.succeed({
        key,
        isPressed: false,
        timestamp: Date.now(),
      }),
    isActionPressed: () => Effect.succeed(false),
    getPressedKeys: () => Effect.succeed([]),
    setKeyMapping: () => Effect.succeed(undefined),
    getKeyMapping: () => Effect.succeed(DefaultKeyMap),
    getActionForKey: () => Effect.succeed(undefined),
    resetKeyStates: () => Effect.succeed(undefined),
  })
)
