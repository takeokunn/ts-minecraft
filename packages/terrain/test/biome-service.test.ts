import { describe,it } from '@effect/vitest'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'
import {
BiomeType,
buildChunkNoiseInputs,
classifyBiome
} from '@ts-minecraft/terrain'
import { Array as Arr,Effect } from 'effect'
import { expect } from 'vitest'
import { withBiomeService } from './biome-service-test-utils'

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
