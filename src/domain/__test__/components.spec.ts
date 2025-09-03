import * as S from 'effect/Schema'
import { describe, it, assert } from '@effect/vitest'
import * as C from '../components'
import { toFloat, toInt, toChunkX, toChunkZ } from '../common'
import { PLAYER_COLLIDER } from '../world-constants'
import { hotbarSlots } from '../block'

describe('Component Schemas', () => {
  const testReversibility = <A, I>(name: string, schema: S.Schema<A, I>, value: A) => {
    it(`${name} should be reversible after encoding and decoding`, () => {
      const encode = S.encodeSync(schema)
      const decode = S.decodeSync(schema)
      const decodedValue = decode(encode(value))
      assert.deepStrictEqual(decodedValue, value)
    })
  }

  testReversibility('Position', C.Position, { x: toFloat(1), y: toFloat(2), z: toFloat(3) })
  testReversibility('Velocity', C.Velocity, { dx: toFloat(1), dy: toFloat(2), dz: toFloat(3) })
  testReversibility('Player', C.Player, { isGrounded: false })
  testReversibility('InputState', C.InputState, {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    place: false,
    destroy: false,
    isLocked: false,
  })
  testReversibility('CameraState', C.CameraState, { pitch: toFloat(1), yaw: toFloat(2) })
  testReversibility('Hotbar', C.Hotbar, { slots: hotbarSlots, selectedIndex: toInt(0) })
  testReversibility('Target', C.Target, { _tag: 'none' })
  testReversibility('Gravity', C.Gravity, { value: toFloat(9.8) })
  testReversibility('Collider', C.Collider, PLAYER_COLLIDER)
  testReversibility('Renderable', C.Renderable, { geometry: 'box', blockType: 'grass' })
  testReversibility('InstancedMeshRenderable', C.InstancedMeshRenderable, {
    meshType: 'box',
  })
  testReversibility('TerrainBlock', C.TerrainBlock, {})
  testReversibility('Chunk', C.Chunk, { chunkX: toChunkX(0), chunkZ: toChunkZ(0), blocks: [] })
  testReversibility('Camera', C.Camera, {
    position: { x: toFloat(1), y: toFloat(2), z: toFloat(3) },
    damping: toFloat(0.1),
  })
  testReversibility('TargetBlockComponent', C.TargetBlockComponent, {})
  testReversibility('ChunkLoaderState', C.ChunkLoaderState, { loadedChunks: new Set() })
  testReversibility('AnyComponent', C.AnyComponent, {
    position: { x: toFloat(1), y: toFloat(2), z: toFloat(3) },
  })
  testReversibility('PartialComponentsSchema', C.PartialComponentsSchema, {
    position: { x: toFloat(1), y: toFloat(2), z: toFloat(3) },
  })
  testReversibility('ComponentNameSchema', C.ComponentNameSchema, 'position')
})