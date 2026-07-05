import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { StackCount } from '@ts-minecraft/core'
import {
  COUNT_BADGE_HEIGHT,
  COUNT_BADGE_HIDDEN,
  badgeAnchorY,
  updateSlotCountBadge,
  type SlotCountBadge,
} from '@ts-minecraft/presentation/hud/hotbar-count-badge'

const makeFakeBadge = () => {
  const context = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '',
  }
  const badge = {
    mesh: { visible: false },
    texture: { needsUpdate: false },
    canvas: { width: 68, height: 44 },
    context,
    shownCount: COUNT_BADGE_HIDDEN,
  }
  return { badge: badge as unknown as SlotCountBadge, context, mesh: badge.mesh, texture: badge.texture }
}

describe('hotbar-count-badge', () => {
  it('stays hidden for an empty slot and for a single item (vanilla never shows "1")', () => {
    const { badge, context, mesh } = makeFakeBadge()

    updateSlotCountBadge(badge, null)
    expect(mesh.visible).toBe(false)
    expect(context.fillText).not.toHaveBeenCalled()

    updateSlotCountBadge(badge, { item: 'STONE', count: StackCount.make(1) })
    expect(mesh.visible).toBe(false)
    expect(context.fillText).not.toHaveBeenCalled()
  })

  it('draws the numeral (shadow + face) and shows the mesh for count > 1', () => {
    const { badge, context, mesh, texture } = makeFakeBadge()

    updateSlotCountBadge(badge, { item: 'STONE', count: StackCount.make(7) })
    expect(mesh.visible).toBe(true)
    expect(texture.needsUpdate).toBe(true)
    // Two fillText calls: dark drop shadow then the white face.
    expect(context.fillText).toHaveBeenCalledTimes(2)
    expect(context.fillText).toHaveBeenLastCalledWith('7', expect.any(Number), expect.any(Number))
  })

  it('redraws only when the displayed value changes (per-frame idempotence)', () => {
    const { badge, context } = makeFakeBadge()

    updateSlotCountBadge(badge, { item: 'STONE', count: StackCount.make(7) })
    updateSlotCountBadge(badge, { item: 'STONE', count: StackCount.make(7) })
    expect(context.fillText).toHaveBeenCalledTimes(2)

    updateSlotCountBadge(badge, { item: 'STONE', count: StackCount.make(6) })
    expect(context.fillText).toHaveBeenCalledTimes(4)
  })

  it('hides again when the stack drains to a single item', () => {
    const { badge, mesh } = makeFakeBadge()

    updateSlotCountBadge(badge, { item: 'STONE', count: StackCount.make(2) })
    expect(mesh.visible).toBe(true)

    updateSlotCountBadge(badge, { item: 'STONE', count: StackCount.make(1) })
    expect(mesh.visible).toBe(false)
  })

  it('anchors the badge inside the slot bottom edge', () => {
    // slot center 100, slot size 60: badge center must sit above the slot's
    // bottom edge (70) by half the badge height plus the 1px inset.
    expect(badgeAnchorY(100, 60)).toBe(100 - 30 + COUNT_BADGE_HEIGHT / 2 + 1)
  })
})
