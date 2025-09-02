import * as fc from 'fast-check'
import { test } from '@fast-check/vitest'
import { Schema as S } from 'effect'
import { describe, expect } from 'vitest'
import * as C from '../components'
import { blockTypeNames } from '../block'
import { toEntityId } from '../entity'

const positionArbitrary = fc.record({
  x: fc.float(),
  y: fc.float(),
  z: fc.float(),
})

const velocityArbitrary = fc.record({
  dx: fc.float(),
  dy: fc.float(),
  dz: fc.float(),
})

const colliderArbitrary = fc.record({
  width: fc.float(),
  height: fc.float(),
  depth: fc.float(),
})

const gravityArbitrary = fc.record({
  value: fc.float(),
})

const playerArbitrary = fc.record({
  isGrounded: fc.boolean(),
})

const inputStateArbitrary = fc.record({
  forward: fc.boolean(),
  backward: fc.boolean(),
  left: fc.boolean(),
  right: fc.boolean(),
  jump: fc.boolean(),
  sprint: fc.boolean(),
  place: fc.boolean(),
  destroy: fc.boolean(),
  isLocked: fc.boolean(),
})

const cameraStateArbitrary = fc.record({
  pitch: fc.float(),
  yaw: fc.float(),
})

const hotbarArbitrary = fc.record({
  slots: fc.array(fc.constantFrom(...blockTypeNames)),
  selectedIndex: fc.integer(),
})

const vector3IntArbitrary = fc.record({
  x: fc.integer(),
  y: fc.integer(),
  z: fc.integer(),
})

const targetBlockArbitrary = fc.record({
  _tag: fc.constant('block' as const),
  entityId: fc.integer().map(toEntityId),
  face: vector3IntArbitrary,
})

const targetNoneArbitrary = fc.record({
  _tag: fc.constant('none' as const),
})

const terrainBlockArbitrary = fc.record({})

const chunkArbitrary = fc.record({
  chunkX: fc.integer(),
  chunkZ: fc.integer(),
})

const renderableArbitrary = fc.record({
  geometry: fc.string(),
  blockType: fc.constantFrom(...blockTypeNames),
})

const cameraArbitrary = fc.record({})

const targetBlockComponentArbitrary = fc.record({})

const components = {
  Position: { schema: C.Position, arbitrary: positionArbitrary },
  Velocity: { schema: C.Velocity, arbitrary: velocityArbitrary },
  Collider: { schema: C.Collider, arbitrary: colliderArbitrary },
  Gravity: { schema: C.Gravity, arbitrary: gravityArbitrary },
  Player: { schema: C.Player, arbitrary: playerArbitrary },
  InputState: { schema: C.InputState, arbitrary: inputStateArbitrary },
  CameraState: { schema: C.CameraState, arbitrary: cameraStateArbitrary },
  Hotbar: { schema: C.Hotbar, arbitrary: hotbarArbitrary },
  TargetBlock: { schema: C.TargetBlock, arbitrary: targetBlockArbitrary },
  TargetNone: { schema: C.TargetNone, arbitrary: targetNoneArbitrary },
  TerrainBlock: { schema: C.TerrainBlock, arbitrary: terrainBlockArbitrary },
  Chunk: { schema: C.Chunk, arbitrary: chunkArbitrary },
  Renderable: { schema: C.Renderable, arbitrary: renderableArbitrary },
  Camera: { schema: C.Camera, arbitrary: cameraArbitrary },
  TargetBlockComponent: {
    schema: C.TargetBlockComponent,
    arbitrary: targetBlockComponentArbitrary,
  },
}

describe('Component Schemas', () => {
  for (const [name, { schema, arbitrary }] of Object.entries(components)) {
    test.prop([arbitrary])(`${name} should be reversible after encoding and decoding`, (value) => {
      const encode = S.encodeSync(schema as S.Schema<any, any, never>)
      const decode = S.decodeSync(schema as S.Schema<any, any, never>)
      expect(decode(encode(value))).toEqual(value)
    })
  }
})

describe('InputState helpers', () => {
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
