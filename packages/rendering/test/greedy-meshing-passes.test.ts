import { describe, it, expect } from 'vitest'
import { packMask, dequantLight, runGreedyExpansion } from '../infrastructure/meshing/greedy-meshing-passes'

describe('dequantLight', () => {
  it('maps 0 → 0', () => expect(dequantLight(0)).toBe(0))
  it('maps 1 → 5', () => expect(dequantLight(1)).toBe(5))
  it('maps 2 → 10', () => expect(dequantLight(2)).toBe(10))
  it('maps 3 → 15', () => expect(dequantLight(3)).toBe(15))
})

describe('packMask', () => {
  it('packs blockId in bits 0-7', () => {
    const mask = packMask(42, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    expect(mask & 0xff).toBe(42)
  })

  it('packs ao in bits 8-9', () => {
    const mask = packMask(0, 3, 0, 0, 0, 0, 0, 0, 0, 0)
    expect((mask >> 8) & 0x3).toBe(3)
  })

  it('packs sky corners in bits 10-17', () => {
    const mask = packMask(0, 0, 1, 2, 3, 0, 0, 0, 0, 0)
    expect((mask >> 10) & 0x3).toBe(1) // sk0
    expect((mask >> 12) & 0x3).toBe(2) // sk1
    expect((mask >> 14) & 0x3).toBe(3) // sk2
    expect((mask >> 16) & 0x3).toBe(0) // sk3
  })

  it('packs block corners in bits 18-25', () => {
    const mask = packMask(0, 0, 0, 0, 0, 0, 1, 2, 3, 0)
    expect((mask >> 18) & 0x3).toBe(1) // bl0
    expect((mask >> 20) & 0x3).toBe(2) // bl1
    expect((mask >> 22) & 0x3).toBe(3) // bl2
    expect((mask >> 24) & 0x3).toBe(0) // bl3
  })

  it('produces 0 for all-zero inputs', () => {
    expect(packMask(0, 0, 0, 0, 0, 0, 0, 0, 0, 0)).toBe(0)
  })

  it('two identical packs compare equal', () => {
    const a = packMask(7, 2, 1, 3, 0, 2, 1, 1, 2, 3)
    const b = packMask(7, 2, 1, 3, 0, 2, 1, 1, 2, 3)
    expect(a).toBe(b)
  })

  it('different blockIds produce different masks', () => {
    const a = packMask(1, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    const b = packMask(2, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    expect(a).not.toBe(b)
  })
})

// ─── runGreedyExpansion ──────────────────────────────────────────────────────

describe('runGreedyExpansion', () => {
  const fill = (mask: Uint32Array, uSize: number, vSize: number, value: number): void => {
    for (let u = 0; u < uSize; u++) {
      for (let v = 0; v < vSize; v++) {
        mask[u * vSize + v] = value
      }
    }
  }

  it('emits nothing for an all-zero mask', () => {
    const mask = new Uint32Array(4 * 4)
    const quads: [number, number, number, number, number][] = []
    runGreedyExpansion(mask, 4, 4, (u0, v0, du, dv, mv) => quads.push([u0, v0, du, dv, mv]))
    expect(quads).toHaveLength(0)
  })

  it('emits a single quad for a fully uniform mask', () => {
    const mask = new Uint32Array(3 * 3)
    fill(mask, 3, 3, 5)
    const quads: [number, number, number, number, number][] = []
    runGreedyExpansion(mask, 3, 3, (u0, v0, du, dv, mv) => quads.push([u0, v0, du, dv, mv]))
    expect(quads).toHaveLength(1)
    const [u0, v0, du, dv, mv] = quads[0]!
    expect(u0).toBe(0)
    expect(v0).toBe(0)
    expect(du).toBe(3)
    expect(dv).toBe(3)
    expect(mv).toBe(5)
  })

  it('emits one quad per cell when all values differ', () => {
    const mask = new Uint32Array(2 * 2)
    mask[0] = 1; mask[1] = 2; mask[2] = 3; mask[3] = 4
    const quads: unknown[] = []
    runGreedyExpansion(mask, 2, 2, () => quads.push(null))
    expect(quads).toHaveLength(4)
  })

  it('consumes (zeros out) the merged cells after emitting', () => {
    const mask = new Uint32Array(2 * 2)
    fill(mask, 2, 2, 99)
    runGreedyExpansion(mask, 2, 2, () => {})
    expect(mask.every((v) => v === 0)).toBe(true)
  })

  it('merges a horizontal strip correctly', () => {
    // 1 row, 4 columns — should produce one quad with dv=4
    const uSize = 1, vSize = 4
    const mask = new Uint32Array(uSize * vSize)
    mask.fill(7)
    const quads: [number, number, number, number][] = []
    runGreedyExpansion(mask, uSize, vSize, (u0, v0, du, dv) => quads.push([u0, v0, du, dv]))
    expect(quads).toHaveLength(1)
    expect(quads[0]).toEqual([0, 0, 1, 4])
  })

  it('merges a vertical strip correctly', () => {
    // 4 rows, 1 column — should produce one quad with du=4
    const uSize = 4, vSize = 1
    const mask = new Uint32Array(uSize * vSize)
    mask.fill(3)
    const quads: [number, number, number, number][] = []
    runGreedyExpansion(mask, uSize, vSize, (u0, v0, du, dv) => quads.push([u0, v0, du, dv]))
    expect(quads).toHaveLength(1)
    expect(quads[0]).toEqual([0, 0, 4, 1])
  })

  it('does not merge cells with different mask values', () => {
    const mask = new Uint32Array([1, 2])
    const quads: unknown[] = []
    runGreedyExpansion(mask, 1, 2, () => quads.push(null))
    expect(quads).toHaveLength(2)
  })
})
