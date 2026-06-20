import { describe, it, expect } from 'vitest'
import { FluidKey } from '@ts-minecraft/block/domain/fluid-model'
import type { FluidCell } from '@ts-minecraft/block/domain/fluid-model'
import { splitBudget } from '../application/fluid-tick-budget'

const waterCell = (level = 7): FluidCell => ({ type: 'water', level })
const lavaCell = (level = 3): FluidCell => ({ type: 'lava', level })
const key = (n: number): FluidKey => FluidKey(n)

const waterItem = (n: number) => ({ key: key(n), cell: waterCell() })
const lavaItem = (n: number) => ({ key: key(n + 1000), cell: lavaCell() })

describe('splitBudget', () => {
  it('returns empty work and no frontier for empty input', () => {
    const result = splitBudget([], true, 10)
    expect(result.work).toHaveLength(0)
    expect(result.retainedLavaFrontier).toHaveLength(0)
  })

  it('processes only water when lavaTickActive=false', () => {
    const items = [waterItem(0), waterItem(1), lavaItem(0)]
    const result = splitBudget(items, false, 10)
    const types = result.work.map(({ cell }) => cell.type)
    expect(types.every(t => t === 'water')).toBe(true)
  })

  it('returns lava keys as retainedLavaFrontier when lavaTickActive=false', () => {
    const items = [waterItem(0), lavaItem(0), lavaItem(1)]
    const result = splitBudget(items, false, 10)
    expect(result.retainedLavaFrontier).toHaveLength(2)
    expect(result.retainedLavaFrontier[0]).toBe(key(1000))
    expect(result.retainedLavaFrontier[1]).toBe(key(1001))
  })

  it('retainedLavaFrontier is empty when lavaTickActive=true', () => {
    const items = [waterItem(0), lavaItem(0)]
    const result = splitBudget(items, true, 10)
    expect(result.retainedLavaFrontier).toHaveLength(0)
  })

  it('splits budget 50/50 between water and lava when both present', () => {
    const items = [
      waterItem(0), waterItem(1), waterItem(2),
      lavaItem(0), lavaItem(1), lavaItem(2),
    ]
    // budget=4 → halfBudget=2: up to 2 water, up to 2 lava
    const result = splitBudget(items, true, 4)
    const waterCount = result.work.filter(({ cell }) => cell.type === 'water').length
    const lavaCount = result.work.filter(({ cell }) => cell.type === 'lava').length
    expect(waterCount).toBe(2)
    expect(lavaCount).toBe(2)
    expect(result.work).toHaveLength(4)
  })

  it('lava takes remaining budget when water is fewer than half', () => {
    // 1 water item, budget=4 → halfBudget=2 → water=1, lava can use 4-1=3
    const items = [waterItem(0), lavaItem(0), lavaItem(1), lavaItem(2), lavaItem(3)]
    const result = splitBudget(items, true, 4)
    const waterCount = result.work.filter(({ cell }) => cell.type === 'water').length
    const lavaCount = result.work.filter(({ cell }) => cell.type === 'lava').length
    expect(waterCount).toBe(1)
    expect(lavaCount).toBe(3)
  })

  it('respects total budget ceiling', () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => i < 10 ? waterItem(i) : lavaItem(i))
    const result = splitBudget(manyItems, true, 6)
    expect(result.work.length).toBeLessThanOrEqual(6)
  })
})
