import { Context, Effect } from 'effect'
import type { PlayerAggregate, PlayerId } from './index'
import { PlayerErrorBuilders } from './index'

export interface PlayerRepositoryService {
  readonly upsert: (aggregate: PlayerAggregate) => Effect.Effect<void, never>
  readonly findById: (id: PlayerId) => Effect.Effect<PlayerAggregate, ReturnType<typeof PlayerErrorBuilders.missing>>
  readonly remove: (id: PlayerId) => Effect.Effect<boolean, ReturnType<typeof PlayerErrorBuilders.missing>>
  readonly list: Effect.Effect<ReadonlyArray<PlayerAggregate>, never>
  readonly exists: (id: PlayerId) => Effect.Effect<boolean, never>
}

export const PlayerRepository = Context.Tag<PlayerRepositoryService>('@domain/player/repository')
