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
} from './Entity'
export * from './EntityManager'
export * from './System'
export * from './SystemRegistry'
// World.tsからのエクスポート（EntityIdとEntityMetadataは除外）
export { World, WorldError, WorldLive, type WorldStats } from './World'
