import { Context, Effect } from 'effect'
import { LoadError, PreloadError, SaveError, SaveId, SceneType, TransitionEffect, TransitionError } from './types'

export interface SceneService {
  readonly transitionTo: (scene: SceneType, effect?: TransitionEffect) => Effect.Effect<void, TransitionError>

  readonly getCurrentScene: () => Effect.Effect<SceneType, never>

  readonly saveState: () => Effect.Effect<void, SaveError>

  readonly loadState: (saveId: SaveId) => Effect.Effect<void, LoadError>

  readonly handleError: (error: unknown) => Effect.Effect<void, never>

  readonly preloadScene: (scene: SceneType) => Effect.Effect<void, PreloadError>
}

export const SceneService = Context.GenericTag<SceneService>('@minecraft/domain/SceneService')
