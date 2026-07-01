import { describe, expect, it } from 'vitest'
import { resolveHeldItemUseRoute } from '../application/frame/stages/interaction-item-use-routing'

// ─── resolveHeldItemUseRoute ──────────────────────────────────────────────────

describe('resolveHeldItemUseRoute — null item', () => {
  it('returns kind=none for null', () => {
    expect(resolveHeldItemUseRoute(null).kind).toBe('none')
  })
})

describe('resolveHeldItemUseRoute — fishing rod', () => {
  it('returns kind=fishingRod for FISHING_ROD', () => {
    expect(resolveHeldItemUseRoute('FISHING_ROD').kind).toBe('fishingRod')
  })
})

describe('resolveHeldItemUseRoute — armor items', () => {
  it('returns kind=armor for IRON_HELMET', () => {
    expect(resolveHeldItemUseRoute('IRON_HELMET').kind).toBe('armor')
  })

  it('returns kind=armor for DIAMOND_CHESTPLATE', () => {
    expect(resolveHeldItemUseRoute('DIAMOND_CHESTPLATE').kind).toBe('armor')
  })

  it('returns kind=armor for LEATHER_BOOTS', () => {
    expect(resolveHeldItemUseRoute('LEATHER_BOOTS').kind).toBe('armor')
  })
})

describe('resolveHeldItemUseRoute — food items', () => {
  it('returns kind=food for APPLE', () => {
    const result = resolveHeldItemUseRoute('APPLE')
    expect(result.kind).toBe('food')
    if (result.kind === 'food') {
      expect(result.food.foodLevel).toBeGreaterThan(0)
    }
  })

  it('returns kind=food for BREAD', () => {
    const result = resolveHeldItemUseRoute('BREAD')
    expect(result.kind).toBe('food')
  })

  it('carries the food properties on the route', () => {
    const result = resolveHeldItemUseRoute('COOKED_PORKCHOP')
    expect(result.kind).toBe('food')
    if (result.kind === 'food') {
      expect(result.food.saturationModifier).toBeGreaterThan(0)
    }
  })
})

describe('resolveHeldItemUseRoute — non-consumable items', () => {
  it('returns kind=none for a sword', () => {
    expect(resolveHeldItemUseRoute('WOODEN_SWORD').kind).toBe('none')
  })

  it('returns kind=none for a pickaxe', () => {
    expect(resolveHeldItemUseRoute('IRON_PICKAXE').kind).toBe('none')
  })

  it('returns kind=none for a block item like STONE', () => {
    expect(resolveHeldItemUseRoute('STONE').kind).toBe('none')
  })
})
