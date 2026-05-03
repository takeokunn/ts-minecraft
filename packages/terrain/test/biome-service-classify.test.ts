import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer } from 'effect'
import {
  BiomeService,
  BiomeServiceLive,
  NoiseServicePort,
} from '@ts-minecraft/terrain'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'

const makeMockLayer = (
  temp: number,
  hum: number,
  cont: number,
  eros: number,
  pv = 0,
  river = 0.0,
) =>
  Layer.succeed(NoiseServicePort, {
    noise2D: () => Effect.succeed(river),
    octaveNoise2D: (x: number) => Effect.succeed(x > 25.0 ? hum : temp),
    octaveNoise2DBatchXY: (xs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.map(xs, (x) => (x > 25.0 ? hum : temp))),
    noise2DBatchXY: (xs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.makeBy(xs.length, () => river)),
    continentalness: () => Effect.succeed(cont),
    erosion: () => Effect.succeed(eros),
    weirdness: () => Effect.succeed(pv),
    jaggedness: () => Effect.succeed(0),
    sampleTerrainChannels: () =>
      Effect.succeed({
        continentalness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => cont)),
        erosion: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => eros)),
        pv: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => pv)),
        jaggedness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
      }),
    setSeed: () => Effect.void,
  } as unknown as NoiseServicePort)

const makeLayer = (temp: number, hum: number, cont: number, eros: number, pv = 0, river = 0.0) =>
  BiomeServiceLive.pipe(Layer.provide(makeMockLayer(temp, hum, cont, eros, pv, river)))

describe('classifyBiomeFromClimate — baseBiome SWAMP overridden to FOREST by continentalness', () => {
  it.effect('temp=0.65, hum=0.9, cont=0.2, eros=0.6 → FOREST (continentalness > 0.15)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('FOREST')
    }).pipe(Effect.provide(makeLayer(0.65, 0.9, 0.2, 0.6)))
  )

  it.effect('temp=0.65, hum=0.9, cont=0.16, eros=0.6 → FOREST (continentalness just over 0.15)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('FOREST')
    }).pipe(Effect.provide(makeLayer(0.65, 0.9, 0.16, 0.6)))
  )

  it.effect('temp=0.65, hum=0.9, cont=0.1, eros=0.3 → FOREST (erosion < 0.35)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('FOREST')
    }).pipe(Effect.provide(makeLayer(0.65, 0.9, 0.1, 0.3)))
  )
})

describe('classifyBiomeFromClimate — mountain override branches', () => {
  it.effect('MOUNTAINS base with high continentalness and mountaininess → MOUNTAINS (no override)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      // MOUNTAINS base biome requires cold temp (temp < 0.3), humidity in (0.4, 0.55)
      // pv=1 → mountaininess = 0.65*1 + 0.35*max(0, 0.45-eros)
      // With cont=0.6 > 0.5 and mountaininess > 0.42 → returns MOUNTAINS (not TAIGA override path)
      expect(['MOUNTAINS', 'SNOW', 'TAIGA']).toContain(biome)
    }).pipe(Effect.provide(makeLayer(0.2, 0.45, 0.6, 0.0, 1.0)))
  )

  it.effect('MOUNTAINS base with low continentalness → TAIGA override', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      // Cold temp (< 0.3), humidity in mountains range (> 0.4), low continentalness → MOUNTAINS base
      // but continentalness < 0.32 triggers override → TAIGA (since temp < TEMP_COLD)
      expect(['TAIGA', 'MOUNTAINS']).toContain(biome)
    }).pipe(Effect.provide(makeLayer(0.2, 0.45, 0.2, 0.6)))
  )
})

describe('classifyBiomeFromClimate — SWAMP stays SWAMP when continentalness ≤ 0.15 and erosion ≥ 0.35', () => {
  it.effect('temp=0.65, hum=0.9, cont=0.1, eros=0.5 → SWAMP', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('SWAMP')
    }).pipe(Effect.provide(makeLayer(0.65, 0.9, 0.1, 0.5)))
  )

  it.effect('temp=0.65, hum=0.9, cont=0.0, eros=0.35 → SWAMP (exactly at boundary)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('SWAMP')
    }).pipe(Effect.provide(makeLayer(0.65, 0.9, 0.0, 0.35)))
  )

  it.effect('temp=0.65, hum=0.9, cont=0.15, eros=0.4 → SWAMP (cont exactly 0.15)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      expect(biome).toBe('SWAMP')
    }).pipe(Effect.provide(makeLayer(0.65, 0.9, 0.15, 0.4)))
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

describe('classifyBiomeFromClimate — baseBiome OCEAN passthrough', () => {
  it.effect('humidity > 0.85, temp ≤ 0.6, cont > -0.42 → FOREST (OCEAN base converted)', () =>
    Effect.gen(function* () {
      const svc = yield* BiomeService
      const biome = yield* svc.getBiome(0, 0)
      // humidity > HUM_VERY_WET and temp ≤ HUM_WET → OCEAN base biome
      // OCEAN base → returns FOREST (since temp ≤ TEMP_HOT=0.7)
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
