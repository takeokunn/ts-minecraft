import { describe, it, expect } from 'vitest'
import { Array as Arr, HashMap, HashSet, Option } from 'effect'
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
} from '@ts-minecraft/entities'
import type { RedstoneComponent, PositionKey } from '@ts-minecraft/entities'

// --- Helpers ---

const makeComponent = (
  type: RedstoneComponentType,
  x: number,
  y: number,
  z: number,
  overrideState?: Partial<RedstoneComponent['state']>,
): RedstoneComponent => ({
  type,
  position: { x, y, z },
  state: {
    active: type === RedstoneComponentType.Torch,
    buttonTicksRemaining: 0,
    pistonExtended: false,
    ...overrideState,
  },
})

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
    const updated = Option.getOrThrow(HashMap.get(result, key))
    expect(updated.state.pistonExtended).toBe(true)
  })

  it('piston not in powered map → pistonExtended becomes false', () => {
    const piston = makeComponent(RedstoneComponentType.Piston, 0, 64, 0, { pistonExtended: true })
    const components = makeComponents([piston])
    const key = positionKey({ x: 0, y: 64, z: 0 })
    const powered = HashMap.empty<PositionKey, number>()
    const pistonKeys = HashSet.fromIterable([key])

    const result = updatePistons(components, powered, pistonKeys)
    const updated = Option.getOrThrow(HashMap.get(result, key))
    expect(updated.state.pistonExtended).toBe(false)
  })

  it('piston already extended and still powered → state unchanged (no-op)', () => {
    const piston = makeComponent(RedstoneComponentType.Piston, 0, 64, 0, { pistonExtended: true })
    const components = makeComponents([piston])
    const key = positionKey({ x: 0, y: 64, z: 0 })
    const powered = HashMap.fromIterable([[key, 15]] as const)
    const pistonKeys = HashSet.fromIterable([key])

    const result = updatePistons(components, powered, pistonKeys)
    const updated = Option.getOrThrow(HashMap.get(result, key))
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
      const updated = Option.getOrThrow(HashMap.get(result, key))
      expect(updated.state.buttonTicksRemaining).toBe(expectedTicks)
      expect(updated.state.active).toBe(expectedActive)
    })
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
