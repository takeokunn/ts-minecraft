import { Effect } from "effect";
import type { BiomeType } from "../domain/biome";
import { buildSampledBiomeData } from "../domain/biome-service-helpers";
import {
  buildBiomeScalarSamplingPlan,
  refineScalarBiome,
} from "../domain/biome-scalar-assembly";
import {
  BIOME_SCALE,
  HUMIDITY_WORLD_OFFSET,
  RIVER_NOISE_SCALE,
  RIVER_WORLD_OFFSET,
} from "./biome-service.config";
import type { NoiseServiceLike } from "./biome-service-ops-model";

export type ScalarBiomeOps = {
  getTemperature: (x: number, z: number) => Effect.Effect<number, never>;
  getHumidity: (x: number, z: number) => Effect.Effect<number, never>;
  sampleBaseBiome: (x: number, z: number) => Effect.Effect<BiomeType, never>;
  getBiome: (x: number, z: number) => Effect.Effect<BiomeType, never>;
};

export const createScalarBiomeOps = (
  noiseService: NoiseServiceLike,
): ScalarBiomeOps => {
  const getTemperature = (
    x: number,
    z: number,
  ): Effect.Effect<number, never> =>
    noiseService.octaveNoise2D(
      x * BIOME_SCALE,
      z * BIOME_SCALE,
      4,
      0.5,
      2.0,
    );

  const getHumidity = (
    x: number,
    z: number,
  ): Effect.Effect<number, never> =>
    noiseService.octaveNoise2D(
      (x + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE,
      (z + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE,
      4,
      0.5,
      2.0,
    );

  const sampleBiomeData = (
    x: number,
    z: number,
  ): Effect.Effect<
    Readonly<{ biome: BiomeType; continentalness: number }>,
    never
  > =>
    Effect.gen(function* () {
      const samplingPlan = buildBiomeScalarSamplingPlan({
        x,
        z,
        biomeScale: BIOME_SCALE,
        humidityWorldOffset: HUMIDITY_WORLD_OFFSET,
        riverNoiseScale: RIVER_NOISE_SCALE,
        riverWorldOffset: RIVER_WORLD_OFFSET,
      });
      const temp = yield* noiseService.octaveNoise2D(
        samplingPlan.tempX,
        samplingPlan.tempZ,
        4,
        0.5,
        2.0,
      );
      const hum = yield* noiseService.octaveNoise2D(
        samplingPlan.humX,
        samplingPlan.humZ,
        4,
        0.5,
        2.0,
      );
      const continentalness = yield* noiseService.continentalness(x, z);
      const erosion = yield* noiseService.erosion(x, z);
      const weirdness = yield* noiseService.weirdness(x, z);
      const riverNoise = yield* noiseService.noise2D(
        samplingPlan.riverX,
        samplingPlan.riverZ,
      );
      return buildSampledBiomeData({
        temperature: temp,
        humidity: hum,
        continentalness,
        erosion,
        weirdness,
        riverNoise,
      });
    });

  const sampleBaseBiome = (
    x: number,
    z: number,
  ): Effect.Effect<BiomeType, never> =>
    Effect.map(sampleBiomeData(x, z), ({ biome }) => biome);

  const getBiome = (
    x: number,
    z: number,
  ): Effect.Effect<BiomeType, never> =>
    Effect.flatMap(sampleBiomeData(x, z), ({ biome, continentalness }) =>
      Effect.gen(function* () {
        const samplingPlan = buildBiomeScalarSamplingPlan({
          x,
          z,
          biomeScale: BIOME_SCALE,
          humidityWorldOffset: HUMIDITY_WORLD_OFFSET,
          riverNoiseScale: RIVER_NOISE_SCALE,
          riverWorldOffset: RIVER_WORLD_OFFSET,
        });
        const neighboringBiomes = yield* Effect.forEach(
          samplingPlan.neighboringCoords,
          ({ x: neighborX, z: neighborZ }) =>
            sampleBaseBiome(neighborX, neighborZ),
          { concurrency: "unbounded" },
        );
        return refineScalarBiome({
          biome,
          continentalness,
          neighboringBiomes,
        });
      }),
    );

  return {
    getTemperature,
    getHumidity,
    sampleBaseBiome,
    getBiome,
  };
};
