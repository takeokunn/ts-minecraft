import { Context } from 'effect'
import type { Effect } from 'effect/Effect'
import type { GameApplicationInitError } from '../../../../application/errors'
import type { GameApplicationConfigInput } from '../../../../application/types'

export interface InitializeGameApplication {
  readonly execute: (
    config?: Partial<GameApplicationConfigInput>
  ) => Effect<void, GameApplicationInitError, never>
}

export const InitializeGameApplication = Context.GenericTag<InitializeGameApplication>(
  '@mc/bc-world/application/use-cases/InitializeGameApplication'
)
