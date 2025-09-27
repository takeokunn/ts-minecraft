import { Schema } from '@effect/schema'
import { Context, Effect, Layer, Match, Option, Ref } from 'effect'
import type { ButtonId, ControlScheme, InputEvent, InputMapping, KeyCode } from './schemas'
import { ControlSchemeSchema } from './schemas'

// キーバインディングエラー
export const KeyBindingErrorSchema = Schema.Struct({
  _tag: Schema.Literal('KeyBindingError'),
  message: Schema.String,
  conflictingAction: Schema.optional(Schema.String),
})
export type KeyBindingError = Schema.Schema.Type<typeof KeyBindingErrorSchema>

// キーバインディングサービスインターフェース
export interface KeyBindingService {
  readonly loadScheme: (scheme: ControlScheme) => Effect.Effect<void, KeyBindingError>
  readonly saveScheme: (scheme: ControlScheme) => Effect.Effect<void, KeyBindingError>
  readonly resolveActions: (event: InputEvent) => Effect.Effect<ReadonlyArray<string>, KeyBindingError>
  readonly bindAction: (actionName: string, mapping: InputMapping) => Effect.Effect<void, KeyBindingError>
  readonly unbindAction: (actionName: string) => Effect.Effect<void, KeyBindingError>
  readonly getBinding: (actionName: string) => Effect.Effect<InputMapping | null, KeyBindingError>
  readonly getAllBindings: () => Effect.Effect<Record<string, InputMapping>, KeyBindingError>
  readonly detectConflicts: (mapping: InputMapping) => Effect.Effect<ReadonlyArray<string>, KeyBindingError>
  readonly resetToDefaults: () => Effect.Effect<void, KeyBindingError>
}

export const KeyBindingService = Context.GenericTag<KeyBindingService>('@minecraft/domain/KeyBindingService')

// デフォルトキーバインディング
const DEFAULT_MAPPINGS: Record<string, InputMapping> = {
  moveForward: {
    _tag: 'InputMapping',
    actionName: 'moveForward',
    keys: ['KeyW' as KeyCode],
    gamepadButtons: [],
    gamepadAxes: [{ axis: 1, direction: 'negative', threshold: 0.5 }],
    mouseButtons: [],
    touchGestures: [],
  },
  moveBackward: {
    _tag: 'InputMapping',
    actionName: 'moveBackward',
    keys: ['KeyS' as KeyCode],
    gamepadButtons: [],
    gamepadAxes: [{ axis: 1, direction: 'positive', threshold: 0.5 }],
    mouseButtons: [],
    touchGestures: [],
  },
  moveLeft: {
    _tag: 'InputMapping',
    actionName: 'moveLeft',
    keys: ['KeyA' as KeyCode],
    gamepadButtons: [],
    gamepadAxes: [{ axis: 0, direction: 'negative', threshold: 0.5 }],
    mouseButtons: [],
    touchGestures: [],
  },
  moveRight: {
    _tag: 'InputMapping',
    actionName: 'moveRight',
    keys: ['KeyD' as KeyCode],
    gamepadButtons: [],
    gamepadAxes: [{ axis: 0, direction: 'positive', threshold: 0.5 }],
    mouseButtons: [],
    touchGestures: [],
  },
  jump: {
    _tag: 'InputMapping',
    actionName: 'jump',
    keys: ['Space' as KeyCode],
    gamepadButtons: [0 as ButtonId], // A button
    gamepadAxes: [],
    mouseButtons: [],
    touchGestures: ['swipeUp'],
  },
  sneak: {
    _tag: 'InputMapping',
    actionName: 'sneak',
    keys: ['ShiftLeft' as KeyCode],
    gamepadButtons: [1 as ButtonId], // B button
    gamepadAxes: [],
    mouseButtons: [],
    touchGestures: [],
  },
  sprint: {
    _tag: 'InputMapping',
    actionName: 'sprint',
    keys: ['ControlLeft' as KeyCode],
    gamepadButtons: [10 as ButtonId], // Left stick button
    gamepadAxes: [],
    mouseButtons: [],
    touchGestures: ['doubleTap'],
  },
  attack: {
    _tag: 'InputMapping',
    actionName: 'attack',
    keys: [],
    gamepadButtons: [7 as ButtonId], // Right trigger
    gamepadAxes: [],
    mouseButtons: ['left'],
    touchGestures: ['tap'],
  },
  interact: {
    _tag: 'InputMapping',
    actionName: 'interact',
    keys: [],
    gamepadButtons: [6 as ButtonId], // Left trigger
    gamepadAxes: [],
    mouseButtons: ['right'],
    touchGestures: ['hold'],
  },
  inventory: {
    _tag: 'InputMapping',
    actionName: 'inventory',
    keys: ['KeyE' as KeyCode],
    gamepadButtons: [3 as ButtonId], // Y button
    gamepadAxes: [],
    mouseButtons: [],
    touchGestures: [],
  },
}

// 高度なキーバインディング機能
const ADVANCED_MAPPINGS: Record<string, InputMapping> = {
  // ホットバー選択 (1-9)
  hotbar1: {
    _tag: 'InputMapping',
    actionName: 'hotbar1',
    keys: ['Digit1' as KeyCode],
    gamepadButtons: [],
    gamepadAxes: [],
    mouseButtons: [],
    touchGestures: [],
  },
  hotbar2: {
    _tag: 'InputMapping',
    actionName: 'hotbar2',
    keys: ['Digit2' as KeyCode],
    gamepadButtons: [],
    gamepadAxes: [],
    mouseButtons: [],
    touchGestures: [],
  },
  hotbar3: {
    _tag: 'InputMapping',
    actionName: 'hotbar3',
    keys: ['Digit3' as KeyCode],
    gamepadButtons: [],
    gamepadAxes: [],
    mouseButtons: [],
    touchGestures: [],
  },
  // カメラ制御
  lookUp: {
    _tag: 'InputMapping',
    actionName: 'lookUp',
    keys: [],
    gamepadButtons: [],
    gamepadAxes: [{ axis: 3, direction: 'negative', threshold: 0.2 }],
    mouseButtons: [],
    touchGestures: ['swipeUp'],
  },
  lookDown: {
    _tag: 'InputMapping',
    actionName: 'lookDown',
    keys: [],
    gamepadButtons: [],
    gamepadAxes: [{ axis: 3, direction: 'positive', threshold: 0.2 }],
    mouseButtons: [],
    touchGestures: ['swipeDown'],
  },
  lookLeft: {
    _tag: 'InputMapping',
    actionName: 'lookLeft',
    keys: [],
    gamepadButtons: [],
    gamepadAxes: [{ axis: 2, direction: 'negative', threshold: 0.2 }],
    mouseButtons: [],
    touchGestures: ['swipeLeft'],
  },
  lookRight: {
    _tag: 'InputMapping',
    actionName: 'lookRight',
    keys: [],
    gamepadButtons: [],
    gamepadAxes: [{ axis: 2, direction: 'positive', threshold: 0.2 }],
    mouseButtons: [],
    touchGestures: ['swipeRight'],
  },
  // 複合アクション
  sprintJump: {
    _tag: 'InputMapping',
    actionName: 'sprintJump',
    keys: ['ControlLeft' as KeyCode, 'Space' as KeyCode], // 両方同時押し
    gamepadButtons: [0 as ButtonId, 10 as ButtonId], // A + LS
    gamepadAxes: [],
    mouseButtons: [],
    touchGestures: [],
  },
}

// 全マッピングを統合
const ALL_DEFAULT_MAPPINGS = { ...DEFAULT_MAPPINGS, ...ADVANCED_MAPPINGS }

// キーバインディングサービス実装
export const makeKeyBindingService = Effect.gen(function* () {
  // 現在のマッピング
  const mappingsRef = yield* Ref.make<Record<string, InputMapping>>(ALL_DEFAULT_MAPPINGS)

  // スキーム読み込み
  const loadScheme = (scheme: ControlScheme): Effect.Effect<void, KeyBindingError> =>
    Effect.gen(function* () {
      // 検証
      const validated = yield* Schema.decode(ControlSchemeSchema)(scheme).pipe(
        Effect.mapError((e) => ({ _tag: 'KeyBindingError' as const, message: `Invalid scheme: ${e}` }))
      )

      // マッピング更新
      yield* Ref.set(mappingsRef, validated.mappings)
    })

  // スキーム保存
  const saveScheme = (scheme: ControlScheme): Effect.Effect<void, KeyBindingError> =>
    Effect.gen(function* () {
      // 実際の保存処理（localStorage等）
      yield* Effect.logDebug(`Saving control scheme: ${scheme.name}`)
    })

  // アクション解決
  const resolveActions = (event: InputEvent): Effect.Effect<ReadonlyArray<string>, KeyBindingError> =>
    Effect.gen(function* () {
      const mappings = yield* Ref.get(mappingsRef)
      const actions: string[] = []

      yield* Effect.forEach(Object.entries(mappings), ([actionName, mapping]) =>
        Effect.gen(function* () {
          const matches = yield* checkMappingMatch(event, mapping)
          return yield* Effect.if(matches, {
            onTrue: () => Effect.succeed(Option.some(actionName)),
            onFalse: () => Effect.succeed(Option.none()),
          })
        })
      ).pipe(
        Effect.map((results) =>
          results
            .filter(Option.isSome)
            .map((opt) => Option.getOrNull(opt))
            .filter((x) => x !== null)
        ),
        Effect.map((filtered) => actions.push(...filtered))
      )

      return actions
    })

  // マッピングマッチ確認
  const checkMappingMatch = (event: InputEvent, mapping: InputMapping): Effect.Effect<boolean, never> =>
    Match.value(event).pipe(
      Match.when({ _tag: 'KeyPressed' }, ({ keyCode }) => Effect.succeed(mapping.keys.includes(keyCode))),
      Match.when({ _tag: 'MouseButtonPressed' }, ({ button }) => Effect.succeed(mapping.mouseButtons.includes(button))),
      Match.when({ _tag: 'GamepadButtonPressed' }, ({ buttonId }) =>
        Effect.succeed(mapping.gamepadButtons.includes(buttonId))
      ),
      Match.when({ _tag: 'GamepadAxisMove' }, ({ axisId, value }) =>
        Effect.succeed(
          mapping.gamepadAxes.some((axis) => {
            if (axis.axis !== axisId) return false
            const meetsThreshold = Math.abs(value) >= axis.threshold
            const correctDirection =
              (axis.direction === 'positive' && value > 0) || (axis.direction === 'negative' && value < 0)
            return meetsThreshold && correctDirection
          })
        )
      ),
      Match.orElse(() => Effect.succeed(false))
    )

  // アクションバインド
  const bindAction = (actionName: string, mapping: InputMapping): Effect.Effect<void, KeyBindingError> =>
    Effect.gen(function* () {
      // コンフリクト検出
      const conflicts = yield* detectConflicts(mapping)
      if (conflicts.length > 0) {
        yield* Effect.fail({
          _tag: 'KeyBindingError' as const,
          message: `Binding conflicts detected`,
          conflictingAction: conflicts[0],
        })
      }

      // マッピング追加
      yield* Ref.update(mappingsRef, (current) => ({
        ...current,
        [actionName]: mapping,
      }))
    })

  // アクションアンバインド
  const unbindAction = (actionName: string): Effect.Effect<void, KeyBindingError> =>
    Ref.update(mappingsRef, (current) => {
      const updated = { ...current }
      delete updated[actionName]
      return updated
    })

  // バインディング取得
  const getBinding = (actionName: string): Effect.Effect<InputMapping | null, KeyBindingError> =>
    Effect.gen(function* () {
      const mappings = yield* Ref.get(mappingsRef)
      return mappings[actionName] || null
    })

  // 全バインディング取得
  const getAllBindings = (): Effect.Effect<Record<string, InputMapping>, KeyBindingError> => Ref.get(mappingsRef)

  // コンフリクト検出
  const detectConflicts = (mapping: InputMapping): Effect.Effect<ReadonlyArray<string>, KeyBindingError> =>
    Effect.gen(function* () {
      const mappings = yield* Ref.get(mappingsRef)
      const conflicts: string[] = []

      yield* Effect.forEach(Object.entries(mappings), ([actionName, existing]) =>
        Effect.gen(function* () {
          return yield* Effect.if(Effect.succeed(actionName === mapping.actionName), {
            onTrue: () => Effect.succeed(Option.none<string>()),
            onFalse: () =>
              Effect.gen(function* () {
                const keyConflict = mapping.keys.some((key) => existing.keys.includes(key))
                const mouseConflict = mapping.mouseButtons.some((btn) => existing.mouseButtons.includes(btn))
                const gamepadConflict = mapping.gamepadButtons.some((btn) => existing.gamepadButtons.includes(btn))

                return yield* Effect.succeed(
                  keyConflict || mouseConflict || gamepadConflict ? Option.some(actionName) : Option.none()
                )
              }),
          })
        })
      ).pipe(
        Effect.map((results) =>
          results
            .filter(Option.isSome)
            .map((opt) => Option.getOrNull(opt))
            .filter((x) => x !== null)
        ),
        Effect.map((filtered) => conflicts.push(...filtered))
      )

      return conflicts
    })

  // デフォルトにリセット
  const resetToDefaults = (): Effect.Effect<void, KeyBindingError> => Ref.set(mappingsRef, ALL_DEFAULT_MAPPINGS)

  return {
    loadScheme,
    saveScheme,
    resolveActions,
    bindAction,
    unbindAction,
    getBinding,
    getAllBindings,
    detectConflicts,
    resetToDefaults,
  }
})

// KeyBindingServiceレイヤー
export const KeyBindingServiceLive = Layer.effect(KeyBindingService, makeKeyBindingService)
