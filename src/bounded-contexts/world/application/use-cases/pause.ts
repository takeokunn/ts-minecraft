import { Context } from 'effect'
import type { Effect } from 'effect/Effect'
import type { GameApplicationStateError } from '../../../../application/errors'

export interface PauseGameApplication {
  readonly execute: () => Effect<void, GameApplicationStateError, never>
}

export const PauseGameApplication = Context.GenericTag<PauseGameApplication>(
  '@mc/bc-world/application/use-cases/PauseGameApplication'
)
