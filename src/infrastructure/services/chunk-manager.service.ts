import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { ChunkCoordinates } from '@/domain/value-objects/coordinates/chunk-coordinates.value'
import { Chunk } from '@/domain/entities/components/world/chunk'

export interface ChunkManagerInterface {
  readonly loadChunk: (coords: ChunkCoordinates) => Effect.Effect<Chunk, never, never>
  readonly unloadChunk: (coords: ChunkCoordinates) => Effect.Effect<void, never, never>
  readonly getChunk: (coords: ChunkCoordinates) => Effect.Effect<Chunk | null, never, never>
  readonly isChunkLoaded: (coords: ChunkCoordinates) => Effect.Effect<boolean, never, never>
  readonly getLoadedChunks: () => Effect.Effect<ChunkCoordinates[], never, never>
  readonly setRenderDistance: (distance: number) => Effect.Effect<void, never, never>
  readonly updateChunk: (coords: ChunkCoordinates, chunk: Chunk) => Effect.Effect<void, never, never>
}

export class ChunkManager extends Context.GenericTag('ChunkManager')<
  ChunkManager,
  ChunkManagerInterface
>() {}