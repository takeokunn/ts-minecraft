import { describe, it, expect } from 'vitest'
import { Array as Arr } from 'effect'
import { greedyMeshChunk } from '@ts-minecraft/rendering'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'
import type { BlockType } from '@ts-minecraft/kernel'
import { makeChunkWithBlock, makeChunkWithBlocks, ZERO_COORD, ZERO_OFFSET } from './greedy-meshing-test-utils'

describe('greedyMeshChunk', () => {
  describe('output array lengths are consistent', () => {
    it('positions, normals, and colors all have the same length', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 5, 5, 5, 'WOOD')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.positions.length).toBe(result.toMeshed().opaque.normals.length)
      expect(result.toMeshed().opaque.positions.length).toBe(result.toMeshed().opaque.colors.length)
    })

    it('index count is consistent with vertex count (2 triangles per quad)', () => {
      const chunk = makeChunkWithBlock(ZERO_COORD, 5, 5, 5, 'WOOD')
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      const quadCount = result.toMeshed().opaque.indices.length / 6
      const vertexCount = result.toMeshed().opaque.positions.length / 3

      expect(vertexCount).toBe(quadCount * 4)
      expect(result.toMeshed().opaque.indices.length).toBe(quadCount * 6)
    })
  })

  describe('large flat surface merging efficiency', () => {
    it('16x16 flat layer at y=0 produces exactly 6 quads', () => {
      const entries: Array<{ lx: number; y: number; lz: number; blockType: BlockType }> = []
      Arr.forEach(Arr.makeBy(CHUNK_SIZE, lx => lx), lx => {
        Arr.forEach(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => {
          entries.push({ lx, y: 0, lz, blockType: 'STONE' })
        })
      })
      const chunk = makeChunkWithBlocks(ZERO_COORD, entries)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)
    })

    it('16x16 flat layer produces far fewer quads than 16*16*6', () => {
      const entries: Array<{ lx: number; y: number; lz: number; blockType: BlockType }> = []
      Arr.forEach(Arr.makeBy(CHUNK_SIZE, lx => lx), lx => {
        Arr.forEach(Arr.makeBy(CHUNK_SIZE, lz => lz), lz => {
          entries.push({ lx, y: 10, lz, blockType: 'DIRT' })
        })
      })
      const chunk = makeChunkWithBlocks(ZERO_COORD, entries)
      const result = greedyMeshChunk(chunk, ZERO_OFFSET)

      expect(result.toMeshed().opaque.indices.length / 6).toBeLessThan(1536)
      expect(result.toMeshed().opaque.indices.length / 6).toBe(6)
    })
  })
})
