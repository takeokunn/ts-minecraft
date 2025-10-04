import { Context } from 'effect'
import type { Effect } from 'effect/Effect'
import type { GameApplicationStateError } from '../../../../application/errors'
import type { GameApplicationConfigInput } from '../../../../application/types'

export interface UpdateGameApplicationConfig {
  readonly execute: (
    config: Partial<GameApplicationConfigInput>
  ) => Effect<void, GameApplicationStateError, never>
}

export const UpdateGameApplicationConfig = Context.GenericTag<UpdateGameApplicationConfig>(
  '@mc/platform/application/use-cases/UpdateGameApplicationConfig'
)
