import { Context } from 'effect'
import type { Effect } from 'effect/Effect'
import type { GameApplicationRuntimeError } from '../../../../application/errors'
import type { Milliseconds } from '../../../../application/types'

export interface TickGameApplication {
  readonly execute: (deltaTime?: Milliseconds) => Effect<void, GameApplicationRuntimeError, never>
}

export const TickGameApplication = Context.GenericTag<TickGameApplication>(
  '@mc/bc-world/application/use-cases/TickGameApplication'
)
