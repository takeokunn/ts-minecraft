import { describe, it } from '@effect/vitest'
import type { Position } from '@ts-minecraft/core'
import { expect } from 'vitest'
import {
  buildPortalIgnitionChunkCoords,
  collectAffectedPortalChunkCoords,
} from './interaction-flint-steel-portal'

describe('interaction-flint-steel-portal helpers', () => {
  it('builds the 3x3 chunk neighborhood around the ignition position', () => {
    expect(buildPortalIgnitionChunkCoords({ x: -1, y: 64, z: -1 } as Position)).toEqual([
      { x: -2, z: -2 },
      { x: -2, z: -1 },
      { x: -2, z: 0 },
      { x: -1, z: -2 },
      { x: -1, z: -1 },
      { x: -1, z: 0 },
      { x: 0, z: -2 },
      { x: 0, z: -1 },
      { x: 0, z: 0 },
    ])
  })

  it('deduplicates affected chunk coords by chunk key', () => {
    const affected = collectAffectedPortalChunkCoords([
      { x: 1, y: 64, z: 1 },
      { x: 15, y: 64, z: 15 },
      { x: 16, y: 64, z: 16 },
      { x: -1, y: 64, z: -1 },
      { x: -16, y: 64, z: -16 },
    ] as Array<Position>)

    expect(Array.from(affected.entries())).toEqual([
      ['0,0', { x: 0, z: 0 }],
      ['1,1', { x: 1, z: 1 }],
      ['-1,-1', { x: -1, z: -1 }],
    ])
  })
})
