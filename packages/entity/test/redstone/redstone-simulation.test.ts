import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashMap, HashSet } from 'effect'
import {
  RedstonePowerLevel,
  RedstoneComponentType,
  canConduct,
  isPowerSource,
  neighborsOf,
  propagatePower,
  updatePistons,
  decayButtonTimers,
  sortedPowerSnapshot,
  positionKey,
  toBlockPosition,
  normalizeComponentPosition,
  computeNeedsPropagation,
} from '@ts-minecraft/entity'
import type { RedstoneComponent, PositionKey } from '@ts-minecraft/entity'
import { makeTestRedstoneComponent } from '../redstone/test-utils'
import { expectSome } from '../test-utils'

// --- Helpers ---

const makeComponent = (
  type: RedstoneComponentType,
  x: number,
  y: number,
  z: number,
  overrideState?: Partial<RedstoneComponent['state']>,
): RedstoneComponent =>
  makeTestRedstoneComponent(type, { x, y, z }, overrideState ? { state: overrideState } : {})

const makeComponents = (
  entries: ReadonlyArray<RedstoneComponent>,
): HashMap.HashMap<PositionKey, RedstoneComponent> =>
  HashMap.fromIterable(
    Arr.map(entries, (c) => [positionKey(c.position), c] as const),
  )

// --- canConduct ---

describe('canConduct', () => {
  const conductingTypes: ReadonlyArray<[RedstoneComponentType, boolean]> = [
    [RedstoneComponentType.Wire, true],
    [RedstoneComponentType.Lever, true],
    [RedstoneComponentType.Button, true],
    [RedstoneComponentType.Torch, true],
    [RedstoneComponentType.Piston, true],
    ['lamp' as RedstoneComponentType, false],
  ]

  Arr.forEach(conductingTypes, ([type, expected]) => {
    it(`${type} is ${expected ? 'a' : 'not a'} conductor`, () => {
      expect(canConduct(type)).toBe(expected)
    })
  })
})

// --- isPowerSource ---

describe('isPowerSource', () => {
  const cases: ReadonlyArray<[string, RedstoneComponent, boolean]> = [
    ['active Lever', makeComponent(RedstoneComponentType.Lever, 0, 64, 0, { active: true }), true],
    ['inactive Lever', makeComponent(RedstoneComponentType.Lever, 0, 64, 0, { active: false }), false],
    [
      'Button with ticks > 0',
      makeComponent(RedstoneComponentType.Button, 0, 64, 0, { buttonTicksRemaining: 3, active: true }),
      true,
    ],
    [
      'Button with ticks = 0',
      makeComponent(RedstoneComponentType.Button, 0, 64, 0, { buttonTicksRemaining: 0, active: false }),
      false,
    ],
    ['active Torch', makeComponent(RedstoneComponentType.Torch, 0, 64, 0, { active: true }), true],
    ['inactive Torch', makeComponent(RedstoneComponentType.Torch, 0, 64, 0, { active: false }), false],
    ['Wire', makeComponent(RedstoneComponentType.Wire, 0, 64, 0), false],
  ]

  Arr.forEach(cases, ([label, component, expected]) => {
    it(`${label} is ${expected ? '' : 'not '}a power source`, () => {
      expect(isPowerSource(component)).toBe(expected)
    })
  })
})

// --- neighborsOf ---

describe('neighborsOf', () => {
  it('returns exactly 6 neighbors', () => {
    const neighbors = neighborsOf({ x: 0, y: 64, z: 0 })
    expect(neighbors.length).toBe(6)
  })

  it('each neighbor differs from origin by exactly 1 on one axis', () => {
    const origin = { x: 5, y: 10, z: -3 }
    const neighbors = neighborsOf(origin)
    Arr.forEach(neighbors, (n) => {
      const dx = Math.abs(n.x - origin.x)
      const dy = Math.abs(n.y - origin.y)
      const dz = Math.abs(n.z - origin.z)
      expect(dx + dy + dz).toBe(1)
    })
  })

  it('is symmetric: if B is a neighbor of A, A is a neighbor of B', () => {
    const a = { x: 0, y: 64, z: 0 }
    const bList = neighborsOf(a)
    Arr.forEach(bList, (b) => {
      const backNeighbors = neighborsOf(b)
      const containsA = Arr.some(backNeighbors, (n) => n.x === a.x && n.y === a.y && n.z === a.z)
      expect(containsA).toBe(true)
    })
  })
})

// --- propagatePower ---

describe('propagatePower', () => {
  it('empty components → empty power map', () => {
    const result = propagatePower(HashMap.empty())
    expect(HashMap.size(result)).toBe(0)
  })

  it('single active Lever → powered at MAX_REDSTONE_POWER (15)', () => {
    const lever = makeComponent(RedstoneComponentType.Lever, 0, 64, 0, { active: true })
    const components = makeComponents([lever])
    const power = propagatePower(components)
    const leverPower = Option.getOrElse(HashMap.get(power, positionKey({ x: 0, y: 64, z: 0 })), () => 0)
    expect(leverPower).toBe(15)
  })

  it('Wire 1 step from active Lever → powered at 14', () => {
    const lever = makeComponent(RedstoneComponentType.Lever, 0, 64, 0, { active: true })
    const wire = makeComponent(RedstoneComponentType.Wire, 1, 64, 0)
    const components = makeComponents([lever, wire])
    const power = propagatePower(components)
    const wirePower = Option.getOrElse(HashMap.get(power, positionKey({ x: 1, y: 64, z: 0 })), () => 0)
    expect(wirePower).toBe(14)
  })

  it('Wire 14 steps from Lever → powered at 1; wire at step 15 → 0 (absent from map)', () => {
    // Lever at x=0 (power=15), wires at x=1..15.
    // x=1 → 14, x=2 → 13, ..., x=14 → 1, x=15 → 0 (power drops to 0 before reaching it)
    const lever = makeComponent(RedstoneComponentType.Lever, 0, 64, 0, { active: true })
    const wires = Arr.makeBy(15, (i) => makeComponent(RedstoneComponentType.Wire, i + 1, 64, 0))
    const components = makeComponents([lever, ...wires])
    const power = propagatePower(components)

    const edgePower = Option.getOrElse(HashMap.get(power, positionKey({ x: 14, y: 64, z: 0 })), () => 0)
    const beyondPower = Option.getOrElse(HashMap.get(power, positionKey({ x: 15, y: 64, z: 0 })), () => 0)

    expect(edgePower).toBe(1)
    expect(beyondPower).toBe(0)
  })

  it('non-conducting component (Lamp) breaks propagation chain', () => {
    const lever = makeComponent(RedstoneComponentType.Lever, 0, 64, 0, { active: true })
    // Lamp at x=1 does not conduct — wire at x=2 should not receive power
    const lamp = makeComponent('lamp' as RedstoneComponentType, 1, 64, 0)
    const wire = makeComponent(RedstoneComponentType.Wire, 2, 64, 0)
    const components = makeComponents([lever, lamp, wire])
    const power = propagatePower(components)

    const wirePower = Option.getOrElse(HashMap.get(power, positionKey({ x: 2, y: 64, z: 0 })), () => 0)
    expect(wirePower).toBe(0)
  })

  it('a wire reachable from two sources takes the MAX power (nearer source wins)', () => {
    // Levers at x=0 and x=5 (both power 15); wires fill x=1..4 between them.
    // Each wire must take the higher of the two distance-attenuated values, not
    // whichever BFS path reaches it first — this exercises the `power <=
    // currentKnown` max-guard, the core of correct multi-source propagation.
    const leverA = makeComponent(RedstoneComponentType.Lever, 0, 64, 0, { active: true })
    const leverB = makeComponent(RedstoneComponentType.Lever, 5, 64, 0, { active: true })
    const wires = Arr.makeBy(4, (i) => makeComponent(RedstoneComponentType.Wire, i + 1, 64, 0))
    const power = propagatePower(makeComponents([leverA, leverB, ...wires]))
    const at = (x: number) => Option.getOrElse(HashMap.get(power, positionKey({ x, y: 64, z: 0 })), () => 0)

    // x=1: 1 step from A (14) vs 4 from B (11) → 14.  x=4: mirror → 14.
    expect(at(1)).toBe(14)
    expect(at(4)).toBe(14)
    // x=2: 2 from A (13) vs 3 from B (12) → 13.  x=3: mirror → 13.
    expect(at(2)).toBe(13)
    expect(at(3)).toBe(13)
  })
})

// --- updatePistons ---

describe('updatePistons', () => {
  it('piston in powered map → pistonExtended becomes true', () => {
    const piston = makeComponent(RedstoneComponentType.Piston, 0, 64, 0, { pistonExtended: false })
    const components = makeComponents([piston])
    const key = positionKey({ x: 0, y: 64, z: 0 })
    const powered = HashMap.fromIterable([[key, 15]] as const)
    const pistonKeys = HashSet.fromIterable([key])

    const result = updatePistons(components, powered, pistonKeys)
    const updated = expectSome(HashMap.get(result, key))
    expect(updated.state.pistonExtended).toBe(true)
  })

  it('piston not in powered map → pistonExtended becomes false', () => {
    const piston = makeComponent(RedstoneComponentType.Piston, 0, 64, 0, { pistonExtended: true })
    const components = makeComponents([piston])
    const key = positionKey({ x: 0, y: 64, z: 0 })
    const powered = HashMap.empty<PositionKey, number>()
    const pistonKeys = HashSet.fromIterable([key])

    const result = updatePistons(components, powered, pistonKeys)
    const updated = expectSome(HashMap.get(result, key))
    expect(updated.state.pistonExtended).toBe(false)
  })

  it('piston already extended and still powered → state unchanged (no-op)', () => {
    const piston = makeComponent(RedstoneComponentType.Piston, 0, 64, 0, { pistonExtended: true })
    const components = makeComponents([piston])
    const key = positionKey({ x: 0, y: 64, z: 0 })
    const powered = HashMap.fromIterable([[key, 15]] as const)
    const pistonKeys = HashSet.fromIterable([key])

    const result = updatePistons(components, powered, pistonKeys)
    const updated = expectSome(HashMap.get(result, key))
    expect(updated.state.pistonExtended).toBe(true)
    // result should be the same HashMap reference (acc returned unchanged)
    expect(HashMap.size(result)).toBe(1)
  })

  it('pistonKey pointing to missing component is handled gracefully (no-op)', () => {
    const key = positionKey({ x: 99, y: 64, z: 99 })
    const powered = HashMap.fromIterable([[key, 15]] as const)
    const pistonKeys = HashSet.fromIterable([key])
    // components map has no entry for key
    const result = updatePistons(HashMap.empty(), powered, pistonKeys)
    expect(HashMap.size(result)).toBe(0)
  })
})

// --- decayButtonTimers ---

describe('decayButtonTimers', () => {
  const cases: ReadonlyArray<[string, number, boolean, number, boolean]> = [
    ['ticks=5', 5, true, 4, true],
    ['ticks=1', 1, true, 0, false],
    ['ticks=0', 0, false, 0, false],
  ]

  Arr.forEach(cases, ([label, initialTicks, initialActive, expectedTicks, expectedActive]) => {
    it(`button with ${label} → ticks becomes ${expectedTicks}, active becomes ${expectedActive}`, () => {
      const btn = makeComponent(RedstoneComponentType.Button, 0, 64, 0, {
        buttonTicksRemaining: initialTicks,
        active: initialActive,
      })
      const components = makeComponents([btn])
      const key = positionKey({ x: 0, y: 64, z: 0 })
      const buttonKeys = HashSet.fromIterable([key])

      const result = decayButtonTimers(components, buttonKeys)
      const updated = expectSome(HashMap.get(result, key))
      expect(updated.state.buttonTicksRemaining).toBe(expectedTicks)
      expect(updated.state.active).toBe(expectedActive)
    })
  })

  it('buttonKey pointing to missing component is a graceful no-op (stale key branch)', () => {
    // buttonKeys contains a key that has no matching entry in components.
    // decayButtonTimers must return components unchanged (onNone: () => acc).
    const staleKey = positionKey({ x: 42, y: 64, z: 42 })
    const buttonKeys = HashSet.fromIterable([staleKey])

    // components has a different button at a different position
    const btn = makeComponent(RedstoneComponentType.Button, 0, 64, 0, { buttonTicksRemaining: 3, active: true })
    const components = makeComponents([btn])

    const result = decayButtonTimers(components, buttonKeys)

    // The real button at x=0 must be untouched because the stale key did not match anything
    expect(HashMap.size(result)).toBe(1)
    const realBtn = expectSome(HashMap.get(result, positionKey({ x: 0, y: 64, z: 0 })))
    expect(realBtn.state.buttonTicksRemaining).toBe(3)
  })
})

// --- RedstonePowerLevel.toNumber ---

describe('RedstonePowerLevel.toNumber', () => {
  it('converts a branded power level back to a plain number', () => {
    const level = RedstonePowerLevel.make(15)
    expect(RedstonePowerLevel.toNumber(level)).toBe(15)
  })

  it('converts power level 0 to 0', () => {
    const level = RedstonePowerLevel.make(0)
    expect(RedstonePowerLevel.toNumber(level)).toBe(0)
  })
})

// --- sortedPowerSnapshot ---

describe('sortedPowerSnapshot', () => {
  it('empty map → empty array', () => {
    const result = sortedPowerSnapshot(HashMap.empty())
    expect(result).toHaveLength(0)
  })

  it('single entry → correct position and power', () => {
    const key = positionKey({ x: 3, y: 64, z: 7 })
    const powered = HashMap.fromIterable([[key, 10]] as const)
    const result = sortedPowerSnapshot(powered)
    expect(result).toHaveLength(1)
    expect(result[0]!.position).toEqual({ x: 3, y: 64, z: 7 })
    expect(result[0]!.power).toBe(10)
  })

  it('multiple entries → deterministically sorted by numeric key', () => {
    const pos1 = { x: 0, y: 64, z: 0 }
    const pos2 = { x: 1, y: 64, z: 0 }
    const pos3 = { x: 2, y: 64, z: 0 }
    const k1 = positionKey(pos1)
    const k2 = positionKey(pos2)
    const k3 = positionKey(pos3)
    // Intentionally insert in reverse order to test sorting
    const powered = HashMap.fromIterable([
      [k3, 13],
      [k1, 15],
      [k2, 14],
    ] as const)
    const result = sortedPowerSnapshot(powered)
    expect(result).toHaveLength(3)
    // Keys for x=0,1,2 at same y,z are monotonically increasing
    expect(result[0]!.power).toBe(15)
    expect(result[1]!.power).toBe(14)
    expect(result[2]!.power).toBe(13)
  })
})

// --- normalizeComponentPosition ---

describe('normalizeComponentPosition', () => {
  it('snaps a fractional position to block coordinates while preserving other fields', () => {
    const base = makeComponent(RedstoneComponentType.Wire, 0, 64, 0)
    const fractional: RedstoneComponent = { ...base, position: { x: 2.9, y: 64.1, z: -1.5 } }

    const normalized = normalizeComponentPosition(fractional)

    expect(normalized.position).toEqual(toBlockPosition({ x: 2.9, y: 64.1, z: -1.5 }))
    expect(normalized.type).toBe(RedstoneComponentType.Wire)
    expect(normalized.state).toEqual(fractional.state)
  })

  it('leaves an already block-aligned position unchanged', () => {
    const aligned = makeComponent(RedstoneComponentType.Torch, 3, 70, -2)
    expect(normalizeComponentPosition(aligned).position).toEqual(aligned.position)
  })
})

// --- computeNeedsPropagation ---

describe('computeNeedsPropagation', () => {
  const buttonAt = (x: number, y: number, z: number, ticks: number): RedstoneComponent =>
    makeComponent(RedstoneComponentType.Button, x, y, z, { buttonTicksRemaining: ticks })

  it('short-circuits to true when the dirty flag is set', () => {
    expect(
      computeNeedsPropagation(makeComponents([]), HashMap.empty<PositionKey, number>(), HashSet.empty<PositionKey>(), true),
    ).toBe(true)
  })

  it('returns true while a tracked button is still counting down', () => {
    const button = buttonAt(1, 64, 1, 3)
    const key = positionKey(button.position)
    expect(
      computeNeedsPropagation(makeComponents([button]), HashMap.empty<PositionKey, number>(), HashSet.make(key), false),
    ).toBe(true)
  })

  it('returns true when a just-expired button still carries residual power', () => {
    const button = buttonAt(2, 64, 2, 0)
    const key = positionKey(button.position)
    expect(
      computeNeedsPropagation(makeComponents([button]), HashMap.make([key, 5] as const), HashSet.make(key), false),
    ).toBe(true)
  })

  it('returns false when expired buttons no longer hold power', () => {
    const button = buttonAt(3, 64, 3, 0)
    const key = positionKey(button.position)
    expect(
      computeNeedsPropagation(makeComponents([button]), HashMap.empty<PositionKey, number>(), HashSet.make(key), false),
    ).toBe(false)
  })

  it('ignores button keys that are absent from the component map', () => {
    const orphanKey = positionKey({ x: 9, y: 9, z: 9 })
    expect(
      computeNeedsPropagation(makeComponents([]), HashMap.empty<PositionKey, number>(), HashSet.make(orphanKey), false),
    ).toBe(false)
  })
})
