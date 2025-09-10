import { describe, it, assert } from '@effect/vitest'
import * as S from 'effect/Schema'
import { PlacedBlock, GenerationParams, ChunkGenerationResult, OutgoingMessage } from '../messages'
import { toInt } from '../../domain/common'

describe('messages', () => {
  it('PlacedBlock schema should validate correct data', () => {
    const validBlock = {
      position: [toInt(0), toInt(1), toInt(2)],
      blockType: 'grass' as const,
    }
    
    const result = S.decodeUnknownSync(PlacedBlock)(validBlock)
    assert.deepStrictEqual(result.position, [toInt(0), toInt(1), toInt(2)])
    assert.strictEqual(result.blockType, 'grass')
  })

  it('GenerationParams schema should validate correct data', () => {
    const validParams = {
      type: 'generateChunk' as const,
      chunkX: toInt(0),
      chunkZ: toInt(0),
      seeds: {
        world: 123,
        biome: 456,
        trees: 789,
      },
      amplitude: 50,
      editedBlocks: {
        destroyed: ['0,1,2'],
        placed: {},
      },
    }
    
    const result = S.decodeUnknownSync(GenerationParams)(validParams)
    assert.strictEqual(result.type, 'generateChunk')
    assert.strictEqual(result.chunkX, toInt(0))
    assert.strictEqual(result.seeds.world, 123)
  })

  it('ChunkGenerationResult schema should validate correct data', () => {
    const validResult = {
      type: 'chunkGenerated' as const,
      blocks: [],
      mesh: {
        positions: new Float32Array(0),
        normals: new Float32Array(0),
        uvs: new Float32Array(0),
        indices: new Uint32Array(0),
      },
      chunkX: toInt(5),
      chunkZ: toInt(10),
    }
    
    const result = S.decodeUnknownSync(ChunkGenerationResult)(validResult)
    assert.strictEqual(result.type, 'chunkGenerated')
    assert.strictEqual(result.chunkX, toInt(5))
    assert.strictEqual(result.chunkZ, toInt(10))
  })

  it('OutgoingMessage schema should validate ChunkGenerationResult', () => {
    const validMessage = {
      type: 'chunkGenerated' as const,
      blocks: [],
      mesh: {
        positions: new Float32Array(0),
        normals: new Float32Array(0),
        uvs: new Float32Array(0),
        indices: new Uint32Array(0),
      },
      chunkX: toInt(0),
      chunkZ: toInt(0),
    }
    
    const result = S.decodeUnknownSync(OutgoingMessage)(validMessage)
    assert.strictEqual(result.type, 'chunkGenerated')
  })

  it('OutgoingMessage schema should validate WorkerError', () => {
    const validError = {
      type: 'error' as const,
      error: 'Test error message',
    }
    
    const result = S.decodeUnknownSync(OutgoingMessage)(validError)
    assert.strictEqual(result.type, 'error')
    assert.strictEqual(result.error, 'Test error message')
  })
})