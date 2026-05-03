import { describe, it, expect } from 'vitest'
import { Array as Arr } from 'effect'
import { greedyMeshChunk } from '@ts-minecraft/rendering'
import { CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import type { BlockType } from '@ts-minecraft/kernel'
import { makeChunkWithBlock, ZERO_COORD, ZERO_OFFSET } from './greedy-meshing-test-utils'

describe('greedyMeshChunk', () => {

  describe('chunk boundary blocks', () => {
    it('block at chunk edge (lx=15) should have exposed face towards positive X', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 15, 0, 0, 'STONE')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      // Should have 6 faces (all exposed at chunk boundary)
      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)

      // Check that +X face normal exists
      let hasPositiveXFace = false
      const normalCount = result.toMeshed().opaque.normals.length / 3
      for (let v = 0; v < normalCount; v += 4) {
        const nx = result.toMeshed().opaque.normals[v * 3]
        if (nx === 1) {
          hasPositiveXFace = true
          break
        }
      }
      expect(hasPositiveXFace).toBe(true)
    })

    it('block at chunk edge (lz=15) should have exposed face towards positive Z', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, 0, 15, 'STONE')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)

      // Check that +Z face normal exists
      let hasPositiveZFace = false
      const normalCount = result.toMeshed().opaque.normals.length / 3
      for (let v = 0; v < normalCount; v += 4) {
        const nz = result.toMeshed().opaque.normals[v * 3 + 2]
        if (nz === 1) {
          hasPositiveZFace = true
          break
        }
      }
      expect(hasPositiveZFace).toBe(true)
    })

    it('block at top of chunk (y=CHUNK_HEIGHT-1) should have an exposed +Y face', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 0, CHUNK_HEIGHT - 1, 0, 'DIRT')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)

      let hasTopFace = false
      const normalCount = result.toMeshed().opaque.normals.length / 3
      for (let v = 0; v < normalCount; v += 4) {
        const ny = result.toMeshed().opaque.normals[v * 3 + 1]
        if (ny === 1) {
          hasTopFace = true
          break
        }
      }
      expect(hasTopFace).toBe(true)
    })

    it('block at y=0 should have an exposed -Y (bottom) face', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 8, 0, 8, 'GRASS')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)

      let hasBottomFace = false
      const normalCount = result.toMeshed().opaque.normals.length / 3
      for (let v = 0; v < normalCount; v += 4) {
        const ny = result.toMeshed().opaque.normals[v * 3 + 1]
        if (ny === -1) {
          hasBottomFace = true
          break
        }
      }
      expect(hasBottomFace).toBe(true)
    })
  })

  describe('all block types produce geometry', () => {
    const testBlockTypes: BlockType[] = ['DIRT', 'STONE', 'GRASS', 'WOOD', 'SAND', 'LEAVES']

    Arr.forEach(testBlockTypes, (blockType) => {
      it(`${blockType} block produces 6 faces when isolated`, () => {
        const chunk = makeChunkWithBlock(ZERO_COORD, 3, 3, 3, blockType)
        const result = greedyMeshChunk(chunk, ZERO_OFFSET)

        expect(result.toMeshed().opaque.indices.length / 6).toBe(6)
        expect(result.toMeshed().opaque.positions.length).toBe(72)  // 6 faces * 4 verts * 3 floats
        expect(result.toMeshed().opaque.indices.length).toBe(36)    // 6 faces * 2 tris * 3 indices
      })
    })
  })
})
