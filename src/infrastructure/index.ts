// Infrastructure Adapters - Core adapters only (used in layers.ts and renderers)
export {
  // Three.js Rendering Adapter
  ThreeJsAdapter,
  ThreeJsContext,
  ThreeJsAdapterLive,
  ThreeJsContextLive,
  type IThreeJsAdapter,
  type IThreeJsContext,
  type RenderCommand,
  // System Communication Adapter
  SystemCommunicationAdapter,
  SystemCommunicationLive,
  // Performance Monitor Adapter
  PerformanceMonitorAdapter,
  PerformanceMonitorLive,
  // Math Adapters (used in tests)
  AllThreeJsMathAdaptersLive,
  AllNativeMathAdaptersLive,
  // Validation utilities (for internal testing)
  validateDependencyInversion,
  validateAdapterCompliance,
  runPortsAdaptersValidation,
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

// Performance - Core performance exports (used in CLI and services)
export { ObjectPool } from './performance'
