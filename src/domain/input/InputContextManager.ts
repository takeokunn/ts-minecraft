import { Context, Effect, Layer, Match, Ref, Schema, pipe, Option, Order, Array as EffectArray } from 'effect'
import type { InputEvent } from './schemas'

// 入力コンテキストエラー
export const InputContextErrorSchema = Schema.TaggedError('InputContextError', {
  message: Schema.String,
  context: Schema.optional(Schema.String),
})
export const InputContextError = Schema.TaggedError(InputContextErrorSchema)
export type InputContextError = Schema.Schema.Type<typeof InputContextErrorSchema>

// 入力優先度（高い値ほど優先）
export const InputPrioritySchema = Schema.Union(
  Schema.Literal('GUI'),      // 優先度: 100
  Schema.Literal('CHAT'),     // 優先度: 90
  Schema.Literal('SETTINGS'), // 優先度: 80
  Schema.Literal('GAME'),     // 優先度: 50
  Schema.Literal('DEFAULT')   // 優先度: 0
)

export type InputPriority = Schema.Schema.Type<typeof InputPrioritySchema>

// 入力コンテキスト
export interface InputContext {
  readonly name: string
  readonly priority: InputPriority
  readonly active: boolean
  readonly consumeInput: boolean
  readonly allowedEvents: ReadonlyArray<InputEvent['_tag']>
}

// 入力コンテキストマネージャーインターフェース
export interface InputContextManager {
  readonly registerContext: (context: InputContext) => Effect.Effect<void, InputContextError>
  readonly unregisterContext: (name: string) => Effect.Effect<void, InputContextError>
  readonly activateContext: (name: string) => Effect.Effect<void, InputContextError>
  readonly deactivateContext: (name: string) => Effect.Effect<void, InputContextError>
  readonly shouldProcessInput: (event: InputEvent, currentPriority: InputPriority) => Effect.Effect<boolean, never>
  readonly getActiveContexts: () => Effect.Effect<ReadonlyArray<InputContext>, InputContextError>
  readonly getHighestPriorityContext: () => Effect.Effect<InputContext | null, InputContextError>
  readonly isContextActive: (name: string) => Effect.Effect<boolean, InputContextError>
  readonly setContextPriority: (name: string, priority: InputPriority) => Effect.Effect<void, InputContextError>
}

export const InputContextManager = Context.GenericTag<InputContextManager>('@minecraft/InputContextManager')

// 優先度の数値マッピング
const PRIORITY_VALUES: Record<InputPriority, number> = {
  GUI: 100,
  CHAT: 90,
  SETTINGS: 80,
  GAME: 50,
  DEFAULT: 0,
}

// デフォルトコンテキスト
const DEFAULT_CONTEXTS: InputContext[] = [
  {
    name: 'game',
    priority: 'GAME',
    active: true,
    consumeInput: false,
    allowedEvents: [], // 全てのイベントを許可
  },
  {
    name: 'gui',
    priority: 'GUI',
    active: false,
    consumeInput: true,
    allowedEvents: ['KeyPressed', 'KeyReleased', 'MouseButtonPressed', 'MouseButtonReleased', 'MouseMoved'],
  },
  {
    name: 'chat',
    priority: 'CHAT',
    active: false,
    consumeInput: true,
    allowedEvents: ['KeyPressed', 'KeyReleased'],
  },
  {
    name: 'settings',
    priority: 'SETTINGS',
    active: false,
    consumeInput: true,
    allowedEvents: ['KeyPressed', 'KeyReleased', 'MouseButtonPressed', 'MouseButtonReleased', 'MouseMoved', 'MouseWheel'],
  },
]

// 入力コンテキストマネージャー実装
export const makeInputContextManager = Effect.gen(function* () {
  // コンテキストマップ
  const contextsRef = yield* Ref.make<Map<string, InputContext>>(
    new Map(DEFAULT_CONTEXTS.map(ctx => [ctx.name, ctx]))
  )

  // コンテキスト登録
  const registerContext = (context: InputContext): Effect.Effect<void, InputContextError> =>
    Effect.gen(function* () {
      const contexts = yield* Ref.get(contextsRef)
      yield* Effect.when(
        Effect.succeed(contexts.has(context.name)),
        () => Effect.fail(
          InputContextError.make({
            message: `Context already exists: ${context.name}`,
            context: context.name,
          }) as InputContextError
        )
      )

      yield* Ref.update(contextsRef, (map) => {
        const newMap = new Map(map)
        newMap.set(context.name, context)
        return newMap
      })
    })

  // コンテキスト登録解除
  const unregisterContext = (name: string): Effect.Effect<void, InputContextError> =>
    Effect.gen(function* () {
      const contexts = yield* Ref.get(contextsRef)
      yield* Effect.when(
        Effect.succeed(!contexts.has(name)),
        () => Effect.fail(
          InputContextError.make({
            message: `Context not found: ${name}`,
            context: name,
          }) as InputContextError
        )
      )

      yield* Ref.update(contextsRef, (map) => {
        const newMap = new Map(map)
        newMap.delete(name)
        return newMap
      })
    })

  // コンテキストアクティブ化
  const activateContext = (name: string): Effect.Effect<void, InputContextError> =>
    Effect.gen(function* () {
      yield* Ref.update(contextsRef, (map) =>
        pipe(
          Option.fromNullable(map.get(name)),
          Option.match({
            onNone: () => map,
            onSome: (context) => {
              const newMap = new Map(map)
              newMap.set(name, { ...context, active: true })
              return newMap
            }
          })
        )
      )

      yield* Effect.logDebug(`Activated input context: ${name}`)
    })

  // コンテキスト非アクティブ化
  const deactivateContext = (name: string): Effect.Effect<void, InputContextError> =>
    Effect.gen(function* () {
      yield* Ref.update(contextsRef, (map) =>
        pipe(
          Option.fromNullable(map.get(name)),
          Option.match({
            onNone: () => map,
            onSome: (context) => {
              const newMap = new Map(map)
              newMap.set(name, { ...context, active: false })
              return newMap
            }
          })
        )
      )

      yield* Effect.logDebug(`Deactivated input context: ${name}`)
    })

  // 入力処理判定
  const shouldProcessInput = (event: InputEvent, currentPriority: InputPriority): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const contexts = yield* Ref.get(contextsRef)
      const activeContexts = Array.from(contexts.values()).filter(ctx => ctx.active)

      yield* Effect.when(
        Effect.succeed(activeContexts.length === 0),
        () => Effect.succeed(true)
      )

      // 優先度でソート（高い順）
      const sortedContexts = activeContexts.sort((a, b) =>
        PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority]
      )

      // 最高優先度のコンテキストを確認
      return yield* pipe(
        Option.fromNullable(sortedContexts[0]),
        Option.match({
          onNone: () => Effect.succeed(true),
          onSome: (highestContext) => Effect.gen(function* () {
            // 現在の優先度より高い優先度のコンテキストがある場合
            const higherPriority = PRIORITY_VALUES[highestContext.priority] > PRIORITY_VALUES[currentPriority]
            yield* Effect.when(
              Effect.succeed(higherPriority && highestContext.consumeInput),
              () => Effect.succeed(false)
            )

            // イベントタイプが許可されているか確認
            return yield* Effect.if(
              highestContext.allowedEvents.length > 0,
              {
                onTrue: () => Effect.succeed(highestContext.allowedEvents.includes(event._tag)),
                onFalse: () => Effect.succeed(true)
              }
            )
          })
        })
      )

      return true
    })

  // アクティブコンテキスト取得
  const getActiveContexts = (): Effect.Effect<ReadonlyArray<InputContext>, InputContextError> =>
    Effect.gen(function* () {
      const contexts = yield* Ref.get(contextsRef)
      return Array.from(contexts.values()).filter(ctx => ctx.active)
    })

  // 最高優先度コンテキスト取得
  const getHighestPriorityContext = (): Effect.Effect<InputContext | null, InputContextError> =>
    Effect.gen(function* () {
      const activeContexts = yield* getActiveContexts()
      return yield* pipe(
        activeContexts.length === 0,
        empty => Effect.if(empty, {
          onTrue: () => Effect.succeed(null),
          onFalse: () => Effect.gen(function* () {

      const sorted = activeContexts.sort((a, b) =>
        PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority]
      )

            return sorted[0] || null
          })
        })
      )
    })

  // コンテキストアクティブ確認
  const isContextActive = (name: string): Effect.Effect<boolean, InputContextError> =>
    Effect.gen(function* () {
      const contexts = yield* Ref.get(contextsRef)
      const context = contexts.get(name)
      return context?.active || false
    })

  // コンテキスト優先度設定
  const setContextPriority = (name: string, priority: InputPriority): Effect.Effect<void, InputContextError> =>
    Effect.gen(function* () {
      yield* Ref.update(contextsRef, (map) =>
        pipe(
          Option.fromNullable(map.get(name)),
          Option.match({
            onNone: () => map,
            onSome: (context) => {
              const newMap = new Map(map)
              newMap.set(name, { ...context, priority })
              return newMap
            }
          })
        )
      )
    })

  // 初期化時のログ
  yield* Effect.logInfo('InputContextManager initialized with default contexts')

  return {
    registerContext,
    unregisterContext,
    activateContext,
    deactivateContext,
    shouldProcessInput,
    getActiveContexts,
    getHighestPriorityContext,
    isContextActive,
    setContextPriority,
  }
})

// InputContextManagerレイヤー
export const InputContextManagerLive = Layer.effect(
  InputContextManager,
  makeInputContextManager
)