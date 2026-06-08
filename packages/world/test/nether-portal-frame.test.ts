import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import type { BlockType } from '@ts-minecraft/core'
import {
  detectNetherPortal,
  generatePortalLayout,
  type BlockAt,
} from '@ts-minecraft/world'

// ── Test world helpers ───────────────────────────────────────────────────────

const key = (x: number, y: number, z: number): string => `${x},${y},${z}`

type Cell = readonly [number, number, number]
type Override = readonly [number, number, number, BlockType]

// Builds a BlockAt from explicit OBSIDIAN positions; every other cell defaults to
// AIR (open space), with optional per-cell overrides for stray-block cases.
const makeWorld = (obsidian: ReadonlyArray<Cell>, overrides: ReadonlyArray<Override> = []): BlockAt => {
  const map = new Map<string, BlockType>()
  obsidian.forEach(([x, y, z]) => map.set(key(x, y, z), 'OBSIDIAN'))
  overrides.forEach(([x, y, z, b]) => map.set(key(x, y, z), b))
  return (x, y, z) => Option.getOrElse(Option.fromNullable(map.get(key(x, y, z))), (): BlockType => 'AIR')
}

// Obsidian ring (corners excluded, per vanilla) for an X-aligned portal whose
// interior is [leftH..leftH+w-1] × [bottomY..bottomY+h-1] at fixed z.
const xRing = (leftH: number, bottomY: number, z: number, w: number, h: number): Cell[] => {
  const cells: Cell[] = []
  for (let i = 0; i < w; i++) {
    cells.push([leftH + i, bottomY - 1, z], [leftH + i, bottomY + h, z])
  }
  for (let j = 0; j < h; j++) {
    cells.push([leftH - 1, bottomY + j, z], [leftH + w, bottomY + j, z])
  }
  return cells
}

// Obsidian ring for a Z-aligned portal at fixed x, interior z in [leftZ..leftZ+w-1].
const zRing = (x: number, bottomY: number, leftZ: number, w: number, h: number): Cell[] => {
  const cells: Cell[] = []
  for (let i = 0; i < w; i++) {
    cells.push([x, bottomY - 1, leftZ + i], [x, bottomY + h, leftZ + i])
  }
  for (let j = 0; j < h; j++) {
    cells.push([x, bottomY + j, leftZ - 1], [x, bottomY + j, leftZ + w])
  }
  return cells
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('detectNetherPortal', () => {
  it('detects a minimal 2x3 X-aligned portal from a non-corner ignition cell', () => {
    const world = makeWorld(xRing(10, 64, 20, 2, 3))
    // ignition in the middle of the interior — exercises the walk-to-corner logic.
    const result = detectNetherPortal(world, { x: 11, y: 65, z: 20 })

    expect(Option.isSome(result)).toBe(true)
    const frame = Option.getOrThrow(result)
    expect(frame.axis).toBe('x')
    expect(frame.width).toBe(2)
    expect(frame.height).toBe(3)
    expect(frame.interior).toHaveLength(6)
    expect(frame.interior).toContainEqual({ x: 10, y: 64, z: 20 })
    expect(frame.interior).toContainEqual({ x: 11, y: 66, z: 20 })
  })

  it('detects a Z-aligned portal (X-plane is rejected first, falling through to Z)', () => {
    const world = makeWorld(zRing(5, 64, 30, 2, 3))
    const result = detectNetherPortal(world, { x: 5, y: 64, z: 30 })

    expect(Option.isSome(result)).toBe(true)
    const frame = Option.getOrThrow(result)
    expect(frame.axis).toBe('z')
    expect(frame.width).toBe(2)
    expect(frame.height).toBe(3)
    expect(frame.interior).toHaveLength(6)
  })

  it('detects a larger 3x4 portal', () => {
    const world = makeWorld(xRing(0, 70, 0, 3, 4))
    const result = detectNetherPortal(world, { x: 1, y: 71, z: 0 })

    expect(Option.isSome(result)).toBe(true)
    const frame = Option.getOrThrow(result)
    expect(frame.width).toBe(3)
    expect(frame.height).toBe(4)
    expect(frame.interior).toHaveLength(12)
  })

  it('floors a fractional ignition position to block coordinates', () => {
    const world = makeWorld(xRing(10, 64, 20, 2, 3))
    const result = detectNetherPortal(world, { x: 11.8, y: 65.4, z: 20.9 })
    expect(Option.isSome(result)).toBe(true)
  })

  it('returns None when the ignition block is not AIR', () => {
    const world = makeWorld(xRing(10, 64, 20, 2, 3), [[11, 65, 20, 'STONE']])
    const result = detectNetherPortal(world, { x: 11, y: 65, z: 20 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns None when the interior is too narrow (width < 2)', () => {
    // Interior 1 wide x 3 tall — width below the minimum.
    const world = makeWorld(xRing(10, 64, 20, 1, 3))
    const result = detectNetherPortal(world, { x: 10, y: 64, z: 20 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns None when the interior is too wide (width > 21) — also exercises the scan cap', () => {
    const world = makeWorld(xRing(10, 64, 20, 22, 3))
    const result = detectNetherPortal(world, { x: 10, y: 64, z: 20 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns None when the interior is too short (height < 3)', () => {
    const world = makeWorld(xRing(10, 64, 20, 2, 2))
    const result = detectNetherPortal(world, { x: 10, y: 64, z: 20 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns None when the interior is too tall (height > 21)', () => {
    const world = makeWorld(xRing(10, 64, 20, 2, 22))
    const result = detectNetherPortal(world, { x: 10, y: 64, z: 20 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns None when a stray solid block obstructs the interior', () => {
    // Valid 2x3 frame, but one interior cell (top-right) holds STONE.
    const world = makeWorld(xRing(10, 64, 20, 2, 3), [[11, 66, 20, 'STONE']])
    const result = detectNetherPortal(world, { x: 10, y: 64, z: 20 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns None when the obsidian ring is incomplete (a side block is missing)', () => {
    // Build the full ring, then drop one right-edge obsidian to AIR.
    const full = xRing(10, 64, 20, 2, 3)
    const holed = full.filter(([x, y, z]) => !(x === 12 && y === 65 && z === 20))
    const world = makeWorld(holed)
    const result = detectNetherPortal(world, { x: 10, y: 64, z: 20 })
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns None in fully open space (no frame at all)', () => {
    const world = makeWorld([])
    const result = detectNetherPortal(world, { x: 0, y: 64, z: 0 })
    expect(Option.isNone(result)).toBe(true)
  })
})

describe('generatePortalLayout', () => {
  it('builds a full obsidian ring (corners included) and interior for an X-aligned 2x3 portal', () => {
    const layout = generatePortalLayout({ x: 10, y: 64, z: 20 }, 'x', 2, 3)
    expect(layout.interior).toHaveLength(6)
    expect(layout.frame).toHaveLength(14) // perimeter of the 4x5 outer rectangle (corners included)
    expect(layout.interior).toContainEqual({ x: 10, y: 64, z: 20 })
    expect(layout.frame).toContainEqual({ x: 9, y: 63, z: 20 }) // bottom-left corner
    expect(layout.frame).toContainEqual({ x: 12, y: 67, z: 20 }) // top-right corner
  })

  it('builds a Z-aligned portal layout sharing a fixed x', () => {
    const layout = generatePortalLayout({ x: 5, y: 64, z: 30 }, 'z', 2, 3)
    expect(layout.interior).toHaveLength(6)
    expect(layout.frame).toHaveLength(14)
    expect(layout.interior).toContainEqual({ x: 5, y: 64, z: 30 })
    expect(layout.interior.every((p) => p.x === 5)).toBe(true)
  })

  it('round-trips: a generated X-portal is detected back with matching dimensions', () => {
    const layout = generatePortalLayout({ x: 10, y: 64, z: 20 }, 'x', 3, 4)
    const world = makeWorld(layout.frame.map((p) => [p.x, p.y, p.z] as const))
    const result = detectNetherPortal(world, layout.interior[0]!)
    expect(Option.isSome(result)).toBe(true)
    const frame = Option.getOrThrow(result)
    expect(frame.axis).toBe('x')
    expect(frame.width).toBe(3)
    expect(frame.height).toBe(4)
  })

  it('round-trips: a generated Z-portal is detected back on the Z axis', () => {
    const layout = generatePortalLayout({ x: 7, y: 70, z: 50 }, 'z', 2, 3)
    const world = makeWorld(layout.frame.map((p) => [p.x, p.y, p.z] as const))
    const result = detectNetherPortal(world, layout.interior[0]!)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result).axis).toBe('z')
  })
})
