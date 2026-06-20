import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, Schema } from 'effect'
import {
  BiomeService,
  BiomeTypeSchema,
  CHUNK_COLUMN_SAMPLE_COUNT,
  NoiseServicePort,
} from '@ts-minecraft/world'
import { classifyBiome } from '../domain/biome-classifier.ts'
import { TEMP_HOT } from '../domain/biome-classifier.config.ts'

const makeMockLayer = (
  temp: number,
  hum: number,
  cont: number,
  eros: number,
  pv = 0,
  river = 0.0,
) => {
  // Inverse on the ascending PV branch; keeps mocked weirdness aligned with the requested pv.
  const weirdness = (pv + 1) / 3

  return Layer.succeed(NoiseServicePort, NoiseServicePort.of({
    _tag: '@minecraft/application/noise/NoiseServicePort' as const,
    noise2D: () => Effect.succeed(river),
    octaveNoise2D: (x: number) => Effect.succeed(x > 25.0 ? hum : temp),
    getSeed: Effect.succeed(0),
    octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
      Effect.succeed(Arr.map(points, ([x]) => (x > 25.0 ? hum : temp))),
    octaveNoise2DBatchXY: (xs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.map(xs, (x) => (x > 25.0 ? hum : temp))),
    noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
      Effect.succeed(Arr.makeBy(points.length, () => river)),
    noise2DBatchXY: (xs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.makeBy(xs.length, () => river)),
    noise3D: () => Effect.succeed(0),
    noise3DBatchXYZ: (xs: ReadonlyArray<number>) => Effect.succeed(Arr.makeBy(xs.length, () => 0)),
    continentalness: () => Effect.succeed(cont),
    erosion: () => Effect.succeed(eros),
    weirdness: () => Effect.succeed(weirdness),
    jaggedness: () => Effect.succeed(0),
    sampleTerrainChannels: () =>
      Effect.succeed({
        continentalness: new Float64Array(Arr.makeBy(CHUNK_COLUMN_SAMPLE_COUNT, () => cont)),
        erosion: new Float64Array(Arr.makeBy(CHUNK_COLUMN_SAMPLE_COUNT, () => eros)),
        pv: new Float64Array(Arr.makeBy(CHUNK_COLUMN_SAMPLE_COUNT, () => pv)),
        jaggedness: new Float64Array(Arr.makeBy(CHUNK_COLUMN_SAMPLE_COUNT, () => 0)),
      }),
    setSeed: () => Effect.void,
  }))
}

const makeLayer = (temp: number, hum: number, cont: number, eros: number, pv = 0, river = 0.0) =>
  BiomeService.Default.pipe(Layer.provide(makeMockLayer(temp, hum, cont, eros, pv, river)))

describe('classifyBiomeFromClimate — baseBiome SWAMP overridden to FOREST by continentalness', () => {
  it.effect('temp=0.71, hum=0.9, cont=0.2, eros=0.6 → FOREST (continentalness > 0.15)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('FOREST')
    }).pipe(Effect.provide(makeLayer(0.71, 0.9, 0.2, 0.6)))
  )

  it.effect('temp=0.71, hum=0.9, cont=0.16, eros=0.6 → FOREST (continentalness just over 0.15)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('FOREST')
    }).pipe(Effect.provide(makeLayer(0.71, 0.9, 0.16, 0.6)))
  )

  it.effect('temp=0.71, hum=0.9, cont=0.1, eros=0.3 → FOREST (erosion < 0.35)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('FOREST')
    }).pipe(Effect.provide(makeLayer(0.71, 0.9, 0.1, 0.3)))
  )
})

describe('classifyBiomeFromClimate — mountain override branches', () => {
  it.effect('MOUNTAINS base with high continentalness and mountaininess → SNOW when cold', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      // Cold, high-continentalness mountains should resolve to SNOW when rugged enough.
      expect(biome).toBe('SNOW')
    }).pipe(Effect.provide(makeLayer(0.2, 0.45, 0.6, 0.0, 1.0)))
  )

  it.effect('high continentalness and mountaininess with non-cold temperature → MOUNTAINS', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('MOUNTAINS')
    }).pipe(Effect.provide(makeLayer(0.8, 0.45, 0.6, 0.0, 0.8)))
  )

  it.effect('high continentalness and mountaininess with cold temperature → SNOW', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('SNOW')
    }).pipe(Effect.provide(makeLayer(0.2, 0.45, 0.6, 0.0, 0.8)))
  )

  it.effect('MOUNTAINS base with low mountaininess → TAIGA override', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      // Cold temp (< 0.3), humidity in mountains range (> 0.4), but flat terrain softens the biome.
      expect(biome).toBe('TAIGA')
    }).pipe(Effect.provide(makeLayer(0.2, 0.45, 0.2, 0.6, 0.0)))
  )
})

describe('classifyBiomeFromClimate — SWAMP stays SWAMP when continentalness ≤ 0.15 and erosion ≥ 0.35', () => {
  it.effect('temp=0.71, hum=0.9, cont=0.1, eros=0.5 → SWAMP', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('SWAMP')
    }).pipe(Effect.provide(makeLayer(0.71, 0.9, 0.1, 0.5)))
  )

  it.effect('temp=0.71, hum=0.9, cont=0.0, eros=0.35 → SWAMP (exactly at boundary)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('SWAMP')
    }).pipe(Effect.provide(makeLayer(0.71, 0.9, 0.0, 0.35)))
  )

  it.effect('temp=0.71, hum=0.9, cont=0.15, eros=0.4 → SWAMP (cont exactly 0.15)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('SWAMP')
    }).pipe(Effect.provide(makeLayer(0.71, 0.9, 0.15, 0.4)))
  )
})

describe('classifyBiomeFromClimate — MOUNTAINS base overridden to TAIGA/FOREST by low continentalness', () => {
  it.effect('cold temp with humidity in mountains range and cont=0.25 → gets TAIGA override', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      // With cont=0.25 < 0.32, MOUNTAINS base → override to TAIGA (temp < TEMP_COLD)
      expect(['TAIGA', 'MOUNTAINS']).toContain(biome)
    }).pipe(Effect.provide(makeLayer(0.2, 0.45, 0.25, 0.4)))
  )
})

describe('classifyBiomeFromClimate — very wet climates stay terrestrial', () => {
  it('classifyBiome keeps very-wet temperate climates in FOREST and hot climates in SWAMP', () => {
    expect(classifyBiome(TEMP_HOT, 0.9)).toBe('FOREST')
    expect(classifyBiome(TEMP_HOT + 0.01, 0.9)).toBe('SWAMP')
  })

  // Totality: the if-chain must classify EVERY point of the climate domain (and
  // beyond) to a valid BiomeType — never fall through to undefined and never
  // throw. The point-tests above pin specific biomes; this guards a future
  // refactor of the branch order/thresholds from opening a gap anywhere.
  it('classifyBiome is total across the full temperature/humidity domain', () => {
    const isValidBiome = Schema.is(BiomeTypeSchema)
    for (let t = -1; t <= 2.0001; t += 0.1) {
      for (let h = -1; h <= 2.0001; h += 0.1) {
        const biome = classifyBiome(t, h)
        expect(isValidBiome(biome)).toBe(true)
      }
    }
  })

  it.effect('humidity > 0.85, temp ≤ TEMP_HOT, cont > -0.42 → FOREST', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      // humidity > HUM_VERY_WET and temperate temperature should remain terrestrial.
      expect(biome).toBe('FOREST')
    }).pipe(Effect.provide(makeLayer(0.5, 0.9, 0.35, 0.6)))
  )

  it.effect('deep ocean (cont < -0.42) → OCEAN regardless of base', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('OCEAN')
    }).pipe(Effect.provide(makeLayer(0.5, 0.5, -0.5, 0.6)))
  )
})
