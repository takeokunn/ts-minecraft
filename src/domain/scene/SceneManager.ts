import { Context, Effect, Match, Schema } from 'effect'
import { Scene, SceneData, SceneTransition, SceneTransitionError, SceneType } from './Scene'

// シーンスタック管理用のスキーマ
export const SceneStack = Schema.Array(SceneData)
export type SceneStack = Schema.Schema.Type<typeof SceneStack>

// シーンマネージャーの状態
export const SceneManagerState = Schema.Struct({
  currentScene: Schema.optional(SceneData),
  sceneStack: SceneStack,
  isTransitioning: Schema.Boolean,
  transitionProgress: Schema.Number.pipe(Schema.between(0, 1)),
})
export type SceneManagerState = Schema.Schema.Type<typeof SceneManagerState>

// シーンマネージャーサービスインターフェース
export interface SceneManager {
  readonly getCurrentScene: () => Effect.Effect<SceneData | undefined>
  readonly getState: () => Effect.Effect<SceneManagerState>
  readonly transitionTo: (
    sceneType: SceneType,
    transition?: SceneTransition
  ) => Effect.Effect<void, SceneTransitionError>
  readonly pushScene: (sceneType: SceneType) => Effect.Effect<void, SceneTransitionError>
  readonly popScene: () => Effect.Effect<void, SceneTransitionError>
  readonly createScene: (sceneType: SceneType) => Effect.Effect<Scene, SceneTransitionError>
  readonly update: (deltaTime: number) => Effect.Effect<void>
  readonly render: () => Effect.Effect<void>
  readonly cleanup: () => Effect.Effect<void>
}

// SceneManagerサービスのコンテキスト
export const SceneManager = Context.GenericTag<SceneManager>('@domain/scene/SceneManager')

// Match.valueを使った型安全なシーン処理
export const processSceneType = <A>(
  sceneType: SceneType,
  handlers: {
    readonly MainMenu: () => A
    readonly Game: () => A
    readonly Loading: () => A
    readonly Pause: () => A
    readonly Settings: () => A
  }
): A => {
  // Match.valueの型推論の制限を回避するため、明示的に各ハンドラーを呼び出す
  if (sceneType === 'MainMenu') return handlers.MainMenu()
  if (sceneType === 'Game') return handlers.Game()
  if (sceneType === 'Loading') return handlers.Loading()
  if (sceneType === 'Pause') return handlers.Pause()
  if (sceneType === 'Settings') return handlers.Settings()

  // 型システムにより、ここには到達しない（exhaustive check）
  const _exhaustive: never = sceneType
  throw new Error(`Unknown scene type: ${_exhaustive}`)
}
