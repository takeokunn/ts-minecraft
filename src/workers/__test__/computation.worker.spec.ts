import { describe, it, expect } from 'vitest'

import {
  generateChunk,
  generateBlockData,
  generateGreedyMesh,
  createChunkDataView,
  getBlock,
} from '../computation.worker'
import type { GenerationParams } from '../../domain/types'
import { PlacedBlock } from '../../domain/block'
import { CHUNK_HEIGHT, CHUNK_SIZE, Y_OFFSET } from '../../domain/world-constants'
import { Option } from 'effect'

const defaultParams: GenerationParams = {
  chunkX: 0,
  chunkZ: 0,
  seeds: {
    world: 1,
    biome: 2,
    trees: 3,
  },
  amplitude: 10,
  editedBlocks: {
    placed: {},
    destroyed: new Set(),
  },
}

const compareBlocks = (a: PlacedBlock, b: PlacedBlock) => {
  const { x: ax, y: ay, z: az } = a.position
  const { x: bx, y: by, z: bz } = b.position
  if (ay !== by) return ay - by
  if (az !== bz) return az - bz
  if (ax !== bx) return ax - bx
  return 0
}

describe('computation.worker', () => {
  describe('generateBlockData', () => {
    it('should generate a deterministic set of blocks for a given seed', () => {
      const blocks1 = generateBlockData(defaultParams)
      const blocks2 = generateBlockData(defaultParams)
      expect([...blocks1].sort(compareBlocks)).toEqual([...blocks2].sort(compareBlocks))
    })

    it('should generate different blocks for different seeds', () => {
      const params2 = { ...defaultParams, seeds: { ...defaultParams.seeds, world: 42 } }
      const blocks1 = generateBlockData(defaultParams)
      const blocks2 = generateBlockData(params2)
      expect(blocks1).not.toEqual(blocks2)
    })

    it('should add placed blocks', () => {
      const placedBlock = { position: { x: 1, y: 100, z: 1 }, blockType: 'stone' } as PlacedBlock
      const params: GenerationParams = {
        ...defaultParams,
        editedBlocks: {
          placed: {
            '1,100,1': placedBlock,
          },
          destroyed: new Set(),
        },
      }
      const blocks = generateBlockData(params)
      expect(blocks).toContainEqual(placedBlock)
    })

    it('should remove destroyed blocks', () => {
      const blocksWithoutDestroy = generateBlockData(defaultParams)
      const blockToDestroy = blocksWithoutDestroy[0]
      if (!blockToDestroy) {
        throw new Error('No blocks generated')
      }
      const { x, y, z } = blockToDestroy.position
      const key = `${x},${y},${z}`

      const params: GenerationParams = {
        ...defaultParams,
        editedBlocks: {
          placed: {},
          destroyed: new Set([key]),
        },
      }
      const blocksWithDestroy = generateBlockData(params)
      expect(blocksWithDestroy).not.toContainEqual(blockToDestroy)
    })
  })

  describe('createChunkDataView and getBlock', () => {
    it('should create a view and allow retrieving blocks', () => {
      const blocks: PlacedBlock[] = [{ position: { x: 0, y: 0, z: 0 }, blockType: 'stone' }]
      const view = createChunkDataView(blocks, 0, 0)
      const block = getBlock(view, 0, 0 + Y_OFFSET, 0)
      expect(Option.getOrNull(block)).toBe('stone')
    })

    it('should return none for empty or out-of-bounds coordinates', () => {
      const blocks: PlacedBlock[] = []
      const view = createChunkDataView(blocks, 0, 0)
      const emptyBlock = getBlock(view, 1, 1, 1)
      const outOfBoundsBlock = getBlock(view, CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE)
      expect(Option.isNone(emptyBlock)).toBe(true)
      expect(Option.isNone(outOfBoundsBlock)).toBe(true)
    })
  })

  describe('generateGreedyMesh', () => {
    it('should generate a mesh for a single block', () => {
      const blocks: PlacedBlock[] = [{ position: { x: 0, y: 0, z: 0 }, blockType: 'stone' }]
      const mesh = generateGreedyMesh(blocks, 0, 0)
      expect(mesh.indices.length).toBeGreaterThan(0)
      expect(mesh.positions.length).toBeGreaterThan(0)
    })

    it('should generate a merged mesh for two adjacent blocks', () => {
      const meshForOne = generateGreedyMesh([{ position: { x: 0, y: 0, z: 0 }, blockType: 'stone' }], 0, 0)
      const meshForTwo = generateGreedyMesh(
        [
          { position: { x: 0, y: 0, z: 0 }, blockType: 'stone' },
          { position: { x: 1, y: 0, z: 0 }, blockType: 'stone' },
        ],
        0,
        0,
      )
      expect(meshForTwo.indices.length).toBeLessThan(2 * meshForOne.indices.length)
    })

    it('should generate an empty mesh for transparent blocks if they are alone', () => {
      const blocks: PlacedBlock[] = [{ position: { x: 0, y: 0, z: 0 }, blockType: 'air' }]
      const mesh = generateGreedyMesh(blocks, 0, 0)
      expect(mesh.indices.length).toBe(0)
    })

    it('should not generate a face between two solid blocks', () => {
      const blocks1: PlacedBlock[] = [{ position: { x: 0, y: 0, z: 0 }, blockType: 'stone' }]
      const mesh1 = generateGreedyMesh(blocks1, 0, 0)

      const blocks2: PlacedBlock[] = [
        { position: { x: 0, y: 0, z: 0 }, blockType: 'stone' },
        { position: { x: 1, y: 0, z: 0 }, blockType: 'dirt' },
      ]
      const mesh2 = generateGreedyMesh(blocks2, 0, 0)
      expect(mesh2.indices.length).toBeLessThan(2 * mesh1.indices.length)
    })
  })

  describe('generateChunk', () => {
    it('should return blocks and a mesh', () => {
      const result = generateChunk(defaultParams)
      expect(result.blocks).toBeInstanceOf(Array)
      expect(result.mesh.positions).toBeInstanceOf(Float32Array)
      expect(result.chunkX).toBe(defaultParams.chunkX)
      expect(result.chunkZ).toBe(defaultParams.chunkZ)
    })

    it('should produce a deterministic result across different parameters', () => {
      const params1: GenerationParams = {
        chunkX: 5,
        chunkZ: -10,
        seeds: { world: 123, biome: 456, trees: 789 },
        amplitude: 15,
        editedBlocks: { placed: {}, destroyed: new Set() },
      }
      const params2: GenerationParams = {
        chunkX: -2,
        chunkZ: 3,
        seeds: { world: 987, biome: 654, trees: 321 },
        amplitude: 8,
        editedBlocks: { placed: {}, destroyed: new Set() },
      }

      const runCheck = (params: GenerationParams) => {
        const result1 = generateChunk(params)
        const result2 = generateChunk(params)
        expect([...result1.blocks].sort(compareBlocks)).toEqual([...result2.blocks].sort(compareBlocks))
        expect(Array.from(result1.mesh.positions)).toEqual(Array.from(result2.mesh.positions))
      }

      runCheck(params1)
      runCheck(params2)
    })

    it('should generate a snapshot for chunk (0,0)', () => {
      const result = generateChunk(defaultParams)
      // Sanitize mesh data for snapshot
      const snapshotData = {
        ...result,
        blocks: [...result.blocks].sort(compareBlocks),
        mesh: {
          positions: Array.from(result.mesh.positions),
          normals: Array.from(result.mesh.normals),
          uvs: Array.from(result.mesh.uvs),
          indices: Array.from(result.mesh.indices),
        },
      }
      expect(snapshotData).toMatchSnapshot()
    })
  })
})
