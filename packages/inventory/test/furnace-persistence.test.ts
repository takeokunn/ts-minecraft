import { describe, expect, it } from 'vitest'
import { HashMap, Option } from 'effect'
import {
  serializeFurnaceState,
  deserializeFurnaceState,
} from '@ts-minecraft/inventory/application/furnace-persistence'
import {
  INITIAL_STATE,
  emptyFurnaceAtPosition,
  setFurnaceState,
  furnaceKey,
} from '@ts-minecraft/inventory/domain/furnace-service-utils'

// ─── helpers ─────────────────────────────────────────────────────────────────

const pos1 = { x: 10, y: 64, z: -5 }
const pos2 = { x: 20, y: 64, z: 0 }

const makeState = (...positions: typeof pos1[]) =>
  positions.reduce(
    (state, pos) => setFurnaceState(state, emptyFurnaceAtPosition(pos)),
    INITIAL_STATE,
  )

// ─── serializeFurnaceState ────────────────────────────────────────────────────
describe('serializeFurnaceState', () => {
  it('returns an empty array for the initial state', () => {
    const serialized = serializeFurnaceState(INITIAL_STATE)
    expect(serialized).toHaveLength(0)
  })

  it('returns one entry per furnace', () => {
    const state = makeState(pos1, pos2)
    const serialized = serializeFurnaceState(state)
    expect(serialized).toHaveLength(2)
  })

  it('each serialized entry preserves its position', () => {
    const state = makeState(pos1)
    const serialized = serializeFurnaceState(state)
    expect(serialized[0]?.position).toEqual(pos1)
  })
})

// ─── deserializeFurnaceState ──────────────────────────────────────────────────
describe('deserializeFurnaceState', () => {
  it('returns the initial state for an empty array', () => {
    const result = deserializeFurnaceState([])
    expect(HashMap.size(result.furnaces)).toBe(0)
    expect(Option.isNone(result.selectedFurnacePosition)).toBe(true)
  })

  it('reconstructs one furnace from a single entry', () => {
    const entries = [emptyFurnaceAtPosition(pos1)]
    const result = deserializeFurnaceState(entries)
    expect(HashMap.size(result.furnaces)).toBe(1)
  })

  it('keys furnaces by their position string', () => {
    const entries = [emptyFurnaceAtPosition(pos1)]
    const result = deserializeFurnaceState(entries)
    const key = furnaceKey(pos1)
    expect(Option.isSome(HashMap.get(result.furnaces, key))).toBe(true)
  })

  it('preserves selectedFurnacePosition as None after deserialization', () => {
    const result = deserializeFurnaceState([emptyFurnaceAtPosition(pos1)])
    expect(Option.isNone(result.selectedFurnacePosition)).toBe(true)
  })
})

// ─── round-trip ───────────────────────────────────────────────────────────────
describe('serialize/deserialize round-trip', () => {
  it('recovers the same furnace count', () => {
    const original = makeState(pos1, pos2)
    const serialized = serializeFurnaceState(original)
    const recovered = deserializeFurnaceState(serialized)
    expect(HashMap.size(recovered.furnaces)).toBe(HashMap.size(original.furnaces))
  })

  it('recovers the same positions', () => {
    const original = makeState(pos1, pos2)
    const serialized = serializeFurnaceState(original)
    const recovered = deserializeFurnaceState(serialized)
    for (const pos of [pos1, pos2]) {
      const key = furnaceKey(pos)
      const entry = HashMap.get(recovered.furnaces, key)
      expect(Option.isSome(entry)).toBe(true)
    }
  })

  it('is idempotent: double round-trip gives same result', () => {
    const state = makeState(pos1)
    const once = deserializeFurnaceState(serializeFurnaceState(state))
    const twice = deserializeFurnaceState(serializeFurnaceState(once))
    expect(HashMap.size(twice.furnaces)).toBe(HashMap.size(once.furnaces))
  })
})
