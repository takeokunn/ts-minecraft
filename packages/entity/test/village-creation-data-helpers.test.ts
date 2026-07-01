import { describe, expect, it } from 'vitest'
import {
  buildAnchor,
  buildScopedId,
} from '@ts-minecraft/entity/domain/village/village-creation-data.helpers'
import type { StructureTemplate } from '@ts-minecraft/entity/domain/village/village-creation-data'

// ─── buildScopedId ────────────────────────────────────────────────────────────

describe('buildScopedId', () => {
  it('joins parent and suffix with a colon', () => {
    expect(buildScopedId('village-1', 'house-a')).toBe('village-1:house-a')
  })

  it('works for deeply nested IDs', () => {
    expect(buildScopedId('v:2', 'villager-farmer')).toBe('v:2:villager-farmer')
  })

  it('preserves empty suffix (edge case)', () => {
    expect(buildScopedId('parent', '')).toBe('parent:')
  })
})

// ─── buildAnchor ──────────────────────────────────────────────────────────────

const makeTemplate = (offsetX: number, offsetY: number, offsetZ: number): StructureTemplate => ({
  suffix: 'test',
  type: 'house',
  offsetX,
  offsetY,
  offsetZ,
  sizeX: 4,
  sizeY: 4,
  sizeZ: 4,
})

describe('buildAnchor', () => {
  it('adds template offsets to the center position', () => {
    const center = { x: 100, y: 64, z: 200 }
    const anchor = buildAnchor(center, makeTemplate(-8, 0, 6))
    expect(anchor).toEqual({ x: 92, y: 64, z: 206 })
  })

  it('returns a zero-offset anchor when all offsets are 0', () => {
    const center = { x: 50, y: 60, z: 70 }
    expect(buildAnchor(center, makeTemplate(0, 0, 0))).toEqual(center)
  })

  it('handles negative offsets in all axes', () => {
    const center = { x: 0, y: 64, z: 0 }
    const anchor = buildAnchor(center, makeTemplate(-12, -2, -12))
    expect(anchor).toEqual({ x: -12, y: 62, z: -12 })
  })

  it('handles positive offsets in all axes', () => {
    const center = { x: 10, y: 64, z: 10 }
    const anchor = buildAnchor(center, makeTemplate(5, 3, 7))
    expect(anchor).toEqual({ x: 15, y: 67, z: 17 })
  })
})
