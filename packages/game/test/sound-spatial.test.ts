import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'

import { computeSpatial } from '../domain/sound-spatial'

describe('audio/sound-spatial', () => {
  it('computes relative position, attenuation, and pan from listener/source coordinates', () => {
    const result = computeSpatial(
      { x: 10, y: 64, z: -4 },
      { x: 22, y: 70, z: 8 },
    )

    expect(result.position).toEqual({ x: 12, y: 6, z: 12 })
    expect(result.gain).toBeCloseTo(1 / (1 + Math.sqrt(324) / 12), 6)
    expect(result.pan).toBeCloseTo(1, 6)
  })

  it('keeps nearby sources centered with full gain at zero distance', () => {
    const result = computeSpatial(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    )

    expect(result.position).toEqual({ x: 0, y: 0, z: 0 })
    expect(result.gain).toBeCloseTo(1, 6)
    expect(result.pan).toBeCloseTo(0, 6)
  })
})
