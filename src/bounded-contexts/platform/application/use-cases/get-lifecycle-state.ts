import { Context } from 'effect'
import type { Effect } from 'effect/Effect'
import type { ApplicationLifecycleState } from '../../../../application/types'

export interface GetLifecycleState {
  readonly execute: () => Effect<ApplicationLifecycleState, never, never>
}

export const GetLifecycleState = Context.GenericTag<GetLifecycleState>(
  '@mc/platform/application/use-cases/GetLifecycleState'
)
