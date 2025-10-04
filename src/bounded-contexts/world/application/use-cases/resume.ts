import { Context } from 'effect'
import type { Effect } from 'effect/Effect'
import type { GameApplicationStateError } from '../../../../application/errors'

export interface ResumeGameApplication {
  readonly execute: () => Effect<void, GameApplicationStateError, never>
}

export const ResumeGameApplication = Context.GenericTag<ResumeGameApplication>(
  '@mc/bc-world/application/use-cases/ResumeGameApplication'
)
