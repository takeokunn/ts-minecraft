/**
 * ECS Infrastructure Module
 *
 * Entity-Component-Systemアーキテクチャの基盤実装
 * 型安全でシリアライズ可能なコンポーネントシステムを提供
 */

export * from './component'
export * from './component-registry'
// entity.tsからのエクスポート（EntityIdとEntityMetadataを含む）
export {
  EntityPool,
  EntityPoolError,
  EntityPoolLive,
  createArchetypeManager,
  createComponentStorage,
  type Archetype,
  type ArchetypeManager,
  type ComponentStorage,
  type EntityId,
  type EntityMetadata,
  type EntityPoolStats,
} from './entity'
export * from './entity-manager'
export * from './system'
export * from './system-registry'
// world.tsからのエクスポート（EntityIdとEntityMetadataは除外）
export { World, WorldError, WorldLive, type WorldStats } from './world'
