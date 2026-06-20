import { describe, it, expect } from 'vitest'
import type { BlockType, Position } from '@ts-minecraft/core'
import {
  CHORUS_PLANT_MAX_HEIGHT,
  canChorusFlowerGrow,
  growChorusPlant,
  type ChorusWorldState,
} from '@ts-minecraft/block/domain/chorus-plant'

const key = (position: Position): string => `${position.x},${position.y},${position.z}`

const world = (blocks: ReadonlyArray<readonly [Position, BlockType]>): ChorusWorldState => {
  const map = new Map(blocks.map(([position, block]) => [key(position), block]))
  return { blockAt: (position) => map.get(key(position)) ?? 'AIR' }
}

describe('chorus plant growth', () => {
  it('uses a five-block maximum height', () => {
    expect(CHORUS_PLANT_MAX_HEIGHT).toBe(5)
  })

  it('allows a chorus flower to grow on END_STONE with air above', () => {
    const state = world([[{ x: 0, y: 63, z: 0 }, 'END_STONE']])
    expect(canChorusFlowerGrow({ x: 0, y: 64, z: 0 }, state)).toBe(true)
  })

  it('allows growth on an existing CHORUS_PLANT', () => {
    const state = world([
      [{ x: 0, y: 63, z: 0 }, 'END_STONE'],
      [{ x: 0, y: 64, z: 0 }, 'CHORUS_PLANT'],
    ])
    expect(canChorusFlowerGrow({ x: 0, y: 65, z: 0 }, state)).toBe(true)
  })

  it('rejects missing support, blocked air, and max-height plants', () => {
    expect(canChorusFlowerGrow({ x: 0, y: 64, z: 0 }, world([]))).toBe(false)
    expect(canChorusFlowerGrow({ x: 0, y: 64, z: 0 }, world([
      [{ x: 0, y: 63, z: 0 }, 'END_STONE'],
      [{ x: 0, y: 65, z: 0 }, 'STONE'],
    ]))).toBe(false)

    const tall = Array.from({ length: CHORUS_PLANT_MAX_HEIGHT }, (_, i) =>
      [{ x: 0, y: 64 + i, z: 0 }, i === 4 ? 'CHORUS_FLOWER' : 'CHORUS_PLANT'] as const)
    expect(canChorusFlowerGrow({ x: 0, y: 68, z: 0 }, world(tall))).toBe(false)
  })

  it('grows upward from END_STONE and caps with CHORUS_FLOWER', () => {
    const result = growChorusPlant({ x: 4, y: 63, z: -2 })
    const vertical = result.newBlocks.filter((block) => block.pos.x === 4 && block.pos.z === -2)

    expect(vertical.length).toBeGreaterThanOrEqual(2)
    expect(vertical.length).toBeLessThanOrEqual(CHORUS_PLANT_MAX_HEIGHT)
    expect(vertical.at(-1)?.blockType).toBe('CHORUS_FLOWER')
    expect(vertical.slice(0, -1).every((block) => block.blockType === 'CHORUS_PLANT')).toBe(true)
  })

  it('is deterministic and may include one-block branches capped by flowers', () => {
    const first = growChorusPlant({ x: 3, y: 63, z: 7 })
    const second = growChorusPlant({ x: 3, y: 63, z: 7 })

    expect(second).toEqual(first)
    expect(first.newBlocks.every((block) => block.blockType === 'CHORUS_PLANT' || block.blockType === 'CHORUS_FLOWER')).toBe(true)
  })
})
