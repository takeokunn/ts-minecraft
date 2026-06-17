import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'

import { resolveRightClickTargetRoute } from './interaction-right-click-target-routing'

describe('resolveRightClickTargetRoute', () => {
  it('routes chests to chest interaction', () => {
    expect(resolveRightClickTargetRoute({ x: 1, y: 2, z: 3 }, 'CHEST')).toEqual({
      kind: 'chest',
      targetPos: { x: 1, y: 2, z: 3 },
    })
  })

  it('routes furnaces to furnace interaction', () => {
    expect(resolveRightClickTargetRoute({ x: 1, y: 2, z: 3 }, 'FURNACE')).toEqual({
      kind: 'furnace',
      targetPos: { x: 1, y: 2, z: 3 },
    })
  })

  it('routes beds to bed interaction', () => {
    expect(resolveRightClickTargetRoute({ x: 1, y: 2, z: 3 }, 'BED')).toEqual({
      kind: 'bed',
      targetPos: { x: 1, y: 2, z: 3 },
    })
  })

  it('routes enchanting tables to enchantment interaction', () => {
    expect(resolveRightClickTargetRoute({ x: 1, y: 2, z: 3 }, 'ENCHANTING_TABLE')).toEqual({
      kind: 'enchantingTable',
      targetPos: { x: 1, y: 2, z: 3 },
    })
  })

  it('routes doors with the concrete door block type', () => {
    expect(resolveRightClickTargetRoute({ x: 1, y: 2, z: 3 }, 'DOOR_OPEN')).toEqual({
      kind: 'door',
      targetPos: { x: 1, y: 2, z: 3 },
      blockType: 'DOOR_OPEN',
    })
  })

  it('returns null for blocks that should fall through to placement', () => {
    expect(resolveRightClickTargetRoute({ x: 1, y: 2, z: 3 }, 'AIR')).toBeNull()
  })
})
