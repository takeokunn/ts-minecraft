import { Context, Effect } from 'effect'
import type { ActiveScene, SaveId } from './index'
import { LoadError, PreloadError, SaveError, SceneState, TransitionEffect, TransitionError } from './index'

export interface SceneService {
  readonly transitionTo: (scene: ActiveScene, effect?: TransitionEffect) => Effect.Effect<SceneState, TransitionError>

  readonly current: () => Effect.Effect<SceneState>

  readonly saveSnapshot: () => Effect.Effect<void, SaveError>

  readonly restoreFrom: (saveId: SaveId) => Effect.Effect<SceneState, LoadError>

  readonly registerFailure: (error: Error) => Effect.Effect<SceneState>

  readonly preload: (scene: ActiveScene) => Effect.Effect<void, PreloadError>
}

export const SceneService = Context.GenericTag<SceneService>('@minecraft/domain/SceneService')
