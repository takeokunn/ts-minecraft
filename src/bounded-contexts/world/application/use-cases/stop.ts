import { Context } from 'effect'
import type { Effect } from 'effect/Effect'
import type { GameApplicationRuntimeError } from '../../../../application/errors'

export interface StopGameApplication {
  readonly execute: () => Effect<void, GameApplicationRuntimeError, never>
}

export const StopGameApplication = Context.GenericTag<StopGameApplication>(
  '@mc/bc-world/application/use-cases/StopGameApplication'
)
