import { describe, it, assert } from '@effect/vitest'
import { generateGreedyMesh } from '../mesh-generation'
import { toInt } from '../../core/common'

describe('mesh-generation', () => {
  describe('generateGreedyMesh', () => {
    it('should generate mesh data with correct structure', () => {
      const testBlocks = [
        {
          position: [toInt(0), toInt(0), toInt(0)],
          blockType: 'grass' as const,
        },
        {
          position: [toInt(1), toInt(0), toInt(0)],
          blockType: 'dirt' as const,
        }
      ]
      
      const mesh = generateGreedyMesh(testBlocks, 0, 0)
      
      assert.instanceOf(mesh.positions, Float32Array)
      assert.instanceOf(mesh.normals, Float32Array)
      assert.instanceOf(mesh.uvs, Float32Array)
      assert.instanceOf(mesh.indices, Uint32Array)
    })

    it('should return empty arrays for placeholder implementation', () => {
      const testBlocks = [
        {
          position: [toInt(0), toInt(0), toInt(0)],
          blockType: 'stone' as const,
        }
      ]
      
      const mesh = generateGreedyMesh(testBlocks, 0, 0)
      
      // Current implementation returns empty arrays
      assert.strictEqual(mesh.positions.length, 0)
      assert.strictEqual(mesh.normals.length, 0)
      assert.strictEqual(mesh.uvs.length, 0)
      assert.strictEqual(mesh.indices.length, 0)
    })

    it('should handle empty block array', () => {
      const mesh = generateGreedyMesh([], 0, 0)
      
      assert.instanceOf(mesh.positions, Float32Array)
      assert.instanceOf(mesh.normals, Float32Array)
      assert.instanceOf(mesh.uvs, Float32Array)
      assert.instanceOf(mesh.indices, Uint32Array)
    })
  })
})