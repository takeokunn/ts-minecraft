/**
 * @fileoverview Entityモデルのバレルエクスポート
 * エンティティとプレイヤーのドメインモデル
 */

// Entity
export {
  EntityCreateSchema,
  EntityTickSchema,
  EntityUpdateSchema,
  createEntity,
  integrateTick,
  updateEntity,
} from './entity'
export type {
  EntityCoreState,
  EntityCreateInput,
  EntityDomainFailure,
  EntityState,
  EntityTickInput,
  EntityUpdateInput,
} from './entity'

// Player
export * from './entity'
export { applyExperienceGain, applyPlayerUpdate, changeGameMode } from './entity'
export type { PlayerDomainFailure } from './entity'
export * from './player'
