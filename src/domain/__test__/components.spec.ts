import * as S from 'effect/Schema'
import { describe, it, assert } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import * as C from '../components'
import { Effect, Gen } from 'effect'

describe('Component Schemas', () => {
  const testReversibility = (name: string, schema: S.Schema<any, any>) => {
    it.effect(`${name} should be reversible after encoding and decoding`, () =>
      Gen.flatMap(fc.gen(schema), (value) =>
        Effect.sync(() => {
          const encode = S.encodeSync(schema)
          const decode = S.decodeSync(schema)
          const decodedValue = decode(encode(value))
          assert.deepStrictEqual(decodedValue, value)
        }),
      ))
  }

  testReversibility('Position', C.Position)
  testReversibility('Velocity', C.Velocity)
  testReversibility('Player', C.Player)
  testReversibility('InputState', C.InputState)
  testReversibility('CameraState', C.CameraState)
  testReversibility('Hotbar', C.Hotbar)
  testReversibility('Target', C.Target)
  testReversibility('Gravity', C.Gravity)
  testReversibility('Collider', C.Collider)
  testReversibility('Renderable', C.Renderable)
  testReversibility('InstancedMeshRenderable', C.InstancedMeshRenderable)
  testReversibility('TerrainBlock', C.TerrainBlock)
  testReversibility('Chunk', C.Chunk)
  testReversibility('Camera', C.Camera)
  testReversibility('TargetBlockComponent', C.TargetBlockComponent)
  testReversibility('ChunkLoaderState', C.ChunkLoaderState)
  testReversibility('AnyComponent', C.AnyComponent)
  testReversibility('PartialComponentsSchema', C.PartialComponentsSchema)
  testReversibility('ComponentNameSchema', C.ComponentNameSchema)
})