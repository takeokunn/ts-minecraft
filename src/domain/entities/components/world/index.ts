/**
 * World Components
 * Components related to world structure and terrain
 */

import { ChunkComponent, ChunkLoaderStateComponent, type ChunkComponent as ChunkComponentType, type ChunkLoaderStateComponent as ChunkLoaderStateComponentType } from './chunk'
import {
  TerrainBlockComponent,
  TargetBlockComponent,
  type TerrainBlockComponent as TerrainBlockComponentType,
  type TargetBlockComponent as TargetBlockComponentType,
} from './terrain-block'
import { toChunkX, toChunkZ } from '../../common'

export {
  ChunkComponent,
  ChunkLoaderStateComponent,
  Chunk,
  type ChunkComponent as ChunkComponentType,
  type ChunkLoaderStateComponent as ChunkLoaderStateComponentType,
} from './chunk'

export {
  TerrainBlockComponent,
  TargetBlockComponent,
  TargetBlockComponent as TargetBlock,
  type TerrainBlockComponent as TerrainBlockComponentType,
  type TargetBlockComponent as TargetBlockComponentType,
} from './terrain-block'

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
  TargetBlock: TargetBlockComponent,
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
