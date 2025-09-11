/**
 * World Components
 * Components related to world structure and terrain
 */

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

// Component utilities and factories
export * from './component-utils'
