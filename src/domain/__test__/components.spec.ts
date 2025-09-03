import * as S from 'effect/Schema'
import { describe, it, assert } from '@effect/vitest'
import * as fc from 'fast-check'
import * as Arbitrary from 'effect/Arbitrary'
import * as C from '../components'
import { Effect } from 'effect'

describe('Component Schemas', () => {
  const testReversibility = (name: string, schema: S.Schema<any, any>) => {
    it.effect(`${name} should be reversible after encoding and decoding`, () =>
      Effect.sync(() => {
        const arbitrary = Arbitrary.make(schema)
        fc.assert(
          fc.property(arbitrary, (value) => {
            const encode = S.encodeSync(schema)
            const decode = S.decodeSync(schema)
            const decodedValue = decode(encode(value))
            assert.deepStrictEqual(decodedValue, value)
          }),
        )
      }),
    )
  }

  testReversibility('position', C.Position)
  testReversibility('velocity', C.Velocity)
  testReversibility('player', C.Player)
  testReversibility('inputState', C.InputState)
  testReversibility('cameraState', C.CameraState)
  testReversibility('hotbar', C.Hotbar)
  testReversibility('target', C.Target)
  testReversibility('gravity', C.Gravity)
  testReversibility('collider', C.Collider)
  testReversibility('renderable', C.Renderable)
  testReversibility('instancedMeshRenderable', C.InstancedMeshRenderable)
  testReversibility('terrainBlock', C.TerrainBlock)
  testReversibility('chunk', C.Chunk)
  testReversibility('camera', C.Camera)
  testReversibility('targetBlock', C.TargetBlockComponent)
  testReversibility('chunkLoaderState', C.ChunkLoaderState)
})
