import { Array as Arr, Effect } from 'effect'
import { NoiseServicePort } from '../domain/noise-service-port'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'
import {
  BIOME_PROPERTIES,
  BIOME_SCALE,
  HUMIDITY_WORLD_OFFSET,
  RIVER_NOISE_SCALE,
  RIVER_WORLD_OFFSET,
} from './biome-service.config'
import type { BiomeType, BiomeProperties } from '../domain/biome'
import {
  classifyBiomeFromClimate,
  buildChunkNoiseInputs,
  batchTerrainIndexFor,
  peaksAndValleysFromWeirdness,
  refineBeachBiome,
} from '../domain/biome-classifier'

// ─── Service ─────────────────────────────────────────────────────────────────

export class BiomeService extends Effect.Service<BiomeService>()(
  '@minecraft/application/BiomeService',
  {
    effect: Effect.map(NoiseServicePort, (noiseService) => {
      const getTemperature = (x: number, z: number): Effect.Effect<number, never> =>
        noiseService.octaveNoise2D(x * BIOME_SCALE, z * BIOME_SCALE, 4, 0.5, 2.0)

      const getHumidity = (x: number, z: number): Effect.Effect<number, never> =>
        noiseService.octaveNoise2D((x + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE, (z + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE, 4, 0.5, 2.0)

      const getBiome = (x: number, z: number): Effect.Effect<BiomeType, never> =>
        Effect.all([
          getTemperature(x, z),
          getHumidity(x, z),
          noiseService.continentalness(x, z),
          noiseService.erosion(x, z),
          noiseService.weirdness(x, z),
          noiseService.noise2D(x * RIVER_NOISE_SCALE + RIVER_WORLD_OFFSET, z * RIVER_NOISE_SCALE + RIVER_WORLD_OFFSET),
        ], { concurrency: 'unbounded' }).pipe(
          Effect.map(([temp, hum, continentalness, erosion, weirdness, riverNoise]) =>
            classifyBiomeFromClimate({
              temperature: temp,
              humidity: hum,
              continentalness,
              erosion,
              pv: peaksAndValleysFromWeirdness(weirdness),
              riverNoise,
            })
          )
        )

      const getBiomeProperties = (biome: BiomeType): Effect.Effect<BiomeProperties, never, never> =>
        Effect.succeed(BIOME_PROPERTIES[biome])

      const getBiomesAndPropertiesForChunk = (
        chunkX: number,
        chunkZ: number,
      ): Effect.Effect<ReadonlyArray<{ biome: BiomeType; props: BiomeProperties }>> => {
        const coords = buildChunkNoiseInputs(chunkX, chunkZ)
        return Effect.all(
          [
            noiseService.octaveNoise2DBatchXY(
              Arr.map(coords, (c) => c.tempX),
              Arr.map(coords, (c) => c.tempZ),
              4, 0.5, 2.0,
            ),
            noiseService.octaveNoise2DBatchXY(
              Arr.map(coords, (c) => c.humX),
              Arr.map(coords, (c) => c.humZ),
              4, 0.5, 2.0,
            ),
            noiseService.sampleTerrainChannels(chunkX * CHUNK_SIZE, chunkZ * CHUNK_SIZE),
            noiseService.noise2DBatchXY(
              Arr.map(coords, (c) => c.tempX * (RIVER_NOISE_SCALE / BIOME_SCALE) + RIVER_WORLD_OFFSET),
              Arr.map(coords, (c) => c.tempZ * (RIVER_NOISE_SCALE / BIOME_SCALE) + RIVER_WORLD_OFFSET),
            ),
          ],
          { concurrency: 'unbounded' },
        ).pipe(
          Effect.flatMap(([tempVals, humVals, terrainChannels, riverNoiseVals]) => {
            const baseBiomes = Arr.makeBy(coords.length, (i) => {
              const terrainIdx = batchTerrainIndexFor(i)
              return classifyBiomeFromClimate({
                temperature: tempVals[i]!,
                humidity: humVals[i]!,
                continentalness: terrainChannels.continentalness[terrainIdx]!,
                erosion: terrainChannels.erosion[terrainIdx]!,
                pv: terrainChannels.pv[terrainIdx]!,
                riverNoise: riverNoiseVals[i]!,
              })
            })
            return Effect.forEach(
              Arr.makeBy(coords.length, (i) => i),
              (i) => {
                const lx = Math.floor(i / CHUNK_SIZE)
                const lz = i % CHUNK_SIZE
                const worldX = chunkX * CHUNK_SIZE + lx
                const worldZ = chunkZ * CHUNK_SIZE + lz
                const biome = baseBiomes[i]!
                const terrainIdx = batchTerrainIndexFor(i)
                return Effect.all([
                  getBiome(worldX - 1, worldZ),
                  getBiome(worldX + 1, worldZ),
                  getBiome(worldX, worldZ - 1),
                  getBiome(worldX, worldZ + 1),
                ], { concurrency: 'unbounded' }).pipe(
                  Effect.map((neighbors) => {
                    const refinedBiome = refineBeachBiome(
                      biome,
                      neighbors,
                      terrainChannels.continentalness[terrainIdx]!,
                    )
                    return { biome: refinedBiome, props: BIOME_PROPERTIES[refinedBiome] }
                  }),
                )
              },
              { concurrency: 'unbounded' },
            )
          })
        )
      }

      return { getBiome, getBiomeProperties, getTemperature, getHumidity, getBiomesAndPropertiesForChunk }
    }),
  }
) {}
export const BiomeServiceLive = BiomeService.Default
