import { Context, Effect } from 'effect'
import { Schema } from '@effect/schema'

// シーンタイプの定義
export const SceneType = Schema.Literal('MainMenu', 'Game', 'Loading', 'Pause', 'Settings')
export type SceneType = Schema.Schema.Type<typeof SceneType>

// シーンの基本構造
export const SceneData = Schema.Struct({
  id: Schema.String.pipe(Schema.nonEmptyString()),
  type: SceneType,
  isActive: Schema.Boolean,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type SceneData = Schema.Schema.Type<typeof SceneData>

// シーン遷移データ
export const SceneTransition = Schema.Struct({
  from: Schema.optional(SceneType),
  to: SceneType,
  duration: Schema.optional(Schema.Number.pipe(Schema.positive())),
  fadeType: Schema.optional(Schema.Literal('none', 'fade', 'slide', 'zoom')),
})
export type SceneTransition = Schema.Schema.Type<typeof SceneTransition>

// シーンエラー定義
export const SceneTransitionErrorSchema = Schema.Struct({
  _tag: Schema.Literal('SceneTransitionError'),
  message: Schema.String,
  currentScene: Schema.optional(SceneType),
  targetScene: SceneType,
})

export type SceneTransitionError = Schema.Schema.Type<typeof SceneTransitionErrorSchema>

export const SceneTransitionError = (params: Omit<SceneTransitionError, '_tag'>): SceneTransitionError => ({
  _tag: 'SceneTransitionError' as const,
  ...params,
})

export const SceneInitializationErrorSchema = Schema.Struct({
  _tag: Schema.Literal('SceneInitializationError'),
  message: Schema.String,
  sceneType: SceneType,
})

export type SceneInitializationError = Schema.Schema.Type<typeof SceneInitializationErrorSchema>

export const SceneInitializationError = (params: Omit<SceneInitializationError, '_tag'>): SceneInitializationError => ({
  _tag: 'SceneInitializationError' as const,
  ...params,
})

export const SceneCleanupErrorSchema = Schema.Struct({
  _tag: Schema.Literal('SceneCleanupError'),
  message: Schema.String,
  sceneType: SceneType,
})

export type SceneCleanupError = Schema.Schema.Type<typeof SceneCleanupErrorSchema>

export const SceneCleanupError = (params: Omit<SceneCleanupError, '_tag'>): SceneCleanupError => ({
  _tag: 'SceneCleanupError' as const,
  ...params,
})

// シーンの基本インターフェース
export interface Scene {
  readonly data: SceneData
  readonly initialize: () => Effect.Effect<void, SceneInitializationError>
  readonly update: (deltaTime: number) => Effect.Effect<void>
  readonly render: () => Effect.Effect<void>
  readonly cleanup: () => Effect.Effect<void, SceneCleanupError>
  readonly onEnter: () => Effect.Effect<void>
  readonly onExit: () => Effect.Effect<void>
}

// シーンサービスのコンテキスト
export const Scene = Context.GenericTag<Scene>('@minecraft/domain/Scene')
