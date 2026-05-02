import { describe, it, expect } from 'vitest'
import { ChunkError } from '../domain/errors'
import type { ChunkCoord } from '@ts-minecraft/kernel'

describe('ChunkError', () => {
  describe('_tag', () => {
    it('has _tag === "ChunkError"', () => {
      const err = new ChunkError({
        chunkCoord: { x: 0, z: 0 } as ChunkCoord,
        reason: 'test reason',
      })
      expect(err._tag).toBe('ChunkError')
    })
  })

  describe('message', () => {
    it('message contains chunkCoord x and z values', () => {
      const err = new ChunkError({
        chunkCoord: { x: 3, z: -7 } as ChunkCoord,
        reason: 'block out of bounds',
      })
      expect(err.message).toContain('3')
      expect(err.message).toContain('-7')
    })

    it('message contains reason', () => {
      const err = new ChunkError({
        chunkCoord: { x: 0, z: 0 } as ChunkCoord,
        reason: 'block index out of range',
      })
      expect(err.message).toContain('block index out of range')
    })

    it('message includes local position coordinates when localPosition is provided', () => {
      const err = new ChunkError({
        chunkCoord: { x: 1, z: 2 } as ChunkCoord,
        reason: 'invalid block',
        localPosition: [5, 64, 10],
      })
      expect(err.message).toContain('5')
      expect(err.message).toContain('64')
      expect(err.message).toContain('10')
    })

    it('message omits local position when localPosition is undefined', () => {
      const err = new ChunkError({
        chunkCoord: { x: 1, z: 2 } as ChunkCoord,
        reason: 'missing chunk',
      })
      expect(err.message).not.toContain('local')
    })

    it('message has expected format with local position', () => {
      const err = new ChunkError({
        chunkCoord: { x: 4, z: -3 } as ChunkCoord,
        reason: 'air block',
        localPosition: [2, 32, 8],
      })
      expect(err.message).toBe('Chunk error at (4, -3) at local (2, 32, 8): air block')
    })

    it('message has expected format without local position', () => {
      const err = new ChunkError({
        chunkCoord: { x: 4, z: -3 } as ChunkCoord,
        reason: 'air block',
      })
      expect(err.message).toBe('Chunk error at (4, -3): air block')
    })
  })

  describe('fields', () => {
    it('stores chunkCoord correctly', () => {
      const coord = { x: 5, z: -2 } as ChunkCoord
      const err = new ChunkError({ chunkCoord: coord, reason: 'test' })
      expect(err.chunkCoord).toEqual(coord)
    })

    it('stores reason correctly', () => {
      const err = new ChunkError({
        chunkCoord: { x: 0, z: 0 } as ChunkCoord,
        reason: 'specific reason',
      })
      expect(err.reason).toBe('specific reason')
    })

    it('stores localPosition when provided', () => {
      const err = new ChunkError({
        chunkCoord: { x: 0, z: 0 } as ChunkCoord,
        reason: 'test',
        localPosition: [1, 2, 3],
      })
      expect(err.localPosition).toEqual([1, 2, 3])
    })

    it('localPosition is undefined when not provided', () => {
      const err = new ChunkError({
        chunkCoord: { x: 0, z: 0 } as ChunkCoord,
        reason: 'test',
      })
      expect(err.localPosition).toBeUndefined()
    })
  })
})
