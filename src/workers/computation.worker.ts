import { Effect } from 'effect'
import { GenerationParams, ChunkGenerationResult } from './messages'
import { createWorker } from './shared/worker-base'
import { generateBlockData } from './terrain-generation'
import { generateGreedyMesh } from './mesh-generation'

// Define the worker handler with full type safety
const computationHandler = (params: GenerationParams): Effect.Effect<ChunkGenerationResult> =>
  Effect.gen(function* () {
    // Generate terrain blocks
    const blocks = yield* Effect.sync(() => generateBlockData(params))
    
    // Generate mesh from blocks
    const mesh = yield* Effect.sync(() => generateGreedyMesh(blocks, params.chunkX, params.chunkZ))
    
    // Create result
    const result: ChunkGenerationResult = {
      type: 'chunkGenerated',
      blocks,
      mesh,
      chunkX: params.chunkX,
      chunkZ: params.chunkZ,
    }
    
    // Use transferable objects for better performance
    if (typeof self !== 'undefined' && self.postMessage) {
      const originalPostMessage = self.postMessage
      self.postMessage = (message: any) => {
        if (message.type === 'success' && message.data.mesh) {
          originalPostMessage(message, {
            transfer: [
              message.data.mesh.positions.buffer,
              message.data.mesh.normals.buffer,
              message.data.mesh.uvs.buffer,
              message.data.mesh.indices.buffer,
            ],
          })
        } else {
          originalPostMessage(message)
        }
      }
    }
    
    return result
  })

// Create the worker with type-safe message handling
const worker = createWorker({
  inputSchema: GenerationParams,
  outputSchema: ChunkGenerationResult,
  handler: computationHandler,
})

// Start the worker
worker.start()
