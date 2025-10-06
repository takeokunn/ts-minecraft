import { Context, Effect, Stream } from 'effect'
import { ChunkEvent } from './index'
import { ChunkSystemError, ChunkSystemState } from './index'

export interface ChunkSystemRepository {
  readonly load: Effect.Effect<ChunkSystemState, ChunkSystemError>
  readonly save: (state: ChunkSystemState, events: ReadonlyArray<ChunkEvent>) => Effect.Effect<void, ChunkSystemError>
  readonly observe: Stream.Stream<ChunkEvent, ChunkSystemError>
}

export const ChunkSystemRepository = Context.Tag<ChunkSystemRepository>(
  '@minecraft/domain/chunk_system/ChunkSystemRepository'
)
