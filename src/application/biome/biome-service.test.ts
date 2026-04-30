import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer } from 'effect'
import {
  BiomeService,
  BiomeServiceLive,
  BiomeType,
  buildChunkNoiseInputs,
  classifyBiome,
} from '@/application/biome/biome-service'
import { NoiseServicePort } from '@/application/noise/noise-service-port'
import { CHUNK_SIZE } from '@/domain/chunk'

// ─── Mock infrastructure ──────────────────────────────────────────────────────

/**
 * Mock noise layer. Distinguishes temperature vs humidity calls by checking
 * whether the scaled x-argument exceeds 25.0 — the humidity offset (+10000)
 * places it far beyond any temperature x-value within reasonable world bounds.
 */
const makeMockNoiseLayer = (tempValue: number, humidityValue: number) =>
  Layer.succeed(NoiseServicePort, {
    noise2D: (_x: number, _z: number) => Effect.succeed(0.5),
    octaveNoise2D: (x: number, _z: number) =>
      Effect.succeed(x > 25.0 ? humidityValue : tempValue),
    octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.map(xs, (x) => (x > 25.0 ? humidityValue : tempValue))),
    noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
      Effect.succeed(Arr.makeBy(xs.length, () => 0.9)),
    continentalness: (_x: number, _z: number) => Effect.succeed(0.35),
    erosion: (_x: number, _z: number) => Effect.succeed(0.6),
    weirdness: (_x: number, _z: number) => Effect.succeed(0),
    jaggedness: (_x: number, _z: number) => Effect.succeed(0),
    sampleTerrainChannels: (_x: number, _z: number) => Effect.succeed({
      continentalness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0.35)),
      erosion: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0.6)),
      pv: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
      jaggedness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
    }),
    setSeed: (_seed: number) => Effect.void,
  } as unknown as NoiseServicePort)

const makeTestLayer = (temp: number, hum: number) =>
  BiomeServiceLive.pipe(Layer.provide(makeMockNoiseLayer(temp, hum)))

const withBiomeService = <A>(
  temp: number,
  hum: number,
  f: (service: BiomeService) => Effect.Effect<A, never>,
): Effect.Effect<A, never> =>
  Effect.flatMap(BiomeService, f).pipe(Effect.provide(makeTestLayer(temp, hum)))

// ─── classifyBiome — pure function tests (no Effect overhead) ─────────────────

describe('classifyBiome — biome classification', () => {
  const cases: ReadonlyArray<readonly [number, number, BiomeType]> = [
    [0.5, 0.45, 'PLAINS'],    // temperate, moderate humidity
    [0.8, 0.15, 'DESERT'],    // hot, low humidity (not below extreme threshold)
    [0.5, 0.70, 'FOREST'],    // temperate, wet
    [0.2, 0.90, 'OCEAN'],     // cold, very wet
    [0.1, 0.50, 'MOUNTAINS'], // cold, humid
    [0.1, 0.30, 'SNOW'],      // cold, low humidity
    [0.7, 0.90, 'SWAMP'],     // warm, very wet
    [0.8, 0.75, 'JUNGLE'],    // hot, wet
    [0.22, 0.58, 'TAIGA'],    // cold and wetter than mountains
    [0.82, 0.28, 'SAVANNA'],  // hot semi-arid
  ] as const

  Arr.forEach(cases, ([temp, hum, expected]) => {
    it(`temp=${temp} hum=${hum} → ${expected}`, () => {
      expect(classifyBiome(temp, hum)).toBe(expected)
    })
  })
})

describe('classifyBiome — threshold boundary conditions', () => {
  const cases: ReadonlyArray<readonly [number, number, BiomeType, string]> = [
    [0.5, 0.14, 'DESERT',    'below extreme-dry threshold, not cold'],
    [0.2, 0.14, 'SNOW',      'below extreme-dry threshold, cold'],
    [0.5, 0.29, 'PLAINS',    'temperate, just below dry boundary (0.3)'],
    [0.5, 0.45, 'PLAINS',    'temperate, middle humidity (no-zone default)'],
    [0.5, 0.61, 'FOREST',    'temperate, just above wet boundary (0.6)'],
    [0.65, 0.86, 'SWAMP',    'just above very-wet threshold, temp > 0.6'],
    [0.55, 0.86, 'OCEAN',    'just above very-wet threshold, temp ≤ 0.6'],
    [0.29, 0.50, 'MOUNTAINS','just below cold threshold (0.3), humid'],
    [0.71, 0.50, 'SAVANNA',  'just above hot threshold (0.7), semi-arid'],
    [0.22, 0.56, 'TAIGA',    'cold and wetter than mountains threshold'],
    [0.82, 0.25, 'SAVANNA',  'hot and semi-arid but not extreme desert'],
  ] as const

  Arr.forEach(cases, ([temp, hum, expected, reason]) => {
    it(`${reason}: temp=${temp} hum=${hum} → ${expected}`, () => {
      expect(classifyBiome(temp, hum)).toBe(expected)
    })
  })
})

// ─── buildChunkNoiseInputs — pure data function tests ─────────────────────────

describe('buildChunkNoiseInputs', () => {
  it('returns CHUNK_SIZE² entries for any chunk', () => {
    const result = buildChunkNoiseInputs(0, 0)
    expect(result).toHaveLength(CHUNK_SIZE * CHUNK_SIZE)
  })

  it('first entry corresponds to (lx=0, lz=0) of the chunk', () => {
    const result = buildChunkNoiseInputs(0, 0)
    // x=0, z=0 → tempX = 0 * 0.005 = 0
    expect(result[0]!.tempX).toBeCloseTo(0)
    expect(result[0]!.tempZ).toBeCloseTo(0)
    // humidity offset: (0+10000)*0.005 = 50
    expect(result[0]!.humX).toBeCloseTo(50)
  })

  it('entries are offset correctly for non-zero chunks', () => {
    const result = buildChunkNoiseInputs(1, 0)
    // first column: lx=0, x = 1*16 + 0 = 16 → tempX = 16*0.005 = 0.08
    expect(result[0]!.tempX).toBeCloseTo(16 * 0.005)
  })

  it('humidity x-coordinates are always offset by 10000*BIOME_SCALE from temperature', () => {
    const result = buildChunkNoiseInputs(0, 0)
    const offset = 10000 * 0.005
    Arr.forEach(result, (coord) => {
      expect(coord.humX - coord.tempX).toBeCloseTo(offset)
    })
  })
})

// ─── BiomeService — integration tests ────────────────────────────────────────

describe('BiomeService interface', () => {
  it.effect('exposes getBiome, getBiomeProperties, getTemperature, getHumidity', () =>
    withBiomeService(0.5, 0.45, (service) =>
      Effect.sync(() => {
        expect(typeof service.getBiome).toBe('function')
        expect(typeof service.getBiomeProperties).toBe('function')
        expect(typeof service.getTemperature).toBe('function')
        expect(typeof service.getHumidity).toBe('function')
        expect(typeof service.getBiomesAndPropertiesForChunk).toBe('function')
      })
    )
  )
})

describe('BiomeService.getBiome', () => {
  it.effect('returns a valid BiomeType', () =>
    withBiomeService(0.5, 0.45, (service) =>
      service.getBiome(0, 0).pipe(
        Effect.map((biome) => expect(['PLAINS', 'RIVER']).toContain(biome))
      )
    )
  )

  it.effect('is deterministic for repeated calls', () =>
    withBiomeService(0.4, 0.7, (service) =>
      Effect.all([service.getBiome(42, 42), service.getBiome(42, 42), service.getBiome(42, 42)]).pipe(
        Effect.map(([a, b, c]) => {
          expect(a).toBe(b)
          expect(b).toBe(c)
        })
      )
    )
  )
})

describe('BiomeService.getTemperature and getHumidity', () => {
  it.effect('getTemperature returns the noise value at scaled coordinates', () =>
    withBiomeService(0.6, 0.3, (service) =>
      service.getTemperature(0, 0).pipe(
        Effect.map((temp) => expect(temp).toBe(0.6))
      )
    )
  )

  it.effect('getHumidity returns the noise value at humidity-offset coordinates', () =>
    withBiomeService(0.6, 0.8, (service) =>
      service.getHumidity(0, 0).pipe(
        Effect.map((hum) => expect(hum).toBe(0.8))
      )
    )
  )
})

describe('BiomeService.getBiomeProperties', () => {
  type PropExpectation = {
    biome: BiomeType
    surfaceBlock: string
    subSurfaceBlock: string
    minTreeDensity: number
  }

  const propertyExpectations: ReadonlyArray<PropExpectation> = [
    { biome: 'PLAINS',    surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  minTreeDensity: 0 },
    { biome: 'DESERT',    surfaceBlock: 'SAND',  subSurfaceBlock: 'SAND',  minTreeDensity: 0 },
    { biome: 'FOREST',    surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  minTreeDensity: 0.1 },
    { biome: 'OCEAN',     surfaceBlock: 'SAND',  subSurfaceBlock: 'SAND',  minTreeDensity: 0 },
    { biome: 'MOUNTAINS', surfaceBlock: 'STONE', subSurfaceBlock: 'STONE', minTreeDensity: 0 },
    { biome: 'SNOW',      surfaceBlock: 'SNOW',  subSurfaceBlock: 'DIRT',  minTreeDensity: 0 },
    { biome: 'SWAMP',     surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  minTreeDensity: 0.1 },
    { biome: 'JUNGLE',    surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  minTreeDensity: 0.4 },
    { biome: 'BEACH',     surfaceBlock: 'SAND',  subSurfaceBlock: 'SAND',  minTreeDensity: 0 },
    { biome: 'RIVER',     surfaceBlock: 'SAND',  subSurfaceBlock: 'SAND',  minTreeDensity: 0 },
    { biome: 'TAIGA',     surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  minTreeDensity: 0.2 },
    { biome: 'SAVANNA',   surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT',  minTreeDensity: 0 },
  ]

  Arr.forEach(propertyExpectations, ({ biome, surfaceBlock, subSurfaceBlock, minTreeDensity }) => {
    it.effect(`${biome}: correct surface blocks and tree density`, () =>
      withBiomeService(0.5, 0.45, (service) =>
        service.getBiomeProperties(biome).pipe(
          Effect.map((props) => {
            expect(props.surfaceBlock).toBe(surfaceBlock)
            expect(props.subSurfaceBlock).toBe(subSurfaceBlock)
            expect(props.treeDensity).toBeGreaterThanOrEqual(minTreeDensity)
            expect(props.treeDensity).toBeGreaterThanOrEqual(0)
            expect(props.treeDensity).toBeLessThanOrEqual(1)
          })
        )
      )
    )
  })
})

describe('BiomeService.getBiomesAndPropertiesForChunk', () => {
  it.effect('returns CHUNK_SIZE² entries', () =>
    withBiomeService(0.5, 0.45, (service) =>
      service.getBiomesAndPropertiesForChunk(0, 0).pipe(
        Effect.map((results) => expect(results).toHaveLength(CHUNK_SIZE * CHUNK_SIZE))
      )
    )
  )

  it.effect('all entries have a valid biome and matching properties', () =>
    withBiomeService(0.5, 0.45, (service) =>
      service.getBiomesAndPropertiesForChunk(0, 0).pipe(
        Effect.map((results) => {
          Arr.forEach(results, ({ biome, props }) => {
            expect(typeof biome).toBe('string')
            expect(typeof props.surfaceBlock).toBe('string')
            expect(props.treeDensity).toBeGreaterThanOrEqual(0)
            expect(props.treeDensity).toBeLessThanOrEqual(1)
          })
        })
      )
    )
  )

  it.effect('all entries classify to PLAINS when noise returns temperate/moderate values', () =>
    withBiomeService(0.5, 0.45, (service) =>
      service.getBiomesAndPropertiesForChunk(0, 0).pipe(
        Effect.map((results) => {
          const biomes = Arr.map(results, (r) => r.biome)
          expect(Arr.every(biomes, (b) => b === 'PLAINS')).toBe(true)
        })
      )
    )
  )

  it.effect('classifies DESERT when noise returns hot/dry values', () =>
    withBiomeService(0.8, 0.15, (service) =>
      service.getBiomesAndPropertiesForChunk(0, 0).pipe(
        Effect.map((results) => {
          const biomes = Arr.map(results, (r) => r.biome)
          expect(Arr.every(biomes, (b) => b === 'DESERT')).toBe(true)
        })
      )
    )
  )

  it.effect('promotes shoreline-adjacent inland columns to BEACH only when next to OCEAN', () => {
    const coastlineNoise = Layer.succeed(NoiseServicePort, {
      noise2D: (_x: number, _z: number) => Effect.succeed(0.5),
      octaveNoise2D: (x: number, _z: number) => {
        const isHumidity = x > 25.0
        const worldX = Math.round((x - (isHumidity ? 50 : 0)) / 0.005)
        if (worldX === 0) return Effect.succeed(isHumidity ? 0.9 : 0.2)
        return Effect.succeed(isHumidity ? 0.45 : 0.5)
      },
      octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
        Effect.succeed(Arr.map(xs, (x, i) => {
          const lx = Math.floor(i / CHUNK_SIZE)
          const isHumidity = x > 25.0
          if (lx === 0) return isHumidity ? 0.9 : 0.2 // OCEAN
          return isHumidity ? 0.45 : 0.5 // PLAINS candidate next to ocean
        })),
      continentalness: (x: number, _z: number) => Effect.succeed(x === 0 ? -0.65 : -0.05),
      erosion: (_x: number, _z: number) => Effect.succeed(0.7),
      weirdness: (_x: number, _z: number) => Effect.succeed(0),
      jaggedness: (_x: number, _z: number) => Effect.succeed(0),
      noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) => Effect.succeed(Arr.makeBy(xs.length, () => 0.9)),
      sampleTerrainChannels: (_x: number, _z: number) => Effect.succeed({
        continentalness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => (i % CHUNK_SIZE) === 0 ? -0.65 : -0.05)),
        erosion: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0.7)),
        pv: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
        jaggedness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
      }),
      setSeed: (_seed: number) => Effect.void,
    } as unknown as NoiseServicePort)

    const layer = BiomeServiceLive.pipe(Layer.provide(coastlineNoise))
    return Effect.flatMap(BiomeService, (service) =>
      service.getBiomesAndPropertiesForChunk(0, 0).pipe(
        Effect.map((results) => {
          expect(results[0]!.biome).toBe('OCEAN')
          expect(results[CHUNK_SIZE]!.biome).toBe('BEACH')
          expect(results[CHUNK_SIZE * 2]!.biome).toBe('PLAINS')
        })
      )
    ).pipe(Effect.provide(layer))
  })

  it.effect('promotes shoreline columns to BEACH even when the adjacent OCEAN lies in the neighboring chunk', () => {
    const crossChunkCoastNoise = Layer.succeed(NoiseServicePort, {
      noise2D: (_x: number, _z: number) => Effect.succeed(0.5),
      octaveNoise2D: (x: number, _z: number) => {
        const isHumidity = x > 25.0
        const worldX = Math.round((x - (isHumidity ? 50 : 0)) / 0.005)
        if (worldX >= CHUNK_SIZE) return Effect.succeed(isHumidity ? 0.9 : 0.2) // neighboring chunk = ocean
        return Effect.succeed(isHumidity ? 0.45 : 0.5) // current chunk = plains candidate
      },
      octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>) =>
        Effect.forEach(Arr.zip(xs, zs), ([x, z]) => {
          const isHumidity = x > 25.0
          const worldX = Math.round((x - (isHumidity ? 50 : 0)) / 0.005)
          void z
          if (worldX >= CHUNK_SIZE) return Effect.succeed(isHumidity ? 0.9 : 0.2)
          return Effect.succeed(isHumidity ? 0.45 : 0.5)
        }, { concurrency: 'unbounded' }),
      continentalness: (x: number, _z: number) => Effect.succeed(x >= CHUNK_SIZE ? -0.65 : -0.05),
      erosion: (_x: number, _z: number) => Effect.succeed(0.7),
      weirdness: (_x: number, _z: number) => Effect.succeed(0),
      jaggedness: (_x: number, _z: number) => Effect.succeed(0),
      noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) => Effect.succeed(Arr.makeBy(xs.length, () => 0.9)),
      sampleTerrainChannels: (_x: number, _z: number) => Effect.succeed({
        continentalness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => -0.05)),
        erosion: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0.7)),
        pv: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
        jaggedness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0)),
      }),
      setSeed: (_seed: number) => Effect.void,
    } as unknown as NoiseServicePort)

    const layer = BiomeServiceLive.pipe(Layer.provide(crossChunkCoastNoise))
    return Effect.flatMap(BiomeService, (service) =>
      service.getBiomesAndPropertiesForChunk(0, 0).pipe(
        Effect.map((results) => {
          const edgeIndex = (CHUNK_SIZE - 1) * CHUNK_SIZE
          expect(results[edgeIndex]!.biome).toBe('BEACH')
        })
      )
    ).pipe(Effect.provide(layer))
  })

  it.effect('results for chunk (0,0) and chunk (1,0) use different world coordinates', () =>
    withBiomeService(0.5, 0.45, (service) =>
      Effect.all([
        service.getBiomesAndPropertiesForChunk(0, 0),
        service.getBiomesAndPropertiesForChunk(1, 0),
      ]).pipe(
        Effect.map(([chunk0, chunk1]) => {
          // With uniform mock noise, both chunks classify identically — but both must have length CHUNK_SIZE²
          expect(chunk0).toHaveLength(CHUNK_SIZE * CHUNK_SIZE)
          expect(chunk1).toHaveLength(CHUNK_SIZE * CHUNK_SIZE)
        })
      )
    )
  )

  it.effect('batched chunk biome classification matches scalar getBiome for non-uniform terrain channels', () => {
    const pvFromWeirdness = (w: number): number => 1 - Math.abs(3 * Math.abs(w) - 2)
    const perCellClimateNoise = Layer.succeed(NoiseServicePort, {
      noise2D: (_x: number, _z: number) => Effect.succeed(0.9),
      octaveNoise2D: (x: number, z: number) => {
        const isHumidity = x > 25.0
        const worldX = Math.round((x - (isHumidity ? 50 : 0)) / 0.005)
        const worldZ = Math.round(z / 0.005)
        const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const warmStripe = localX >= CHUNK_SIZE / 2
        const humidStripe = localZ >= CHUNK_SIZE / 2
        return Effect.succeed(isHumidity ? (humidStripe ? 0.72 : 0.24) : (warmStripe ? 0.82 : 0.22))
      },
      octaveNoise2DBatchXY: (xs: ReadonlyArray<number>, zs: ReadonlyArray<number>) =>
        Effect.forEach(Arr.zip(xs, zs), ([x, z]) => {
          const isHumidity = x > 25.0
          const worldX = Math.round((x - (isHumidity ? 50 : 0)) / 0.005)
          const worldZ = Math.round(z / 0.005)
          const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const warmStripe = localX >= CHUNK_SIZE / 2
          const humidStripe = localZ >= CHUNK_SIZE / 2
          return Effect.succeed(isHumidity ? (humidStripe ? 0.72 : 0.24) : (warmStripe ? 0.82 : 0.22))
        }, { concurrency: 'unbounded' }),
      continentalness: (x: number, _z: number) => Effect.succeed((Math.floor(x) % CHUNK_SIZE) < CHUNK_SIZE / 2 ? -0.2 : 0.55),
      erosion: (_x: number, z: number) => Effect.succeed((Math.floor(z) % CHUNK_SIZE) < CHUNK_SIZE / 2 ? 0.7 : 0.2),
      weirdness: (x: number, z: number) => Effect.succeed(((Math.floor(x) + Math.floor(z)) % 2 === 0) ? 0.85 : -0.15),
      jaggedness: (_x: number, _z: number) => Effect.succeed(0.3),
      noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) => Effect.succeed(Arr.makeBy(xs.length, () => 0.9)),
      sampleTerrainChannels: (xStart: number, zStart: number) => Effect.succeed({
        continentalness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => {
          const x = xStart + (i % CHUNK_SIZE)
          return (x % CHUNK_SIZE) < CHUNK_SIZE / 2 ? -0.2 : 0.55
        })),
        erosion: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => {
          const z = zStart + Math.floor(i / CHUNK_SIZE)
          return (z % CHUNK_SIZE) < CHUNK_SIZE / 2 ? 0.7 : 0.2
        })),
        pv: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => pvFromWeirdness(((i % CHUNK_SIZE) + Math.floor(i / CHUNK_SIZE)) % 2 === 0 ? 0.85 : -0.15))),
        jaggedness: new Float64Array(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, () => 0.3)),
      }),
      setSeed: (_seed: number) => Effect.void,
    } as unknown as NoiseServicePort)

    const layer = BiomeServiceLive.pipe(Layer.provide(perCellClimateNoise))
    return Effect.flatMap(BiomeService, (service) =>
      Effect.gen(function* () {
        const batched = yield* service.getBiomesAndPropertiesForChunk(0, 0)
        yield* Effect.forEach(Arr.makeBy(CHUNK_SIZE * CHUNK_SIZE, (i) => i), (i) => {
          const lx = Math.floor(i / CHUNK_SIZE)
          const lz = i % CHUNK_SIZE
          return service.getBiome(lx, lz).pipe(
            Effect.map((scalarBiome) => {
              expect(batched[i]!.biome).toBe(scalarBiome)
            }),
          )
        }, { concurrency: 'unbounded', discard: true })
      })
    ).pipe(Effect.provide(layer))
  })
})
