import { Layer, Effect, Ref, HashMap } from 'effect'
import { ChunkManager } from '@/services/world/chunk-manager.service'
import { ChunkCoordinates } from '@/core/values/coordinates/chunk-coordinates.value'
import { Chunk } from '@/core/components/world/chunk'

/**
 * ChunkManager Live implementation
 * Manages chunk loading, unloading, and caching
 */
export const ChunkManagerLive = Layer.effect(
  ChunkManager,
  Effect.gen(function* () {
    // Chunk storage - using HashMap for efficient lookup
    const chunks = yield* Ref.make<HashMap.HashMap<string, Chunk>>(HashMap.empty())
    const loadingChunks = yield* Ref.make<Set<string>>(new Set())
    
    // Configuration
    const RENDER_DISTANCE = 8
    
    // Generate chunk key
    const getChunkKey = (coords: ChunkCoordinates): string =>
      `${coords.x},${coords.z}`
    
    // Load a chunk
    const loadChunk = (coords: ChunkCoordinates) =>
      Effect.gen(function* () {
        const key = getChunkKey(coords)
        
        // Check if already loaded
        const currentChunks = yield* Ref.get(chunks)
        const existing = HashMap.get(currentChunks, key)
        if (existing._tag === 'Some') {
          return existing.value
        }
        
        // Check if currently loading
        const loading = yield* Ref.get(loadingChunks)
        if (loading.has(key)) {
          // Wait for loading to complete
          yield* Effect.sleep('100 millis')
          return yield* loadChunk(coords)
        }
        
        // Mark as loading
        yield* Ref.update(loadingChunks, (set) => {
          const newSet = new Set(set)
          newSet.add(key)
          return newSet
        })
        
        try {
          // Generate chunk data (placeholder - should use TerrainGenerator)
          const chunk = createEmptyChunk(coords)
          
          // Store chunk
          yield* Ref.update(chunks, (map) =>
            HashMap.set(map, key, chunk)
          )
          
          // Remove from loading set
          yield* Ref.update(loadingChunks, (set) => {
            const newSet = new Set(set)
            newSet.delete(key)
            return newSet
          })
          
          return chunk
        } catch (error) {
          // Remove from loading set on error
          yield* Ref.update(loadingChunks, (set) => {
            const newSet = new Set(set)
            newSet.delete(key)
            return newSet
          })
          throw error
        }
      })
    
    // Unload a chunk
    const unloadChunk = (coords: ChunkCoordinates) =>
      Effect.gen(function* () {
        const key = getChunkKey(coords)
        yield* Ref.update(chunks, (map) =>
          HashMap.remove(map, key)
        )
      })
    
    // Get a chunk if loaded
    const getChunk = (coords: ChunkCoordinates) =>
      Effect.gen(function* () {
        const key = getChunkKey(coords)
        const currentChunks = yield* Ref.get(chunks)
        return HashMap.get(currentChunks, key)
      })
    
    // Get all loaded chunks
    const getLoadedChunks = () =>
      Effect.gen(function* () {
        const currentChunks = yield* Ref.get(chunks)
        return Array.from(HashMap.values(currentChunks))
      })
    
    // Update visible chunks based on player position
    const updateVisibleChunks = (centerCoords: ChunkCoordinates) =>
      Effect.gen(function* () {
        const toLoad: ChunkCoordinates[] = []
        const toUnload: string[] = []
        
        // Determine chunks to load
        for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
          for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
            const coords = ChunkCoordinates({
              x: centerCoords.x + dx,
              z: centerCoords.z + dz
            })
            const key = getChunkKey(coords)
            
            const currentChunks = yield* Ref.get(chunks)
            if (!HashMap.has(currentChunks, key)) {
              toLoad.push(coords)
            }
          }
        }
        
        // Determine chunks to unload
        const currentChunks = yield* Ref.get(chunks)
        for (const [key, _chunk] of HashMap.entries(currentChunks)) {
          const [x, z] = key.split(',').map(Number)
          const distance = Math.max(
            Math.abs(x - centerCoords.x),
            Math.abs(z - centerCoords.z)
          )
          
          if (distance > RENDER_DISTANCE + 2) {
            toUnload.push(key)
          }
        }
        
        // Load new chunks
        yield* Effect.forEach(toLoad, loadChunk, { concurrency: 4 })
        
        // Unload distant chunks
        yield* Ref.update(chunks, (map) => {
          let updated = map
          for (const key of toUnload) {
            updated = HashMap.remove(updated, key)
          }
          return updated
        })
      })
    
    // Helper function to create empty chunk
    const createEmptyChunk = (coords: ChunkCoordinates): Chunk => ({
      coordinates: coords,
      blocks: new Uint8Array(16 * 256 * 16),
      metadata: {
        generated: true,
        modified: false,
        timestamp: Date.now()
      }
    })
    
    return ChunkManager.of({
      loadChunk,
      unloadChunk,
      getChunk,
      getLoadedChunks,
      updateVisibleChunks,
      getRenderDistance: () => Effect.succeed(RENDER_DISTANCE),
      setRenderDistance: () => 
        Effect.succeed(undefined), // Would update RENDER_DISTANCE
    })
  })
)