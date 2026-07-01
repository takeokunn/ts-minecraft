import { describe, it, expect } from 'vitest'
import { collectAffectedChunkCoords } from './physics-stage-portal'

const pos = (x: number, y: number, z: number) => ({ x, y, z })

describe('collectAffectedChunkCoords', () => {
  it('returns an empty map for an empty position list', () => {
    expect(collectAffectedChunkCoords([]).size).toBe(0)
  })

  it('maps a single position to its chunk coord', () => {
    const result = collectAffectedChunkCoords([pos(0, 64, 0)])
    expect(result.size).toBe(1)
    expect(result.get('0,0')).toEqual({ x: 0, z: 0 })
  })

  it('deduplicates positions within the same chunk (CHUNK_SIZE=16)', () => {
    // All four corners of chunk (0,0)
    const result = collectAffectedChunkCoords([pos(0, 64, 0), pos(1, 64, 1), pos(15, 64, 15)])
    expect(result.size).toBe(1)
    expect(result.get('0,0')).toBeDefined()
  })

  it('produces separate entries for positions in adjacent chunks', () => {
    const result = collectAffectedChunkCoords([pos(0, 64, 0), pos(16, 64, 0)])
    expect(result.size).toBe(2)
    expect(result.get('0,0')).toEqual({ x: 0, z: 0 })
    expect(result.get('1,0')).toEqual({ x: 1, z: 0 })
  })

  it('handles positions spanning multiple chunks in both X and Z axes', () => {
    const result = collectAffectedChunkCoords([
      pos(0, 64, 0),   // chunk (0,0)
      pos(16, 64, 0),  // chunk (1,0)
      pos(0, 64, 16),  // chunk (0,1)
      pos(16, 64, 16), // chunk (1,1)
    ])
    expect(result.size).toBe(4)
    expect(result.get('0,0')).toBeDefined()
    expect(result.get('1,0')).toBeDefined()
    expect(result.get('0,1')).toBeDefined()
    expect(result.get('1,1')).toBeDefined()
  })

  it('correctly keys negative chunk coordinates', () => {
    const result = collectAffectedChunkCoords([pos(-1, 64, -1)])
    expect(result.size).toBe(1)
    const entry = [...result.values()][0]
    expect(entry!.x).toBe(-1)
    expect(entry!.z).toBe(-1)
  })

  it('combines frame and interior positions as one deduplicated collection', () => {
    // Simulate a portal: frame uses chunk (2,3), interior uses same chunk
    const frame = [pos(32, 70, 48), pos(33, 70, 48), pos(34, 70, 48)]
    const interior = [pos(33, 71, 48), pos(33, 72, 48)]
    const result = collectAffectedChunkCoords([...frame, ...interior])
    expect(result.size).toBe(1)
  })
})
