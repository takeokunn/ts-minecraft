import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import { createColumnNoiseCoordinates, createCaveGridPoints } from '../domain/terrain/generator-coordinates'

describe('terrain/domain/terrain/generator-coordinates', () => {
  describe('createColumnNoiseCoordinates', () => {
    it('returns CHUNK_SIZE² entries (one per column)', () => {
      const coords = createColumnNoiseCoordinates(0, 0)
      expect(coords.length).toBe(CHUNK_SIZE * CHUNK_SIZE)
    })

    it('each entry has all noise coordinate fields', () => {
      const coords = createColumnNoiseCoordinates(16, 32)
      const first = coords[0]!
      expect(typeof first.lakeX).toBe('number')
      expect(typeof first.lakeZ).toBe('number')
      expect(typeof first.graniteX).toBe('number')
      expect(typeof first.graniteZ).toBe('number')
      expect(typeof first.dioriteX).toBe('number')
      expect(typeof first.dioriteZ).toBe('number')
      expect(typeof first.andesiteX).toBe('number')
      expect(typeof first.andesiteZ).toBe('number')
    })

    it('different base offsets produce different coordinates', () => {
      const a = createColumnNoiseCoordinates(0, 0)
      const b = createColumnNoiseCoordinates(1, 0)
      expect(a[0]!.lakeX).not.toBe(b[0]!.lakeX)
    })
  })

  describe('createCaveGridPoints', () => {
    it('returns a non-empty array of cave grid points', () => {
      const points = createCaveGridPoints(0, 0)
      expect(points.length).toBeGreaterThan(0)
    })

    it('each point has x, y, z coordinates', () => {
      const points = createCaveGridPoints(0, 0)
      const first = points[0]!
      expect(typeof first.x).toBe('number')
      expect(typeof first.y).toBe('number')
      expect(typeof first.z).toBe('number')
    })

    it('point count is deterministic for same base coordinates', () => {
      const a = createCaveGridPoints(0, 0)
      const b = createCaveGridPoints(0, 0)
      expect(a.length).toBe(b.length)
    })

    it('y starts at 0 for the first sample point', () => {
      const points = createCaveGridPoints(0, 0)
      // First point corresponds to sy=0, sz=0, sx=0 → y = 0
      expect(points[0]!.y).toBe(0)
    })
  })
})
