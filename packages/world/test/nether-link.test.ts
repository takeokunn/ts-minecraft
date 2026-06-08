import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  NETHER_HORIZONTAL_RATIO,
  overworldToNether,
  netherToOverworld,
  findNearestPortal,
} from '@ts-minecraft/world'

describe('nether-link coordinate scaling', () => {
  it('NETHER_HORIZONTAL_RATIO is 8 (vanilla)', () => {
    expect(NETHER_HORIZONTAL_RATIO).toBe(8)
  })

  it('overworldToNether divides horizontal axes by 8 and preserves y', () => {
    expect(overworldToNether({ x: 80, y: 64, z: 160 })).toEqual({ x: 10, y: 64, z: 20 })
  })

  it('overworldToNether floors toward negative infinity for negative coords', () => {
    // -9 / 8 = -1.125 → floor -2 (vanilla floor-division behaviour)
    expect(overworldToNether({ x: -9, y: 70, z: -1 })).toEqual({ x: -2, y: 70, z: -1 })
  })

  it('netherToOverworld multiplies horizontal axes by 8 and preserves y', () => {
    expect(netherToOverworld({ x: 10, y: 64, z: 20 })).toEqual({ x: 80, y: 64, z: 160 })
    expect(netherToOverworld({ x: -2, y: 70, z: -1 })).toEqual({ x: -16, y: 70, z: -8 })
  })
})

describe('findNearestPortal', () => {
  const target = { x: 0, y: 64, z: 0 }

  it('returns None when there are no candidate portals', () => {
    expect(Option.isNone(findNearestPortal([], target, 128))).toBe(true)
  })

  it('returns None when all candidates are outside the search radius', () => {
    const far = [{ x: 1000, y: 64, z: 0 }, { x: 0, y: 64, z: 1000 }]
    expect(Option.isNone(findNearestPortal(far, target, 128))).toBe(true)
  })

  it('returns the single candidate within range', () => {
    const c = { x: 10, y: 64, z: 0 }
    const result = findNearestPortal([c], target, 128)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toEqual(c)
  })

  it('returns the nearest candidate when several are in range', () => {
    const near = { x: 5, y: 64, z: 0 }
    const mid = { x: 20, y: 64, z: 0 }
    const result = findNearestPortal([mid, near], target, 128)
    expect(Option.getOrThrow(result)).toEqual(near)
  })

  it('keeps the earliest candidate on a distance tie', () => {
    const a = { x: 10, y: 64, z: 0 }
    const b = { x: 0, y: 64, z: 10 } // same distance from target as a
    const result = findNearestPortal([a, b], target, 128)
    expect(Option.getOrThrow(result)).toEqual(a)
  })

  it('ignores out-of-range candidates while selecting an in-range one', () => {
    const far = { x: 1000, y: 64, z: 0 }
    const near = { x: 12, y: 64, z: 0 }
    const result = findNearestPortal([far, near], target, 128)
    expect(Option.getOrThrow(result)).toEqual(near)
  })
})
