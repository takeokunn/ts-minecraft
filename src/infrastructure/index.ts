// Infrastructure Adapters - Core adapters only (used in layers.ts and renderers)
export {
  // System Communication Adapter
  SystemCommunicationAdapter,
  SystemCommunicationLive,
  // Performance Monitor Adapter
  PerformanceMonitorAdapter,
  PerformanceMonitorLive,
  // Math Adapters (used in tests)
  AllThreeJsMathAdaptersLive,
  AllNativeMathAdaptersLive,
} from './adapters'

// Layers - Core layer exports (used in main.ts and tests)
export { World, WorldDomainService, PhysicsDomainService, EntityDomainService, UnifiedAppLive, TestLayer, Stats, Clock, MaterialManager, Renderer } from './layers'

// Repositories - Core repositories only (used in repository utils)
export {
  createWorldRepository,
  WorldRepositoryService,
  WorldRepositoryLive,
  type IWorldRepository,
  EntityRepositoryImpl,
  EntityRepository,
  EntityRepositoryLive,
  type IEntityRepository,
  ChunkRepositoryImpl,
  ChunkRepository,
  ChunkRepositoryLive,
  type IChunkRepository,
} from './repositories'

