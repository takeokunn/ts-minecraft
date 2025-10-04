import { Context, Effect, Either, Option, Schema } from 'effect'
import {
  ActiveScene,
  ActiveSceneSchema,
  PreloadError,
  SceneState,
  SceneStateSchema,
  TransitionEffect,
  TransitionError,
} from '../types'

export const SceneManagerStateSchema = Schema.Struct({
  current: SceneStateSchema,
  stack: Schema.Array(ActiveSceneSchema),
  isTransitioning: Schema.Boolean,
  history: Schema.Array(SceneStateSchema),
})

export type SceneManagerState = Schema.Schema.Type<typeof SceneManagerStateSchema>

export interface SceneManager {
  readonly current: () => Effect.Effect<SceneState>
  readonly state: () => Effect.Effect<SceneManagerState>
  readonly transitionTo: (scene: ActiveScene, effect?: TransitionEffect) => Effect.Effect<SceneState, TransitionError>
  readonly push: (scene: ActiveScene, effect?: TransitionEffect) => Effect.Effect<SceneState, TransitionError>
  readonly pop: (effect?: TransitionEffect) => Effect.Effect<SceneState, TransitionError>
  readonly preload: (scene: ActiveScene) => Effect.Effect<void, PreloadError>
  readonly reset: (scene?: ActiveScene) => Effect.Effect<SceneState, TransitionError>
  readonly history: () => Effect.Effect<ReadonlyArray<SceneState>>
}

export const SceneManager = Context.GenericTag<SceneManager>('@minecraft/domain/SceneManager')

export const sceneManagerState = {
  make: (params: {
    readonly current: SceneState
    readonly stack?: ReadonlyArray<ActiveScene>
    readonly isTransitioning?: boolean
    readonly history?: ReadonlyArray<SceneState>
  }): SceneManagerState => ({
    current: params.current,
    stack: params.stack ?? [],
    isTransitioning: params.isTransitioning ?? false,
    history: params.history ?? [params.current],
  }),

  toOptionActive: (scene: SceneState): Option.Option<ActiveScene> => {
    const decoded = Schema.decodeEither(ActiveSceneSchema)(scene)
    return Either.match(decoded, {
      onLeft: () => Option.none<ActiveScene>(),
      onRight: (active) => Option.some(active),
    })
  },
}
