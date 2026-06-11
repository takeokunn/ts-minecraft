import { describe, it, expect } from 'vitest'
import { blockTypeToIndex } from '@ts-minecraft/core'
import {
  TRANSPARENT_IDS_ARRAY,
  TRANSPARENT_IDS_SET,
  TRANSPARENT_SOLID_IDS_ARRAY,
  TRANSPARENT_SOLID_IDS_SET,
  MESHING_WORKER_TIMEOUT,
} from '../infrastructure/meshing/meshing-worker-config'

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
