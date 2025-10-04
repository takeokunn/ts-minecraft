import { Context } from 'effect'
import type { Effect } from 'effect/Effect'
import type { GameApplicationRuntimeError } from '../../../../application/errors'

export interface ResetGameApplication {
  readonly execute: () => Effect<void, GameApplicationRuntimeError, never>
}

export const ResetGameApplication = Context.GenericTag<ResetGameApplication>(
  '@mc/bc-world/application/use-cases/ResetGameApplication'
)
