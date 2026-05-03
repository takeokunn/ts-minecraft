import { describe, it } from '@effect/vitest'
import { Array as Arr, HashMap, HashSet, Option } from 'effect'
import { expect } from 'vitest'
import {
  WATER_MAX_LEVEL,
  LAVA_MAX_LEVEL,
  FLUID_TICK_BUDGET,
  LAVA_TICK_INTERVAL,
  FLOW_OFFSETS,
  NOTIFY_OFFSETS,
  FluidKey,
  INITIAL_STATE,
} from '@ts-minecraft/world-state'
import { decodeFluidByte, encodeFluidCell } from '../domain/fluid'

describe('constants sanity checks', () => {
  it('WATER_MAX_LEVEL is 7', () => {
    expect(WATER_MAX_LEVEL).toBe(7)
  })

  it('LAVA_MAX_LEVEL is 3', () => {
    expect(LAVA_MAX_LEVEL).toBe(3)
  })

  it('FLUID_TICK_BUDGET is positive', () => {
    expect(FLUID_TICK_BUDGET).toBeGreaterThan(0)
  })

  it('LAVA_TICK_INTERVAL is greater than 1 (lava is slower than water)', () => {
    expect(LAVA_TICK_INTERVAL).toBeGreaterThan(1)
  })
})

describe('FLOW_OFFSETS', () => {
  it('has exactly 4 entries (horizontal only)', () => {
    expect(FLOW_OFFSETS).toHaveLength(4)
  })

  it('all entries have y=0 (horizontal spread only)', () => {
    Arr.forEach(FLOW_OFFSETS, (offset) => {
      expect(offset.y).toBe(0)
    })
  })
})

describe('NOTIFY_OFFSETS', () => {
  it('has exactly 6 entries (all 6 faces)', () => {
    expect(NOTIFY_OFFSETS).toHaveLength(6)
  })

  it('includes y=1 entry (upward notification)', () => {
    const hasYUp = Arr.some(NOTIFY_OFFSETS, o => o.y === 1 && o.x === 0 && o.z === 0)
    expect(hasYUp).toBe(true)
  })

  it('includes y=-1 entry (downward notification)', () => {
    const hasYDown = Arr.some(NOTIFY_OFFSETS, o => o.y === -1 && o.x === 0 && o.z === 0)
    expect(hasYDown).toBe(true)
  })
})

describe('FluidKey brand', () => {
  it('FluidKey(0) is a valid FluidKey with value 0', () => {
    const key = FluidKey(0)
    expect(key).toBe(0)
  })

  it('different numeric values produce different keys', () => {
    const k1 = FluidKey(1)
    const k2 = FluidKey(2)
    expect(k1).not.toBe(k2)
  })
})

describe('INITIAL_STATE', () => {
  it('cells is empty', () => {
    expect(HashMap.size(INITIAL_STATE.cells)).toBe(0)
  })

  it('frontier is empty', () => {
    expect(HashSet.size(INITIAL_STATE.frontier)).toBe(0)
  })

  it('tickCounter is 0', () => {
    expect(INITIAL_STATE.tickCounter).toBe(0)
  })
})

describe('decodeFluidByte', () => {
  it('returns Option.none() for byte 0 (no fluid present)', () => {
    expect(decodeFluidByte(0)).toEqual(Option.none())
  })

  it('returns Option.some with water cell when FLUID_PRESENT_MASK is set', () => {
    // Encode a water source at level 0, then decode it
    const encoded = encodeFluidCell({ level: 0, source: true, type: 'water' })
    const result = decodeFluidByte(encoded)
    expect(Option.isSome(result)).toBe(true)
    const cell = Option.getOrThrow(result)
    expect(cell.type).toBe('water')
    expect(cell.source).toBe(true)
    expect(cell.level).toBe(0)
  })

  it('returns Option.some with lava cell when lava type bit is set', () => {
    const encoded = encodeFluidCell({ level: 3, source: false, type: 'lava' })
    const result = decodeFluidByte(encoded)
    expect(Option.isSome(result)).toBe(true)
    const cell = Option.getOrThrow(result)
    expect(cell.type).toBe('lava')
    expect(cell.source).toBe(false)
    expect(cell.level).toBe(3)
  })

  it('round-trips: encode then decode returns original cell', () => {
    const original = { level: 5, source: false, type: 'water' as const }
    const encoded = encodeFluidCell(original)
    const decoded = decodeFluidByte(encoded)
    expect(Option.isSome(decoded)).toBe(true)
    const cell = Option.getOrThrow(decoded)
    expect(cell.level).toBe(original.level)
    expect(cell.source).toBe(original.source)
    expect(cell.type).toBe(original.type)
  })
})
