import { describe, it, expect } from '@effect/vitest'
import * as C from '../components'
import { testReversibility } from '@test/test-utils'

describe('Component Schemas', () => {
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

  describe('componentNames and componentNamesSet', () => {
    it('should have the same number of elements', () => {
      expect(C.componentNames.length).toBe(C.componentNamesSet.size)
    })

    it('should contain the same elements', () => {
      const sortedNames = [...C.componentNames].sort()
      const sortedSetNames = [...C.componentNamesSet].sort()
      expect(sortedNames).toEqual(sortedSetNames)
    })
  })
})
