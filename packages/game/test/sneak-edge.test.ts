import { describe, it, expect } from 'vitest'
import { clampSneakEdge } from '@ts-minecraft/game'

describe('clampSneakEdge (R7 — sneak edge-protection)', () => {
  const prev = { x: 0, z: 0 }
  const next = { x: 1, z: 1 }

  it('does not clamp on flat ground (support everywhere)', () => {
    expect(clampSneakEdge(prev, next, () => true)).toEqual({ x: 1, z: 1 })
  })

  it('reverts X when the new X (with prev Z) is unsupported, keeps Z', () => {
    // Support exists except at the destination X column.
    const support = (x: number, _z: number) => x !== next.x
    expect(clampSneakEdge(prev, next, support)).toEqual({ x: 0, z: 1 })
  })

  it('reverts Z when the new Z (with prev X) is unsupported, keeps X', () => {
    const support = (_x: number, z: number) => z !== next.z
    expect(clampSneakEdge(prev, next, support)).toEqual({ x: 1, z: 0 })
  })

  it('reverts both axes when the whole destination is a drop', () => {
    expect(clampSneakEdge(prev, next, () => false)).toEqual({ x: 0, z: 0 })
  })

  it('allows sliding along an edge: Z move stays even when the X direction is a cliff', () => {
    // Player walks parallel to a cliff that lies in +X; only the +X step lacks support.
    const support = (x: number, _z: number) => x <= 0
    const result = clampSneakEdge({ x: 0, z: 0 }, { x: 0, z: 1 }, support)
    expect(result).toEqual({ x: 0, z: 1 }) // pure Z move, no X change → unaffected
  })

  it('does not clamp an axis that did not move', () => {
    // Only X moved; Z unchanged → Z is never tested even if support(prevX, z) is false.
    const result = clampSneakEdge({ x: 0, z: 5 }, { x: 1, z: 5 }, (x: number) => x <= 0)
    expect(result).toEqual({ x: 0, z: 5 })
  })
})
