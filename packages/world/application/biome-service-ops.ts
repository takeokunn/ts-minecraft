import { Effect } from "effect";
import type { BiomeType, BiomeProperties } from "../domain/biome";
import { BIOME_PROPERTIES } from "../domain/biome-properties";
import { createChunkBiomeOps } from "./biome-service-chunk-ops";
import type { NoiseServiceLike } from "./biome-service-ops-model";
import { createScalarBiomeOps } from "./biome-service-scalar-ops";

export const createBiomeServiceOps = (noiseService: NoiseServiceLike) => {
  const { getTemperature, getHumidity, sampleBaseBiome, getBiome } =
    createScalarBiomeOps(noiseService);

  const getBiomeProperties = (
    biome: BiomeType,
  ): Effect.Effect<BiomeProperties, never, never> =>
    Effect.succeed(BIOME_PROPERTIES[biome]);

  const { getBiomesAndPropertiesForChunk } = createChunkBiomeOps({
    noiseService,
    sampleBaseBiome,
    propsForBiome: (biome) => BIOME_PROPERTIES[biome],
  });

  return {
    getBiome,
    getBiomeProperties,
    getTemperature,
    getHumidity,
    getBiomesAndPropertiesForChunk,
  };
};
