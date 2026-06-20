import { Effect } from "effect";
import type { BiomeProperties, BiomeType } from "../domain/biome";
import {
  assembleBiomeChunkEntries,
  buildBiomeChunkSamplingPlan,
  buildOutsideNeighborBiomeMap,
} from "../domain/biome-chunk-assembly";
import {
  BIOME_SCALE,
  RIVER_NOISE_SCALE,
  RIVER_WORLD_OFFSET,
} from "./biome-service.config";
import type { NoiseServiceLike } from "./biome-service-ops-model";

type ChunkBiomeOpsDependencies = {
  noiseService: NoiseServiceLike;
  sampleBaseBiome: (x: number, z: number) => Effect.Effect<BiomeType, never>;
  propsForBiome: (biome: BiomeType) => BiomeProperties;
};

export const createChunkBiomeOps = ({
  noiseService,
  sampleBaseBiome,
  propsForBiome,
}: ChunkBiomeOpsDependencies) => {
  const getBiomesAndPropertiesForChunk = (
    chunkX: number,
    chunkZ: number,
  ): Effect.Effect<
    ReadonlyArray<{ biome: BiomeType; props: BiomeProperties }>
  > =>
    Effect.gen(function* () {
      const samplingPlan = buildBiomeChunkSamplingPlan({
        chunkX,
        chunkZ,
        biomeScale: BIOME_SCALE,
        riverNoiseScale: RIVER_NOISE_SCALE,
        riverWorldOffset: RIVER_WORLD_OFFSET,
      });

      const tempVals = yield* noiseService.octaveNoise2DBatchXY(
        samplingPlan.batchInputs.tempXs,
        samplingPlan.batchInputs.tempZs,
        4,
        0.5,
        2.0,
      );
      const humVals = yield* noiseService.octaveNoise2DBatchXY(
        samplingPlan.batchInputs.humXs,
        samplingPlan.batchInputs.humZs,
        4,
        0.5,
        2.0,
      );
      const terrainChannels = yield* noiseService.sampleTerrainChannels(
        samplingPlan.terrainStartX,
        samplingPlan.terrainStartZ,
      );
      const riverNoiseVals = yield* noiseService.noise2DBatchXY(
        samplingPlan.batchInputs.riverXs,
        samplingPlan.batchInputs.riverZs,
      );

      const outsideNeighborBiomes = yield* Effect.forEach(
        samplingPlan.outsideNeighborCoords,
        ({ x, z }) => sampleBaseBiome(x, z),
        { concurrency: "unbounded" },
      );

      return assembleBiomeChunkEntries({
        chunkX,
        chunkZ,
        climate: {
          temperature: tempVals,
          humidity: humVals,
          continentalness: terrainChannels.continentalness,
          erosion: terrainChannels.erosion,
          pv: terrainChannels.pv,
          riverNoise: riverNoiseVals,
        },
        outsideNeighborBiomesByKey: buildOutsideNeighborBiomeMap({
          coords: samplingPlan.outsideNeighborCoords,
          biomes: outsideNeighborBiomes,
        }),
        propsForBiome,
      });
    });

  return {
    getBiomesAndPropertiesForChunk,
  };
};
