// Mob schemas and branded constructors
export { EntityIdSchema, EntityId, EntityTypeSchema, MobBehaviorSchema, EntitySchema } from './mob/entity'
export type { EntityId as EntityIdType, EntityType, MobBehavior, Entity } from './mob/entity'
export { MobDefinitionSchema } from './mob/mobs/mob-definition'
export type { MobDefinition } from './mob/mobs/mob-definition'
export { AIStateSchema, AITransitionContextSchema, AIMotionContextSchema } from './mob/state-machine'
export type { AIState, AITransitionContext, AIMotionContext } from './mob/state-machine'

// Player schemas
export { CameraRotationSchema, CameraModeSchema } from './camera-state'
export type { CameraRotation, CameraMode } from './camera-state'
export { PlayerHealth } from './player-health'
export { PlayerHunger } from './player-hunger'
export { PlayerStateSchema } from './player-state'
export type { PlayerState } from './player-state'

// Redstone schemas and branded constructors
export {
  RedstonePowerLevelSchema,
  RedstonePowerLevel,
  RedstoneComponentTypeSchema,
  RedstoneComponentStateSchema,
  RedstoneComponentSchema,
  RedstoneTickSnapshotSchema,
} from './redstone/redstone-model'
export type {
  RedstonePowerLevel as RedstonePowerLevelType,
  RedstoneComponentType,
  RedstoneComponentState,
  RedstoneComponent,
  RedstoneTickSnapshot,
} from './redstone/redstone-model'

// Village schemas and branded constructors
export {
  VillageIdSchema,
  VillageId,
  VillageStructureIdSchema,
  VillageStructureId,
  VillagerIdSchema,
  VillagerId,
  VillageStructureTypeSchema,
  VillageStructureSchema,
  VillagerProfessionSchema,
  VillagerActivitySchema,
  VillagerSchema,
  VillageSchema,
} from './village/village-model'
export type {
  VillageId as VillageIdType,
  VillageStructureId as VillageStructureIdType,
  VillagerId as VillagerIdType,
  VillageStructureType,
  VillageStructure,
  VillagerProfession,
  VillagerActivity,
  Villager,
  Village,
} from './village/village-model'

// Trading schemas and branded constructors
export {
  TradeOfferIdSchema,
  TradeOfferId,
  TradeStackSchema,
  TradeOfferSchema,
  TradeFailureReasonSchema,
} from './trading/trading-model'
export type {
  TradeOfferId as TradeOfferIdType,
  TradeStack,
  TradeOffer,
  TradeFailureReason,
} from './trading/trading-model'
