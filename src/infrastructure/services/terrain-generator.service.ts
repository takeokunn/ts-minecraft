import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { ChunkCoordinates } from '@/domain/value-objects/coordinates/chunk-coordinates.value'

export interface TerrainGeneratorInterface {
  readonly generateChunkTerrain: (coords: ChunkCoordinates) => Effect.Effect<{ blocks: Uint8Array; heightMap: number[] }, never, never>
  readonly getHeightAt: (worldX: number, worldZ: number) => Effect.Effect<number, never, never>
  readonly generateHeightMap: (startX: number, startZ: number, width: number, depth: number) => Effect.Effect<number[], never, never>
  readonly getBiomeAt: (worldX: number, worldZ: number) => Effect.Effect<string, never, never>
  readonly setSeed: (seed: number) => Effect.Effect<void, never, never>
  readonly getSeed: () => Effect.Effect<number, never, never>
  readonly getConfig: () => Effect.Effect<any, never, never>
}

export class TerrainGenerator extends Context.GenericTag('TerrainGenerator')<
  TerrainGenerator,
  TerrainGeneratorInterface
>() {}