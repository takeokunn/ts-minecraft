import { describe, it, expect } from 'vitest'

import { resolveHeldItemUseRoute } from './interaction-item-use-routing'

describe('resolveHeldItemUseRoute', () => {
  it('returns none when nothing is held', () => {
    expect(resolveHeldItemUseRoute(null)).toEqual({ kind: 'none' })
  })

  it('routes fishing rods to fishingRod', () => {
    expect(resolveHeldItemUseRoute('FISHING_ROD')).toEqual({ kind: 'fishingRod' })
  })

  it('routes armor items to armor', () => {
    expect(resolveHeldItemUseRoute('IRON_HELMET')).toEqual({ kind: 'armor' })
  })

  it('routes food items to food with properties', () => {
    expect(resolveHeldItemUseRoute('APPLE')).toEqual({
      kind: 'food',
      food: { foodLevel: 4, saturationModifier: 0.3 },
    })
  })

  it('returns none for non-usable items', () => {
    expect(resolveHeldItemUseRoute('STONE' as never)).toEqual({ kind: 'none' })
  })
})
