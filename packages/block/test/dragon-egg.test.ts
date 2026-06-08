import { describe, it, expect } from 'vitest'
import {
  DRAGON_EGG_TELEPORT_RANGE,
  computeDragonEggTeleport,
} from '@ts-minecraft/block'

describe('dragon egg teleport behavior', () => {
  it('uses a fifteen-block horizontal teleport range', () => {
    expect(DRAGON_EGG_TELEPORT_RANGE).toBe(15)
  })

  it('teleports by supplied random offsets within the 15x7x15 volume', () => {
    const result = computeDragonEggTeleport(
      { x: 10.8, y: 70.2, z: -5.9 },
      { x: 8.9, y: -3.2, z: -12.7 },
    )

    expect(result).toEqual({ x: 18, y: 67, z: -18 })
  })

  it('clamps excessive random offsets to vanilla bounds', () => {
    const result = computeDragonEggTeleport(
      { x: 0, y: 64, z: 0 },
      { x: 99, y: 99, z: -99 },
    )

    expect(result).toEqual({ x: 15, y: 71, z: -15 })
  })

  it('falls to the nearest solid surface when destination has no support below', () => {
    const result = computeDragonEggTeleport(
      { x: 0, y: 70, z: 0 },
      { x: 4, y: 6, z: -2, nearestSolidSurfaceY: 64 },
    )

    expect(result).toEqual({ x: 4, y: 65, z: -2 })
  })

  it('does not raise an already lower destination up to a surface', () => {
    const result = computeDragonEggTeleport(
      { x: 0, y: 70, z: 0 },
      { x: 1, y: -7, z: 1, nearestSolidSurfaceY: 64 },
    )

    expect(result).toEqual({ x: 1, y: 63, z: 1 })
  })
})
