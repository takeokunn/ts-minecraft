import { Effect, Context, Stream } from 'effect'
import { ChunkEvent } from './events.js'
import { ChunkSystemError, ChunkSystemState } from './types.js'

export interface ChunkSystemRepository {
  readonly load: Effect.Effect<ChunkSystemState, ChunkSystemError>
  readonly save: (
    state: ChunkSystemState,
    events: ReadonlyArray<ChunkEvent>
  ) => Effect.Effect<void, ChunkSystemError>
  readonly observe: Stream.Stream<ChunkEvent, ChunkSystemError>
}

export const ChunkSystemRepository = Context.GenericTag<ChunkSystemRepository>(
  '@minecraft/domain/chunk_system/ChunkSystemRepository'
)
