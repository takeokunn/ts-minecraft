import { describe, it, assert } from '@effect/vitest'
import { createNoise2D } from 'simplex-noise'
import Alea from 'alea'
import {
  createNoiseFunctions,
  getTerrainHeight,
  getBiome,
  generateTerrainColumn,
  generateBlockData,
  type NoiseFunctions
} from '../terrain-generation'
import { toInt } from '../../core/common'
import { CHUNK_SIZE, WATER_LEVEL, WORLD_DEPTH } from '../../domain/world-constants'

describe('terrain-generation', () => {
  const testSeeds = {
    world: 12345,
    biome: 67890,
    trees: 11111,
  }

  describe('createNoiseFunctions', () => {
    it('should create noise functions with given seeds', () => {
      const noiseFunctions = createNoiseFunctions(testSeeds)
      
      assert.isFunction(noiseFunctions.terrain)
      assert.isFunction(noiseFunctions.biome)
      assert.isFunction(noiseFunctions.trees)
    })

    it('should produce consistent results with same seeds', () => {
      const noise1 = createNoiseFunctions(testSeeds)
      const noise2 = createNoiseFunctions(testSeeds)
      
      const result1 = noise1.terrain(0.5, 0.5)
      const result2 = noise2.terrain(0.5, 0.5)
      
      assert.strictEqual(result1, result2)
    })
  })

  describe('getTerrainHeight', () => {
    it('should return consistent height for same coordinates', () => {
      const terrainNoise = createNoise2D(Alea(testSeeds.world))
      const amplitude = 50
      
      const height1 = getTerrainHeight(10, 10, terrainNoise, amplitude)
      const height2 = getTerrainHeight(10, 10, terrainNoise, amplitude)
      
      assert.strictEqual(height1, height2)
      assert.isNumber(height1)
      assert.isTrue(Number.isInteger(height1))
    })

    it('should return different heights for different coordinates', () => {
      const terrainNoise = createNoise2D(Alea(testSeeds.world))
      const amplitude = 50
      
      const height1 = getTerrainHeight(10, 10, terrainNoise, amplitude)
      const height2 = getTerrainHeight(20, 20, terrainNoise, amplitude)
      
      // While it's theoretically possible for these to be equal, it's extremely unlikely
      assert.notStrictEqual(height1, height2)
    })
  })

  describe('getBiome', () => {
    it('should return desert or plains biome', () => {
      const biomeNoise = createNoise2D(Alea(testSeeds.biome))
      
      const biome = getBiome(10, 10, biomeNoise)
      
      assert.isTrue(biome === 'desert' || biome === 'plains')
    })

    it('should return consistent biome for same coordinates', () => {
      const biomeNoise = createNoise2D(Alea(testSeeds.biome))
      
      const biome1 = getBiome(10, 10, biomeNoise)
      const biome2 = getBiome(10, 10, biomeNoise)
      
      assert.strictEqual(biome1, biome2)
    })
  })

  describe('generateTerrainColumn', () => {
    const noiseFunctions: NoiseFunctions = createNoiseFunctions(testSeeds)
    const amplitude = 50

    it('should generate blocks for terrain column', () => {
      const blocks = generateTerrainColumn(0, 0, 5, 5, noiseFunctions, amplitude)
      
      assert.isArray(blocks)
      assert.isTrue(blocks.length > 0)
      
      // All blocks should have valid positions and block types
      blocks.forEach(block => {
        assert.isArray(block.position)
        assert.strictEqual(block.position.length, 3)
        assert.isString(block.blockType)
        assert.strictEqual(block.position[0], 5) // localX should match
        assert.strictEqual(block.position[2], 5) // localZ should match
      })
    })

    it('should generate different terrain for different coordinates', () => {
      const blocks1 = generateTerrainColumn(0, 0, 0, 0, noiseFunctions, amplitude)
      const blocks2 = generateTerrainColumn(0, 0, 5, 5, noiseFunctions, amplitude)
      
      // Different positions should generally produce different terrain
      assert.notDeepEqual(blocks1, blocks2)
    })

    it('should add water blocks below water level', () => {
      // Create a noise function that produces low terrain
      const lowNoise = {
        terrain: () => -0.5, // This will create terrain below water level
        biome: () => 0.5,
        trees: () => 0,
      }
      
      const blocks = generateTerrainColumn(0, 0, 0, 0, lowNoise as NoiseFunctions, 10)
      
      const waterBlocks = blocks.filter(block => block.blockType === 'water')
      assert.isTrue(waterBlocks.length > 0)
    })

    it('should generate trees in plains biome with high tree noise', () => {
      // Create a noise function that produces plains biome with trees
      const treeNoise = {
        terrain: () => 0.5, // Above water level
        biome: () => -0.5, // Plains biome (negative/zero value)
        trees: () => 0.96, // High tree noise (> 0.95)
      }
      
      const blocks = generateTerrainColumn(0, 0, 0, 0, treeNoise as NoiseFunctions, 10)
      
      const oakLogBlocks = blocks.filter(block => block.blockType === 'oakLog')
      const oakLeavesBlocks = blocks.filter(block => block.blockType === 'oakLeaves')
      
      assert.isTrue(oakLogBlocks.length > 0, 'Should generate oak log blocks for tree trunk')
      assert.isTrue(oakLeavesBlocks.length > 0, 'Should generate oak leaves blocks for tree foliage')
    })

    it('should not generate trees in desert biome', () => {
      // Create a noise function that produces desert biome with high tree noise
      const desertNoise = {
        terrain: () => 0.5, // Above water level
        biome: () => 0.5, // Desert biome (positive value)
        trees: () => 0.96, // High tree noise (> 0.95)
      }
      
      const blocks = generateTerrainColumn(0, 0, 0, 0, desertNoise as NoiseFunctions, 10)
      
      const oakLogBlocks = blocks.filter(block => block.blockType === 'oakLog')
      const oakLeavesBlocks = blocks.filter(block => block.blockType === 'oakLeaves')
      
      assert.strictEqual(oakLogBlocks.length, 0, 'Should not generate trees in desert')
      assert.strictEqual(oakLeavesBlocks.length, 0, 'Should not generate tree leaves in desert')
    })
  })

  describe('generateBlockData', () => {
    const testParams = {
      type: 'generateChunk' as const,
      chunkX: toInt(0),
      chunkZ: toInt(0),
      seeds: testSeeds,
      amplitude: 30,
      editedBlocks: {
        destroyed: [],
        placed: {},
      },
    }

    it('should generate block data for entire chunk', () => {
      const blocks = generateBlockData(testParams)
      
      assert.isArray(blocks)
      assert.isTrue(blocks.length > 0)
      
      // Should have blocks for the entire chunk area
      const uniquePositions = new Set(blocks.map(b => `${b.position[0]},${b.position[2]}`))
      assert.isTrue(uniquePositions.size <= CHUNK_SIZE * CHUNK_SIZE)
    })

    it('should handle destroyed blocks', () => {
      const paramsWithDestroyed = {
        ...testParams,
        editedBlocks: {
          destroyed: ['5,-1,5'], // Destroy a block that should exist
          placed: {},
        },
      }
      
      const blocks = generateBlockData(paramsWithDestroyed)
      const destroyedBlock = blocks.find(b => 
        b.position[0] === 5 && b.position[1] === -1 && b.position[2] === 5
      )
      
      assert.isUndefined(destroyedBlock)
    })

    it('should handle placed blocks', () => {
      const placedBlock = {
        position: [toInt(7), toInt(10), toInt(7)],
        blockType: 'glass' as const,
      }
      
      const paramsWithPlaced = {
        ...testParams,
        editedBlocks: {
          destroyed: [],
          placed: { '7,10,7': placedBlock },
        },
      }
      
      const blocks = generateBlockData(paramsWithPlaced)
      const foundBlock = blocks.find(b => 
        b.position[0] === 7 && b.position[1] === 10 && b.position[2] === 7
      )
      
      assert.isDefined(foundBlock)
      assert.strictEqual(foundBlock?.blockType, 'glass')
    })
  })
})