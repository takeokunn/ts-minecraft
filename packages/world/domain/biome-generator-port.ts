import type { Effect } from 'effect'
import type { BiomeType, BiomeProperties } from './biome'

export type BiomeGeneratorPort = {
  readonly getBiome: (x: number, z: number) => Effect.Effect<BiomeType, never>
  readonly getBiomeProperties: (biome: BiomeType) => Effect.Effect<BiomeProperties, never>
  readonly getBiomesAndPropertiesForChunk: (
    chunkX: number,
    chunkZ: number,
  ) => Effect.Effect<ReadonlyArray<{ readonly biome: BiomeType; readonly props: BiomeProperties }>>
}
