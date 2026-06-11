import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import {
  detectNetherPortal,
  generatePortalLayout,
  MIN_PORTAL_WIDTH,
  MAX_PORTAL_WIDTH,
  MIN_PORTAL_HEIGHT,
  MAX_PORTAL_HEIGHT,
  type BlockAt,
  type PortalAxis,
} from './portal-frame'
import type { BlockType, Position } from '@ts-minecraft/core'

// Build a BlockAt function from a Set of OBSIDIAN positions.
// Everything else is AIR.
const makeBlockAt = (obsidianSet: ReadonlyArray<Position>): BlockAt => {
  const key = (x: number, y: number, z: number): string => `${x},${y},${z}`
  const set = new Set(obsidianSet.map((p) => key(p.x, p.y, p.z)))
  return (x, y, z): BlockType => (set.has(key(x, y, z)) ? 'OBSIDIAN' : 'AIR')
}

// Build a complete portal using generatePortalLayout, then create a BlockAt for it.
const makePortalBlockAt = (origin: Position, axis: PortalAxis, width: number, height: number): BlockAt => {
  const layout = generatePortalLayout(origin, axis, width, height)
  return makeBlockAt(layout.frame)
}

describe('generatePortalLayout', () => {
  it('produces the right number of interior cells', () => {
    const { interior } = generatePortalLayout({ x: 0, y: 64, z: 0 }, 'x', 2, 3)
    expect(interior).toHaveLength(2 * 3)
  })

  it('produces non-empty frame', () => {
    const { frame } = generatePortalLayout({ x: 0, y: 64, z: 0 }, 'x', 2, 3)
    expect(frame.length).toBeGreaterThan(0)
  })

  it('frame and interior are disjoint', () => {
    const { frame, interior } = generatePortalLayout({ x: 0, y: 64, z: 0 }, 'x', 4, 5)
    const interiorSet = new Set(interior.map((p) => `${p.x},${p.y},${p.z}`))
    for (const f of frame) {
      expect(interiorSet.has(`${f.x},${f.y},${f.z}`)).toBe(false)
    }
  })

  it('z-axis interior positions share the same x origin', () => {
    const { interior } = generatePortalLayout({ x: 10, y: 64, z: 5 }, 'z', 2, 3)
    for (const p of interior) {
      expect(p.x).toBe(10)
    }
  })

  it('x-axis interior positions share the same z origin', () => {
    const { interior } = generatePortalLayout({ x: 5, y: 64, z: 10 }, 'x', 2, 3)
    for (const p of interior) {
      expect(p.z).toBe(10)
    }
  })
})

describe('detectNetherPortal', () => {
  it('detects a minimal valid x-axis portal (2×3)', () => {
    const blockAt = makePortalBlockAt({ x: 0, y: 64, z: 0 }, 'x', 2, 3)
    const result = detectNetherPortal(blockAt, { x: 0, y: 64, z: 0 })
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.width).toBe(2)
      expect(result.value.height).toBe(3)
    }
  })

  it('detects a minimal valid z-axis portal (2×3)', () => {
    const blockAt = makePortalBlockAt({ x: 0, y: 64, z: 0 }, 'z', 2, 3)
    const result = detectNetherPortal(blockAt, { x: 0, y: 64, z: 0 })
    expect(Option.isSome(result)).toBe(true)
  })

  it('detects a larger portal (4×5)', () => {
    const blockAt = makePortalBlockAt({ x: 0, y: 64, z: 0 }, 'x', 4, 5)
    const result = detectNetherPortal(blockAt, { x: 0, y: 64, z: 0 })
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.width).toBe(4)
      expect(result.value.height).toBe(5)
    }
  })

  it('returns none when ignition block is not AIR', () => {
    const blockAt = makeBlockAt([{ x: 0, y: 64, z: 0 }])
    const result = detectNetherPortal(blockAt, { x: 0, y: 64, z: 0 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns none when ring has a missing obsidian block', () => {
    const layout = generatePortalLayout({ x: 0, y: 64, z: 0 }, 'x', 2, 3)
    // Remove a required bottom-edge block (not a corner) — (0, 63, 0)
    const incomplete = layout.frame.filter((p) => !(p.x === 0 && p.y === 63 && p.z === 0))
    const blockAt = makeBlockAt(incomplete)
    const result = detectNetherPortal(blockAt, { x: 0, y: 64, z: 0 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns none when interior has a non-AIR block', () => {
    const layout = generatePortalLayout({ x: 0, y: 64, z: 0 }, 'x', 2, 3)
    // Add obsidian inside the interior
    const blockAt = makeBlockAt([...layout.frame, ...layout.interior])
    const result = detectNetherPortal(blockAt, { x: 0, y: 64, z: 0 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('detects portal ignition from a non-bottom-left interior position', () => {
    const layout = generatePortalLayout({ x: 0, y: 64, z: 0 }, 'x', 3, 4)
    const blockAt = makeBlockAt(layout.frame)
    // Ignite from the center of the interior
    const centerCell = layout.interior[Math.floor(layout.interior.length / 2)]!
    const result = detectNetherPortal(blockAt, centerCell)
    expect(Option.isSome(result)).toBe(true)
  })

  it('interior positions round-trip: detected interior matches generated interior', () => {
    const origin = { x: 5, y: 70, z: -3 }
    const layout = generatePortalLayout(origin, 'x', 2, 3)
    const blockAt = makeBlockAt(layout.frame)
    const result = detectNetherPortal(blockAt, layout.interior[0]!)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.interior).toHaveLength(layout.interior.length)
    }
  })
})

describe('portal frame size constants', () => {
  it('minimum portal width is 2', () => {
    expect(MIN_PORTAL_WIDTH).toBe(2)
  })
  it('minimum portal height is 3', () => {
    expect(MIN_PORTAL_HEIGHT).toBe(3)
  })
  it('maximum portal dimensions are at least 21', () => {
    expect(MAX_PORTAL_WIDTH).toBeGreaterThanOrEqual(21)
    expect(MAX_PORTAL_HEIGHT).toBeGreaterThanOrEqual(21)
  })
})
