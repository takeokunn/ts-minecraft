import { Context } from 'effect'
import type { Effect } from 'effect/Effect'
import type { GameApplicationRuntimeError } from '../../../../application/errors'

export interface StartGameApplication {
  readonly execute: () => Effect<void, GameApplicationRuntimeError, never>
}

export const StartGameApplication = Context.GenericTag<StartGameApplication>(
  '@mc/bc-world/application/use-cases/StartGameApplication'
)
