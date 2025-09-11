/**
 * World component utilities and factory functions
 */
import { ChunkComponent, ChunkLoaderStateComponent, TerrainBlockComponent, TargetBlockComponent } from '@domain/entities/components/world/chunk'
import { toChunkX, toChunkZ } from '@domain/value-objects/common'

// Type definitions
import type { ChunkComponent as ChunkComponentType, ChunkLoaderStateComponent as ChunkLoaderStateComponentType } from '@domain/entities/components/world/chunk'
import type { TerrainBlockComponent as TerrainBlockComponentType, TargetBlockComponent as TargetBlockComponentType } from '@domain/entities/components/world/terrain-block'

// Aggregate world component schemas for registration
export const WorldComponentSchemas = {
  chunk: ChunkComponent,
  chunkLoaderState: ChunkLoaderStateComponent,
  terrainBlock: TerrainBlockComponent,
  targetBlock: TargetBlockComponent,
} as const

// Aggregate all world components for easy import
export const WorldComponents = {
  Chunk: ChunkComponent,
  ChunkLoaderState: ChunkLoaderStateComponent,
  TerrainBlock: TerrainBlockComponent,
  WorldTargetBlock: TargetBlockComponent,
} as const

// World component factory functions (simple constructors for data-only components)
export const createChunk = (chunkX: number, chunkZ: number, blocks: any[]): ChunkComponentType => ({
  chunkX: toChunkX(chunkX),
  chunkZ: toChunkZ(chunkZ),
  blocks,
})

export const createChunkLoaderState = (loadedChunks: any): ChunkLoaderStateComponentType => ({
  loadedChunks,
})

export const createTerrainBlock = (): TerrainBlockComponentType => ({})

export const createTargetBlock = (): TargetBlockComponentType => ({})

// World component factory functions
export const WorldComponentFactories = {
  createChunk,
  createChunkLoaderState,
  createTerrainBlock,
  createTargetBlock,
} as const