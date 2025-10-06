/**
 * ECS Infrastructure Module
 *
 * Entity-Component-Systemアーキテクチャの基盤実装
 * 型安全でシリアライズ可能なコンポーネントシステムを提供
 */

export * from './index'
export * from './index'
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
} from './index'
export * from './index'
export * from './index'
export * from './index'
// world.tsからのエクスポート（EntityIdとEntityMetadataは除外）
export { World, WorldError, WorldLive, type WorldStats } from './index'
export * from './index';
export * from './index';
export * from './index';
export * from './system';
export * from './system-registry';
export * from './entity';
export * from './component-registry';
export * from './component-definition';
export * from './component';
