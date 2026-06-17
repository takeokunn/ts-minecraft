export * from './application/chunk-count-port'
export * from './application/perf-flags'
export * from './domain/errors'
export * from './infrastructure/renderer/world-renderer'
export * from './infrastructure/renderer/world-renderer-pose-cache'
export * from './infrastructure/camera/perspective'
export * from './infrastructure/entity/entity-instance-pool'
export * from './infrastructure/entity/entity-renderer'
export * from './infrastructure/entity/mob-geometry'
export * from './infrastructure/entity/walk-cycle'
export * from './infrastructure/player'
export * from './infrastructure/post-processing/composite-pass'
export * from './infrastructure/post-processing/god-rays-pass'
export * from './infrastructure/meshing/block-mesh'
export * from './infrastructure/meshing/chunk-mesh'
export * from './infrastructure/meshing/greedy-meshing'
// FR-4.1: expose subregion entrypoint and schema; suppress the secondary
// DirtyAABB type export (the canonical one is from meshing-worker-pool below).
export {
  greedyMeshChunkSubregion,
  computeAffectedSlices,
  DirtyAABBSchema,
  type SubregionMeshOptions,
  type SliceRange,
} from './infrastructure/meshing/subregion-greedy'
export * from './infrastructure/meshing/lod-simplification'

export * from './infrastructure/perf/gpu-timer-service'
export * from './infrastructure/perf/perf-marks'
export * from './infrastructure/raycasting/raycasting-service'
export * from './infrastructure/renderer/renderer-service'
export * from './infrastructure/scene/scene-service'
export * from './infrastructure/textures/block-texture-map.config'
export * from './infrastructure/textures/block-texture-map'
export * from './infrastructure/textures/item-texture-map.config'
export * from './infrastructure/textures/item-texture-map'
export * from './infrastructure/textures/texture-loader'
export * from './infrastructure/post-processing/water-material'
export * from './infrastructure/particles/particle-system'
export * from './presentation/perf-hud'
// Worker re-exports removed to break circular dependency (rendering ↔ worker).
// Import directly from @ts-minecraft/worker instead.
