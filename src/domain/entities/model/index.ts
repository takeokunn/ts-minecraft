/**
 * @fileoverview Entityモデルのバレルエクスポート
 * エンティティとプレイヤーのドメインモデル
 */

// Entity
export type {
  EntityCoreState,
  EntityCreateInput,
  EntityDomainFailure,
  EntityState,
  EntityTickInput,
  EntityUpdateInput,
} from './index'
export {
  EntityCreateSchema,
  EntityTickSchema,
  EntityUpdateSchema,
  createEntity,
  integrateTick,
  updateEntity,
} from './index'

// Player
export type { PlayerDomainFailure } from './index'
export { applyExperienceGain, applyPlayerUpdate, changeGameMode } from './index'
export * from './player';
export * from './entity';
