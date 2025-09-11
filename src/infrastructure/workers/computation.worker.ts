import { Effect, Duration } from 'effect'
import { createTypedWorker } from './base/typed-worker'
import {
  TerrainGenerationRequest,
  TerrainGenerationResponse,
  prepareMeshForTransfer,
  Position3D,
  Block,
} from './shared/protocol'



/**
 * Legacy computation worker - migrated to new typed worker system
 * This maintains compatibility while using the new infrastructure
 */

// Re-export the terrain generation worker functionality
export * from './terrain-generation.worker'

// Maintain backward compatibility with a simplified interface
const computationHandler = (
  request: TerrainGenerationRequest,
  context: any
): Effect.Effect<TerrainGenerationResponse, never, never> =>
  Effect.gen(function* () {
    // Forward to terrain generation logic
    const startTime = Date.now()
    
    // Simple terrain generation for backward compatibility
    const blocks: Block[] = []
    const chunkSize = 16
    
    // Generate basic terrain
    for (let x = 0; x < chunkSize; x++) {
      for (let z = 0; z < chunkSize; z++) {
        for (let y = -10; y < 5; y++) {
          blocks.push({
            position: { x, y, z },
            blockType: { type: 'stone' } as any,
          })
        }
      }
    }
    
    // Create simple mesh
    const meshData = prepareMeshForTransfer({
      positions: [],
      normals: [],
      uvs: [],
      indices: [],
    })
    
    const response: TerrainGenerationResponse = {
      chunkData: {
        coordinates: request.coordinates,
        blocks,
        heightMap: new Array(chunkSize * chunkSize).fill(5),
        timestamp: Date.now(),
      },
      meshData,
      performanceMetrics: {
        generationTime: Date.now() - startTime,
        blockCount: blocks.length,
        meshGenerationTime: 0,
      },
    }
    
    return response
  })

// Create the worker with new typed system
const worker = createTypedWorker({
  name: 'computation-legacy',
  inputSchema: TerrainGenerationRequest,
  outputSchema: TerrainGenerationResponse,
  handler: computationHandler,
  timeout: Duration.seconds(30),
})

// Start the worker
Effect.runPromise(worker.start())
