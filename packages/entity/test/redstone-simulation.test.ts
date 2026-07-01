import { HashMap, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  canConduct,
  isPowerSource,
  makeDefaultState,
  neighborsOf,
  normalizeComponentPosition,
  propagatePower,
} from '@ts-minecraft/entity/domain/redstone/redstone-simulation'
import { RedstoneComponentType, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import { positionKey } from '@ts-minecraft/entity/domain/redstone/redstone-position-utils'
import { MAX_REDSTONE_POWER } from '@ts-minecraft/entity/domain/redstone/redstone.config'

// ─── helpers ─────────────────────────────────────────────────────────────────

const pos = (x: number, y: number, z: number) => ({ x, y, z })

const makeComponent = (type: RedstoneComponent['type'], active = false): RedstoneComponent => ({
  type,
  position: pos(0, 64, 0),
  state: { active, buttonTicksRemaining: 0, pistonExtended: false },
})

// ─── normalizeComponentPosition ───────────────────────────────────────────────
describe('normalizeComponentPosition', () => {
  it('floors fractional coordinates to integer block positions', () => {
    const c: RedstoneComponent = { ...makeComponent('wire'), position: pos(1.9, 64.5, 2.3) }
    const normalized = normalizeComponentPosition(c)
    expect(normalized.position.x).toBe(1)
    expect(normalized.position.y).toBe(64)
    expect(normalized.position.z).toBe(2)
  })
})

// ─── makeDefaultState ─────────────────────────────────────────────────────────
describe('makeDefaultState', () => {
  it('creates active=true state for torch (torches default on)', () => {
    expect(makeDefaultState(RedstoneComponentType.Torch).active).toBe(true)
  })

  it('creates active=false for all other component types', () => {
    const types = [
      RedstoneComponentType.Wire,
      RedstoneComponentType.Lever,
      RedstoneComponentType.Button,
      RedstoneComponentType.Piston,
      RedstoneComponentType.PressurePlate,
      RedstoneComponentType.Lamp,
    ] as const
    for (const type of types) {
      expect(makeDefaultState(type).active).toBe(false)
    }
  })
})

// ─── canConduct ───────────────────────────────────────────────────────────────
describe('canConduct', () => {
  it('returns true for conducting types', () => {
    const conductors: RedstoneComponent['type'][] = ['wire', 'lever', 'button', 'torch', 'piston', 'pressure_plate']
    for (const type of conductors) {
      expect(canConduct(type)).toBe(true)
    }
  })

  it('returns false for lamp (non-conducting output device)', () => {
    expect(canConduct(RedstoneComponentType.Lamp)).toBe(false)
  })
})

// ─── isPowerSource ────────────────────────────────────────────────────────────
describe('isPowerSource', () => {
  it('active lever is a power source', () => {
    expect(isPowerSource({ ...makeComponent('lever'), state: { active: true, buttonTicksRemaining: 0, pistonExtended: false } })).toBe(true)
  })

  it('inactive lever is not a power source', () => {
    expect(isPowerSource(makeComponent('lever'))).toBe(false)
  })

  it('torch with active=true is a power source', () => {
    expect(isPowerSource({ ...makeComponent('torch'), state: { active: true, buttonTicksRemaining: 0, pistonExtended: false } })).toBe(true)
  })

  it('torch with active=false is not a power source', () => {
    expect(isPowerSource(makeComponent('torch', false))).toBe(false)
  })

  it('button with ticks remaining is a power source', () => {
    expect(isPowerSource({ ...makeComponent('button'), state: { active: false, buttonTicksRemaining: 5, pistonExtended: false } })).toBe(true)
  })

  it('button with 0 ticks remaining is not a power source', () => {
    expect(isPowerSource(makeComponent('button'))).toBe(false)
  })

  it('wire is never a power source', () => {
    expect(isPowerSource(makeComponent('wire'))).toBe(false)
  })
})

// ─── neighborsOf ──────────────────────────────────────────────────────────────
describe('neighborsOf', () => {
  it('returns exactly 6 neighbors', () => {
    expect(neighborsOf(pos(0, 64, 0))).toHaveLength(6)
  })

  it('includes +1/-1 on all three axes', () => {
    const neighbors = neighborsOf(pos(5, 10, 5))
    const xVals = neighbors.map((p) => p.x).sort()
    const yVals = neighbors.map((p) => p.y).sort()
    const zVals = neighbors.map((p) => p.z).sort()
    expect(xVals).toContain(4)
    expect(xVals).toContain(6)
    expect(yVals).toContain(9)
    expect(yVals).toContain(11)
    expect(zVals).toContain(4)
    expect(zVals).toContain(6)
  })
})

// ─── propagatePower ───────────────────────────────────────────────────────────
describe('propagatePower', () => {
  it('returns an empty map when there are no components', () => {
    const powered = propagatePower(HashMap.empty())
    expect(HashMap.size(powered)).toBe(0)
  })

  it('powers a lever at MAX_REDSTONE_POWER when the lever is active', () => {
    const lever: RedstoneComponent = {
      type: 'lever',
      position: pos(0, 64, 0),
      state: { active: true, buttonTicksRemaining: 0, pistonExtended: false },
    }
    const map = HashMap.make([positionKey(lever.position), lever])
    const powered = propagatePower(map)
    const level = Option.getOrElse(HashMap.get(powered, positionKey(lever.position)), () => 0)
    expect(level).toBe(MAX_REDSTONE_POWER)
  })

  it('propagates power to an adjacent wire', () => {
    const lever: RedstoneComponent = {
      type: 'lever',
      position: pos(0, 64, 0),
      state: { active: true, buttonTicksRemaining: 0, pistonExtended: false },
    }
    const wire: RedstoneComponent = {
      type: 'wire',
      position: pos(1, 64, 0),
      state: { active: false, buttonTicksRemaining: 0, pistonExtended: false },
    }
    const map = HashMap.make(
      [positionKey(lever.position), lever],
      [positionKey(wire.position), wire],
    )
    const powered = propagatePower(map)
    const wireLevel = Option.getOrElse(HashMap.get(powered, positionKey(wire.position)), () => 0)
    expect(wireLevel).toBe(MAX_REDSTONE_POWER - 1)
  })

  it('does not power an inactive lever', () => {
    const lever: RedstoneComponent = {
      type: 'lever',
      position: pos(0, 64, 0),
      state: { active: false, buttonTicksRemaining: 0, pistonExtended: false },
    }
    const map = HashMap.make([positionKey(lever.position), lever])
    const powered = propagatePower(map)
    expect(HashMap.size(powered)).toBe(0)
  })
})
