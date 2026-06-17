import { afterEach, describe, it, expect } from 'vitest'
import { blockTypeToIndex } from '@ts-minecraft/core'
import {
  computeMeshingWorkerCount,
  computeMeshingWorkerCountFromHardwareConcurrency,
  TRANSPARENT_IDS_ARRAY,
  TRANSPARENT_IDS_SET,
  TRANSPARENT_SOLID_IDS_ARRAY,
  TRANSPARENT_SOLID_IDS_SET,
  MESHING_WORKER_TIMEOUT,
} from '../infrastructure/meshing/meshing-worker-config'

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

afterEach(() => {
  if (originalNavigator === undefined) {
    Reflect.deleteProperty(globalThis, 'navigator')
    return
  }

  Object.defineProperty(globalThis, 'navigator', originalNavigator)
})

describe('TRANSPARENT_IDS', () => {
  it('array contains WATER block id', () => {
    expect(TRANSPARENT_IDS_ARRAY).toContain(blockTypeToIndex('WATER'))
  })

  it('set contains WATER block id', () => {
    expect(TRANSPARENT_IDS_SET.has(blockTypeToIndex('WATER'))).toBe(true)
  })

  it('set and array are consistent', () => {
    for (const id of TRANSPARENT_IDS_ARRAY) {
      expect(TRANSPARENT_IDS_SET.has(id)).toBe(true)
    }
    expect(TRANSPARENT_IDS_SET.size).toBe(TRANSPARENT_IDS_ARRAY.length)
  })

  it('does not contain non-fluid blocks like STONE', () => {
    expect(TRANSPARENT_IDS_SET.has(blockTypeToIndex('STONE'))).toBe(false)
  })
})

describe('TRANSPARENT_SOLID_IDS', () => {
  it('array contains GLASS block id', () => {
    expect(TRANSPARENT_SOLID_IDS_ARRAY).toContain(blockTypeToIndex('GLASS'))
  })

  it('array contains LEAVES block id', () => {
    expect(TRANSPARENT_SOLID_IDS_ARRAY).toContain(blockTypeToIndex('LEAVES'))
  })

  it('set contains GLASS', () => {
    expect(TRANSPARENT_SOLID_IDS_SET.has(blockTypeToIndex('GLASS'))).toBe(true)
  })

  it('set contains LEAVES', () => {
    expect(TRANSPARENT_SOLID_IDS_SET.has(blockTypeToIndex('LEAVES'))).toBe(true)
  })

  it('set and array are consistent', () => {
    for (const id of TRANSPARENT_SOLID_IDS_ARRAY) {
      expect(TRANSPARENT_SOLID_IDS_SET.has(id)).toBe(true)
    }
    expect(TRANSPARENT_SOLID_IDS_SET.size).toBe(TRANSPARENT_SOLID_IDS_ARRAY.length)
  })

  it('does not include WATER (fluid, not transparent-solid)', () => {
    expect(TRANSPARENT_SOLID_IDS_SET.has(blockTypeToIndex('WATER'))).toBe(false)
  })
})

describe('MESHING_WORKER_TIMEOUT', () => {
  it('is a non-empty string', () => {
    expect(typeof MESHING_WORKER_TIMEOUT).toBe('string')
    expect(MESHING_WORKER_TIMEOUT.length).toBeGreaterThan(0)
  })
})

describe('computeMeshingWorkerCount', () => {
  it('returns a number between 1 and 3 inclusive', () => {
    const count = computeMeshingWorkerCount()
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(3)
  })

  it('returns an integer', () => {
    expect(Number.isInteger(computeMeshingWorkerCount())).toBe(true)
  })

  it('uses navigator.hardwareConcurrency when available', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { hardwareConcurrency: 8 },
    })

    expect(computeMeshingWorkerCount()).toBe(3)
  })

  it('falls back to two hardware threads when navigator is unavailable', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: undefined,
    })

    expect(computeMeshingWorkerCount()).toBe(1)
  })

  it.each([
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 2],
    [6, 3],
    [8, 3],
    [16, 3],
    [Number.NaN, 1],
  ])('returns %i worker(s) for %i hardware thread(s)', (hardwareConcurrency, expected) => {
    expect(computeMeshingWorkerCountFromHardwareConcurrency(hardwareConcurrency)).toBe(expected)
  })
})
