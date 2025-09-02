import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as ComputationWorker from '../computation.worker'
import type { ComputationTask, GenerationParams } from '../../domain/types'
import { PlacedBlock } from '../../domain/block'
import { Y_OFFSET } from '../../domain/world-constants'
import { Effect, Option } from 'effect'

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
  const [ax, ay, az] = a.position
  const [bx, by, bz] = b.position
  if (ay !== by) return ay - by
  if (az !== bz) return az - bz
  if (ax !== bx) return ax - bx
  return 0
}

describe('computation.worker', () => {
  // These tests use the original implementations
  describe('generateBlockData', () => {
    it('should generate a deterministic set of blocks for a given seed', async () => {
      const program = Effect.gen(function* ($) {
        const blocks1 = yield* $(ComputationWorker.generateBlockData(defaultParams))
        const blocks2 = yield* $(ComputationWorker.generateBlockData(defaultParams))
        expect([...blocks1].sort(compareBlocks)).toEqual([...blocks2].sort(compareBlocks))
      })
      await Effect.runPromise(program)
    })
  })

  describe('createChunkDataView and getBlock', () => {
    it('should create a view and allow retrieving blocks', () => {
      const blocks: PlacedBlock[] = [{ position: [0, 0, 0], blockType: 'stone' }]
      const view = ComputationWorker.createChunkDataView(blocks, 0, 0)
      const block = ComputationWorker.getBlock(view, 0, 0 + Y_OFFSET, 0)
      expect(Option.getOrNull(block)).toBe('stone')
    })
  })

  // ... other tests for original functions can be restored here

  describe('messageHandler', () => {
    const self = globalThis as any
    let postMessageSpy: any
    let consoleErrorSpy: any

    beforeEach(() => {
      postMessageSpy = vi.fn()
      self.postMessage = postMessageSpy
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should call generateChunk and postMessage on "generateChunk" task', async () => {
      const task: ComputationTask = {
        type: 'generateChunk',
        payload: defaultParams,
      }
      const event = { data: task } as MessageEvent<ComputationTask>
      const mockResult = {
        blocks: [],
        mesh: { positions: new Float32Array(), normals: new Float32Array(), uvs: new Float32Array(), indices: new Uint32Array() },
        chunkX: defaultParams.chunkX,
        chunkZ: defaultParams.chunkZ,
      }
      const generateChunkMock = vi.fn(() => Effect.succeed(mockResult))

      await ComputationWorker.messageHandler(event, generateChunkMock)

      expect(generateChunkMock).toHaveBeenCalledWith(defaultParams)
      expect(postMessageSpy).toHaveBeenCalledOnce()
      const result = postMessageSpy.mock.calls[0][0]
      expect(result.chunkX).toBe(defaultParams.chunkX)
    })

    it('should handle errors during chunk generation', async () => {
      const error = new Error('Chunk generation failed')
      const generateChunkMock = vi.fn(() => Effect.die(error))
      const task: ComputationTask = {
        type: 'generateChunk',
        payload: defaultParams,
      }
      const event = { data: task } as MessageEvent<ComputationTask>

      await ComputationWorker.messageHandler(event, generateChunkMock)

      expect(generateChunkMock).toHaveBeenCalledWith(defaultParams)
      expect(postMessageSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in computation worker:', expect.any(Error))
    })
  })
})
