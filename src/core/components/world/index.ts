/**
 * World Components
 * Components related to world structure and terrain
 */

export { 
  ChunkComponent,
  ChunkLoaderStateComponent,
  type ChunkComponent as ChunkComponentType,
  type ChunkLoaderStateComponent as ChunkLoaderStateComponentType,
} from './chunk'

export { 
  TerrainBlockComponent,
  TargetBlockComponent,
  type TerrainBlockComponent as TerrainBlockComponentType,
  type TargetBlockComponent as TargetBlockComponentType,
} from './terrain-block'

// Aggregate world component schemas for registration
export const WorldComponentSchemas = {
  chunk: () => import('./chunk').then(m => m.ChunkComponent),
  chunkLoaderState: () => import('./chunk').then(m => m.ChunkLoaderStateComponent),
  terrainBlock: () => import('./terrain-block').then(m => m.TerrainBlockComponent),
  targetBlock: () => import('./terrain-block').then(m => m.TargetBlockComponent),
} as const