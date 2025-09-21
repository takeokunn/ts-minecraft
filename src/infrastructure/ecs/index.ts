/**
 * ECS Infrastructure Module
 *
 * Entity-Component-Systemアーキテクチャの基盤実装
 * 型安全でシリアライズ可能なコンポーネントシステムを提供
 */

export * from './Component'
export * from './ComponentRegistry'
// Entity.tsからのエクスポート（EntityIdとEntityMetadataを含む）
export {
  type EntityId,
  type EntityMetadata,
  EntityPoolError,
  EntityPool,
  type EntityPoolStats,
  EntityPoolLive,
  createComponentStorage,
  type ComponentStorage,
  type Archetype,
  createArchetypeManager,
  type ArchetypeManager,
} from './Entity'
export * from './EntityManager'
export * from './System'
export * from './SystemRegistry'
// World.tsからのエクスポート（EntityIdとEntityMetadataは除外）
export { World, WorldError, WorldLive, type WorldStats } from './World'
