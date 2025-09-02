import { test } from '@fast-check/vitest'
import { Schema as S, Arbitrary as Arb } from 'effect'
import { describe, expect } from 'vitest'
import * as C from '../components'

const components: Record<string, S.Schema<any, any, never>> = {
  Position: C.Position,
  Velocity: C.Velocity,
  Collider: C.Collider,
  Gravity: C.Gravity,
  Player: C.Player,
  InputState: C.InputState,
  CameraState: C.CameraState,
  Hotbar: C.Hotbar,
  TargetBlock: C.TargetBlock,
  TargetNone: C.TargetNone,
  TerrainBlock: C.TerrainBlock,
  Chunk: C.Chunk,
  Renderable: C.Renderable,
  Camera: C.Camera,
  TargetBlockComponent: C.TargetBlockComponent,
}

describe('Component Schemas', () => {
  for (const [name, schema] of Object.entries(components)) {
    const arbitrary = Arb.make(schema)
    test.prop([arbitrary])(`${name} should be reversible after encoding and decoding`, (value) => {
      const encode = S.encodeSync(schema)
      const decode = S.decodeSync(schema)
      expect(decode(encode(value))).toEqual(value)
    })
  }
})

describe('InputState helpers', () => {
  const inputStateArbitrary = Arb.make(C.InputState)

  test('createInputState should initialize all inputs to false', () => {
    const initialState = C.createInputState()
    expect(initialState.forward).toBe(false)
    expect(initialState.backward).toBe(false)
    expect(initialState.left).toBe(false)
    expect(initialState.right).toBe(false)
    expect(initialState.jump).toBe(false)
    expect(initialState.sprint).toBe(false)
    expect(initialState.place).toBe(false)
    expect(initialState.destroy).toBe(false)
    expect(initialState.isLocked).toBe(false)
  })

  test.prop([inputStateArbitrary, inputStateArbitrary])('setInputState should update state immutably', (initialState, changes) => {
    const updatedState = C.setInputState(new C.InputState(initialState), changes)
    expect(updatedState).toEqual({ ...initialState, ...changes })
    expect(updatedState).not.toBe(initialState)
  })

  test('setInputState should only update specified properties', () => {
    const initialState = C.createInputState()
    const changes = { forward: true, jump: true }
    const updatedState = C.setInputState(initialState, changes)

    expect(updatedState.forward).toBe(true)
    expect(updatedState.jump).toBe(true)
    expect(updatedState.backward).toBe(false)
    expect(updatedState.left).toBe(false)
  })
})