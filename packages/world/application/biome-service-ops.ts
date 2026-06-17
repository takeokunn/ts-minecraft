import { Effect } from "effect";
import { CHUNK_SIZE } from "@ts-minecraft/core";
import type { BiomeType, BiomeProperties } from "../domain/biome";
import {
  classifyBiomeFromClimate,
  peaksAndValleysFromWeirdness,
  refineBeachBiome,
} from "../domain/biome-classifier";
import {
  buildChunkBaseBiomes,
  collectOutsideChunkNeighborCoords,
} from "../domain/biome-chunk";
import {
  BIOME_PROPERTIES,
  BIOME_SCALE,
  HUMIDITY_WORLD_OFFSET,
  RIVER_NOISE_SCALE,
  RIVER_WORLD_OFFSET,
} from "./biome-service.config";
import {
  buildBiomeChunkEntries,
  buildBiomeChunkNoiseBatchInputs,
} from "../domain/biome-service-helpers";

type NoiseServiceLike = {
  octaveNoise2D: (
    x: number,
    z: number,
    octaves: number,
    persistence: number,
    lacunarity: number,
  ) => Effect.Effect<number, never>;
  noise2D: (x: number, z: number) => Effect.Effect<number, never>;
  octaveNoise2DBatchXY: (
    xs: ReadonlyArray<number>,
    zs: ReadonlyArray<number>,
    octaves: number,
    persistence: number,
    lacunarity: number,
  ) => Effect.Effect<ReadonlyArray<number>>;
  noise2DBatchXY: (
    xs: ReadonlyArray<number>,
    zs: ReadonlyArray<number>,
  ) => Effect.Effect<ReadonlyArray<number>>;
  sampleTerrainChannels: (
    xStart: number,
    zStart: number,
  ) => Effect.Effect<{
    readonly continentalness: Float64Array;
    readonly erosion: Float64Array;
    readonly pv: Float64Array;
    readonly jaggedness: Float64Array;
  }>;
  continentalness: (x: number, z: number) => Effect.Effect<number, never>;
  erosion: (x: number, z: number) => Effect.Effect<number, never>;
  weirdness: (x: number, z: number) => Effect.Effect<number, never>;
};

export const createBiomeServiceOps = (noiseService: NoiseServiceLike) => {
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
      const temp = yield* getTemperature(x, z);
      const hum = yield* getHumidity(x, z);
      const continentalness = yield* noiseService.continentalness(x, z);
      const erosion = yield* noiseService.erosion(x, z);
      const weirdness = yield* noiseService.weirdness(x, z);
      const riverNoise = yield* noiseService.noise2D(
        x * RIVER_NOISE_SCALE + RIVER_WORLD_OFFSET,
        z * RIVER_NOISE_SCALE + RIVER_WORLD_OFFSET,
      );
      return {
        biome: classifyBiomeFromClimate({
          temperature: temp,
          humidity: hum,
          continentalness,
          erosion,
          pv: peaksAndValleysFromWeirdness(weirdness),
          riverNoise,
        }),
        continentalness,
      };
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
        const [left, right, north, south] = yield* Effect.all(
          [
            sampleBaseBiome(x - 1, z),
            sampleBaseBiome(x + 1, z),
            sampleBaseBiome(x, z - 1),
            sampleBaseBiome(x, z + 1),
          ],
          { concurrency: "unbounded" },
        );
        return refineBeachBiome(
          biome,
          [left, right, north, south],
          continentalness,
        );
      }),
    );

  const getBiomeProperties = (
    biome: BiomeType,
  ): Effect.Effect<BiomeProperties, never, never> =>
    Effect.succeed(BIOME_PROPERTIES[biome]);

  const getBiomesAndPropertiesForChunk = (
    chunkX: number,
    chunkZ: number,
  ): Effect.Effect<
    ReadonlyArray<{ biome: BiomeType; props: BiomeProperties }>
  > =>
    Effect.gen(function* () {
      const batchInputs = buildBiomeChunkNoiseBatchInputs({
        chunkX,
        chunkZ,
        biomeScale: BIOME_SCALE,
        riverNoiseScale: RIVER_NOISE_SCALE,
        riverWorldOffset: RIVER_WORLD_OFFSET,
      });

      const tempVals = yield* noiseService.octaveNoise2DBatchXY(
        batchInputs.tempXs,
        batchInputs.tempZs,
        4,
        0.5,
        2.0,
      );
      const humVals = yield* noiseService.octaveNoise2DBatchXY(
        batchInputs.humXs,
        batchInputs.humZs,
        4,
        0.5,
        2.0,
      );
      const terrainChannels = yield* noiseService.sampleTerrainChannels(
        chunkX * CHUNK_SIZE,
        chunkZ * CHUNK_SIZE,
      );
      const riverNoiseVals = yield* noiseService.noise2DBatchXY(
        batchInputs.riverXs,
        batchInputs.riverZs,
      );

      const baseBiomes = buildChunkBaseBiomes({
        temperature: tempVals,
        humidity: humVals,
        continentalness: terrainChannels.continentalness,
        erosion: terrainChannels.erosion,
        pv: terrainChannels.pv,
        riverNoise: riverNoiseVals,
      });

      const outsideNeighborCoords = collectOutsideChunkNeighborCoords(
        chunkX,
        chunkZ,
      );

      const outsideNeighborBiomesByKey = new Map<string, BiomeType>();
      for (const { x, z } of outsideNeighborCoords) {
        outsideNeighborBiomesByKey.set(x + "," + z, yield* sampleBaseBiome(x, z));
      }

      return buildBiomeChunkEntries({
        chunkX,
        chunkZ,
        baseBiomes,
        continentalness: terrainChannels.continentalness,
        outsideNeighborBiomesByKey,
        propsForBiome: (biome) => BIOME_PROPERTIES[biome],
      });
    });

  return {
    getBiome,
    getBiomeProperties,
    getTemperature,
    getHumidity,
    getBiomesAndPropertiesForChunk,
  };
};
