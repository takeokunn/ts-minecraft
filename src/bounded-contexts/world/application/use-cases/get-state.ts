import { Context } from 'effect'
import type { Effect } from 'effect/Effect'
import type { GameApplicationState } from '../../../../application/types'

export interface GetGameApplicationState {
  readonly execute: () => Effect<GameApplicationState, never, never>
}

export const GetGameApplicationState = Context.GenericTag<GetGameApplicationState>(
  '@mc/bc-world/application/use-cases/GetGameApplicationState'
)
