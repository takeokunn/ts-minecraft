import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { BiomeService, BiomeServiceLive } from '@/application/biome/biome-service'
import { NoiseServicePort } from '@/application/noise/noise-service-port'

/**
 * BiomeService uses these scaled coordinates:
 *   temperature: octaveNoise2D(x * 0.005, z * 0.005, 4, 0.5, 2.0)
 *   humidity:    octaveNoise2D((x+10000) * 0.005, (z+10000) * 0.005, 4, 0.5, 2.0)
 *
 * To distinguish the two calls we check whether the raw x argument is > 25.0
 * (because at any world coordinate x in [-2000, 2000] the temperature x-scaled
 * argument never exceeds 10, while the humidity offset puts the x-argument at
 * least at 50.0 when the world coord is 0).
 *
 * Threshold: x_arg > 25.0  →  humidity call
 *            x_arg ≤ 25.0  →  temperature call
 */
const makeMockNoiseLayer = (tempValue: number, humidityValue: number) =>
  Layer.succeed(NoiseServicePort, {
    noise2D: (_x: number, _z: number): Effect.Effect<number, never> => Effect.succeed(0.5),

    octaveNoise2D: (x: number, _z: number, _octaves: number, _persistence: number, _lacunarity: number): Effect.Effect<number, never> => {
      // Temperature call: x = worldX * 0.005  (small, ≤ 25 for any reasonable worldX)
      // Humidity call:    x = (worldX + 10000) * 0.005  (always ≥ 50 when worldX ≥ 0)
      // Using threshold of 25 to distinguish the two calls.
      return Effect.succeed(x > 25.0 ? humidityValue : tempValue)
    },

    setSeed: (_seed: number): Effect.Effect<void, never> => Effect.void,
  } as unknown as NoiseServicePort)

/**
 * Build a BiomeService layer that uses the mock NoiseService.
 */
const makeTestLayer = (tempValue: number, humidityValue: number) =>
  BiomeServiceLive.pipe(
    Layer.provide(makeMockNoiseLayer(tempValue, humidityValue))
  )

describe('application/biome/biome-service', () => {
  describe('BiomeService interface', () => {
    it.effect('should expose getBiome, getBiomeProperties, getTemperature, getHumidity', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        expect(typeof service.getBiome).toBe('function')
        expect(typeof service.getBiomeProperties).toBe('function')
        expect(typeof service.getTemperature).toBe('function')
        expect(typeof service.getHumidity).toBe('function')
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )
  })

  describe('getBiome — biome classification', () => {
    it.effect('should return PLAINS for temperate temperature and moderate-dry humidity (temp=0.5, hum=0.45)', () =>
      // temp=0.5 → not cold, not hot (temperate)
      // hum=0.45 → not dry (<0.3), not wet (>0.6) → falls through to default PLAINS
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('PLAINS')
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )

    it.effect('should return DESERT for hot temperature and low humidity (temp=0.8, hum=0.15)', () =>
      // hum=0.15 → not below 0.15 extreme, isHot (temp>0.7), isWet false → DESERT
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('DESERT')
      }).pipe(Effect.provide(makeTestLayer(0.8, 0.15)))
    )

    it.effect('should return FOREST for temperate temperature and wet humidity (temp=0.5, hum=0.7)', () =>
      // temp=0.5 → temperate; hum=0.7 → isWet (>0.6), not >0.85 → FOREST
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('FOREST')
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.7)))
    )

    it.effect('should return OCEAN for cold temperature and very high humidity (temp=0.2, hum=0.9)', () =>
      // hum=0.9 → >0.85, temp=0.2 → not >0.6 → OCEAN
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('OCEAN')
      }).pipe(Effect.provide(makeTestLayer(0.2, 0.9)))
    )

    it.effect('should return MOUNTAINS for cold temperature and moderate-high humidity (temp=0.1, hum=0.5)', () =>
      // isCold (temp<0.3): hum=0.5 > 0.4 → MOUNTAINS
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('MOUNTAINS')
      }).pipe(Effect.provide(makeTestLayer(0.1, 0.5)))
    )

    it.effect('should return SNOW for cold temperature and low humidity (temp=0.1, hum=0.3)', () =>
      // isCold (temp<0.3): hum=0.3 not > 0.4 → SNOW
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('SNOW')
      }).pipe(Effect.provide(makeTestLayer(0.1, 0.3)))
    )

    it.effect('should return SWAMP for warm temperature and very high humidity (temp=0.7, hum=0.9)', () =>
      // hum=0.9 → >0.85, temp=0.7 → >0.6 → SWAMP
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('SWAMP')
      }).pipe(Effect.provide(makeTestLayer(0.7, 0.9)))
    )

    it.effect('should return JUNGLE for hot temperature and wet humidity (temp=0.8, hum=0.75)', () =>
      // isHot (temp>0.7): isWet (hum>0.6), hum=0.75 not >0.85 → JUNGLE
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('JUNGLE')
      }).pipe(Effect.provide(makeTestLayer(0.8, 0.75)))
    )
  })

  describe('getBiome — threshold boundary tests', () => {
    it.effect('should return SNOW when humidity is just below 0.15 extreme-dry threshold (temp=0.5, hum=0.14)', () =>
      // hum < 0.15, not cold → DESERT; but isCold=false → DESERT
      // Re-reading: "if (humidity < 0.15) return isCold ? 'SNOW' : 'DESERT'"
      // temp=0.5 → not cold → DESERT
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('DESERT')
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.14)))
    )

    it.effect('should return SNOW when cold and humidity is below extreme-dry threshold (temp=0.2, hum=0.14)', () =>
      // hum < 0.15, isCold (temp<0.3) → SNOW
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('SNOW')
      }).pipe(Effect.provide(makeTestLayer(0.2, 0.14)))
    )

    it.effect('should return PLAINS for temperate dry boundary (temp=0.5, hum=0.29)', () =>
      // temp=0.5 → temperate; hum=0.29 < 0.3 → isDry → PLAINS
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('PLAINS')
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.29)))
    )

    it.effect('should return PLAINS for temperate middle humidity (temp=0.5, hum=0.45) — not wet, not dry', () =>
      // temp=0.5 → temperate; hum=0.45 → not dry (<0.3), not wet (>0.6) → default PLAINS
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('PLAINS')
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )

    it.effect('should return FOREST at wet humidity boundary (temp=0.5, hum=0.61)', () =>
      // temp=0.5 → temperate; hum=0.61 > 0.6 → isWet, not > 0.85 → FOREST
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('FOREST')
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.61)))
    )

    it.effect('should return SWAMP at very high humidity boundary (temp=0.65, hum=0.86)', () =>
      // hum=0.86 > 0.85, temp=0.65 > 0.6 → SWAMP
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('SWAMP')
      }).pipe(Effect.provide(makeTestLayer(0.65, 0.86)))
    )

    it.effect('should return OCEAN at very high humidity boundary with cold temp (temp=0.55, hum=0.86)', () =>
      // hum=0.86 > 0.85, temp=0.55 not > 0.6 → OCEAN
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('OCEAN')
      }).pipe(Effect.provide(makeTestLayer(0.55, 0.86)))
    )

    it.effect('should return MOUNTAINS at cold temperature upper boundary (temp=0.29, hum=0.5)', () =>
      // isCold (0.29 < 0.3): hum=0.5 > 0.4 → MOUNTAINS
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('MOUNTAINS')
      }).pipe(Effect.provide(makeTestLayer(0.29, 0.5)))
    )

    it.effect('should return DESERT for hot temperature with non-wet humidity (temp=0.71, hum=0.5)', () =>
      // isHot (0.71 > 0.7): hum=0.5 not isWet (>0.6) → DESERT
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome = yield* service.getBiome(0, 0)
        expect(biome).toBe('DESERT')
      }).pipe(Effect.provide(makeTestLayer(0.71, 0.5)))
    )
  })

  describe('getBiomeProperties', () => {
    it.effect('should return valid properties for PLAINS', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const props = yield* service.getBiomeProperties('PLAINS')
        expect(props.surfaceBlock).toBe('GRASS')
        expect(props.subSurfaceBlock).toBe('DIRT')
        expect(props.treeDensity).toBeGreaterThanOrEqual(0)
        expect(props.treeDensity).toBeLessThanOrEqual(1)
        expect(props.heightModifier).toBeGreaterThan(0)
        expect(props.baseHeight).toBeGreaterThan(0)
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )

    it.effect('should return valid properties for DESERT', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const props = yield* service.getBiomeProperties('DESERT')
        expect(props.surfaceBlock).toBe('SAND')
        expect(props.subSurfaceBlock).toBe('SAND')
        expect(props.treeDensity).toBe(0)
        expect(props.heightModifier).toBeGreaterThan(0)
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )

    it.effect('should return valid properties for FOREST', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const props = yield* service.getBiomeProperties('FOREST')
        expect(props.surfaceBlock).toBe('GRASS')
        expect(props.treeDensity).toBeGreaterThan(0.1)
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )

    it.effect('should return valid properties for OCEAN', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const props = yield* service.getBiomeProperties('OCEAN')
        expect(props.baseHeight).toBeLessThan(64)
        expect(props.heightModifier).toBeLessThan(1)
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )

    it.effect('should return valid properties for MOUNTAINS', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const props = yield* service.getBiomeProperties('MOUNTAINS')
        expect(props.surfaceBlock).toBe('STONE')
        expect(props.subSurfaceBlock).toBe('STONE')
        expect(props.heightModifier).toBeGreaterThan(1)
        expect(props.baseHeight).toBeGreaterThanOrEqual(64)
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )

    it.effect('should return valid properties for SNOW', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const props = yield* service.getBiomeProperties('SNOW')
        expect(props.surfaceBlock).toBe('SNOW')
        expect(props.subSurfaceBlock).toBe('DIRT')
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )

    it.effect('should return valid properties for SWAMP', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const props = yield* service.getBiomeProperties('SWAMP')
        expect(props.surfaceBlock).toBe('GRASS')
        expect(props.baseHeight).toBeLessThan(64)
        expect(props.treeDensity).toBeGreaterThan(0)
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )

    it.effect('should return valid properties for JUNGLE', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const props = yield* service.getBiomeProperties('JUNGLE')
        expect(props.surfaceBlock).toBe('GRASS')
        expect(props.treeDensity).toBeGreaterThanOrEqual(0.4)
        expect(props.heightModifier).toBeGreaterThan(1)
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    )

    it.effect('should return valid numeric properties for all biome types', () => {
      const allBiomes = ['PLAINS', 'DESERT', 'FOREST', 'OCEAN', 'MOUNTAINS', 'SNOW', 'SWAMP', 'JUNGLE'] as const

      return Effect.gen(function* () {
        const service = yield* BiomeService

        yield* Effect.forEach(allBiomes, (biome) => service.getBiomeProperties(biome).pipe(Effect.map((props) => {
          expect(props.treeDensity).toBeGreaterThanOrEqual(0)
          expect(props.treeDensity).toBeLessThanOrEqual(1)
          expect(props.heightModifier).toBeGreaterThan(0)
          expect(props.baseHeight).toBeGreaterThan(0)
          expect(typeof props.temperature).toBe('number')
          expect(typeof props.humidity).toBe('number')
        })), { concurrency: 1 })
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.45)))
    })
  })

  describe('getBiome — reproducibility', () => {
    it.effect('should return the same biome for the same coordinates called twice', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const biome1 = yield* service.getBiome(100, 200)
        const biome2 = yield* service.getBiome(100, 200)
        expect(biome1).toBe(biome2)
      }).pipe(Effect.provide(makeTestLayer(0.5, 0.5)))
    )

    it.effect('should return the same biome for the same coordinates called multiple times', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const results = yield* Effect.all([
          service.getBiome(42, 42),
          service.getBiome(42, 42),
          service.getBiome(42, 42),
        ])
        expect(results[0]).toBe(results[1])
        expect(results[1]).toBe(results[2])
      }).pipe(Effect.provide(makeTestLayer(0.4, 0.7)))
    )
  })

  describe('getTemperature and getHumidity', () => {
    it.effect('should return the temperature value from noise for given coordinates', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const temp = yield* service.getTemperature(0, 0)
        // With our mock: x_scaled = 0 * 0.005 = 0.0 ≤ 25 → returns tempValue = 0.6
        expect(temp).toBe(0.6)
      }).pipe(Effect.provide(makeTestLayer(0.6, 0.3)))
    )

    it.effect('should return the humidity value from noise for given coordinates', () =>
      Effect.gen(function* () {
        const service = yield* BiomeService
        const hum = yield* service.getHumidity(0, 0)
        // With our mock: x_scaled = (0+10000)*0.005 = 50.0 > 25 → returns humidityValue = 0.8
        expect(hum).toBe(0.8)
      }).pipe(Effect.provide(makeTestLayer(0.6, 0.8)))
    )
  })
})
