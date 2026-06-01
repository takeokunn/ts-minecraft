import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Option } from 'effect'
import {
  ORE_CONFIGS,
  ORE_MIN_Y_FLOOR,
  BEDROCK_LAYER_TOP,
  DEEPSLATE_CEILING,
  BEDROCK_PROBABILITY,
  CAVE_SAMPLE_STRIDE,
} from '../domain/terrain/constants'

describe('terrain constants — data integrity', () => {
  describe('ORE_CONFIGS', () => {
    it('has 7 ore types', () => {
      expect(ORE_CONFIGS.length).toBe(7)
    })

    it('every ore has minY < maxY', () => {
      Arr.forEach(ORE_CONFIGS, (ore) => {
        expect(ore.minY).toBeLessThan(ore.maxY)
      })
    })

    it('every ore has minSize <= maxSize', () => {
      Arr.forEach(ORE_CONFIGS, (ore) => {
        expect(ore.minSize).toBeLessThanOrEqual(ore.maxSize)
      })
    })

    it('every ore peakY is within [minY, maxY]', () => {
      Arr.forEach(ORE_CONFIGS, (ore) => {
        expect(ore.peakY).toBeGreaterThanOrEqual(ore.minY)
        expect(ore.peakY).toBeLessThanOrEqual(ore.maxY)
      })
    })

    it('every ore minY is above ORE_MIN_Y_FLOOR', () => {
      Arr.forEach(ORE_CONFIGS, (ore) => {
        expect(ore.minY).toBeGreaterThanOrEqual(ORE_MIN_Y_FLOOR)
      })
    })

    it('ore names are all unique', () => {
      const names = Arr.map(ORE_CONFIGS, (o) => o.name)
      expect(new Set(names).size).toBe(names.length)
    })

    it('COAL has the highest maxY (180) as the shallowest ore', () => {
      const coal = Option.getOrThrow(Arr.findFirst(ORE_CONFIGS, (o) => o.name === 'COAL'))
      expect(coal.maxY).toBe(180)
    })

    it('DIAMOND has the lowest maxY as the deepest ore', () => {
      const diamond = Option.getOrThrow(Arr.findFirst(ORE_CONFIGS, (o) => o.name === 'DIAMOND'))
      const maxYValues = Arr.map(ORE_CONFIGS, (o) => o.maxY)
      const minMaxY = Math.min(...maxYValues)
      expect(diamond.maxY).toBe(minMaxY)
    })

    it('all distribution values are either "uniform" or "triangle"', () => {
      Arr.forEach(ORE_CONFIGS, (ore) => {
        expect(['uniform', 'triangle']).toContain(ore.distribution)
      })
    })
  })

  describe('bedrock constants', () => {
    it('BEDROCK_LAYER_TOP is 4 (y=0..4)', () => {
      expect(BEDROCK_LAYER_TOP).toBe(4)
    })

    it('DEEPSLATE_CEILING is 16', () => {
      expect(DEEPSLATE_CEILING).toBe(16)
    })

    it('ORE_MIN_Y_FLOOR equals BEDROCK_LAYER_TOP + 1', () => {
      expect(ORE_MIN_Y_FLOOR).toBe(BEDROCK_LAYER_TOP + 1)
    })

    it('BEDROCK_PROBABILITY has 5 entries (y=0..4)', () => {
      expect(BEDROCK_PROBABILITY.length).toBe(5)
    })

    it('BEDROCK_PROBABILITY[0] is 1.0 (always bedrock at y=0)', () => {
      expect(BEDROCK_PROBABILITY[0]).toBe(1.0)
    })

    it('BEDROCK_PROBABILITY[4] is 0.0 (never bedrock at y=4)', () => {
      expect(BEDROCK_PROBABILITY[4]).toBe(0.0)
    })

    it('BEDROCK_PROBABILITY values are monotonically decreasing', () => {
      Arr.forEach(
        Arr.zip(Arr.drop(BEDROCK_PROBABILITY as ReadonlyArray<number>, 1), BEDROCK_PROBABILITY as ReadonlyArray<number>),
        ([cur, prev]) => expect(cur).toBeLessThanOrEqual(prev),
      )
    })
  })

  describe('cave constants', () => {
    it('CAVE_SAMPLE_STRIDE is 4', () => {
      expect(CAVE_SAMPLE_STRIDE).toBe(4)
    })

    it('CAVE_SAMPLE_STRIDE divides 16 (CHUNK_SIZE) evenly', () => {
      expect(16 % CAVE_SAMPLE_STRIDE).toBe(0)
    })
  })
})
