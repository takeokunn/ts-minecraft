export {
  EntityIdSchema,
  EntityId,
  EntityType,
  createEntity,
  type Entity,
  type MobBehavior,
  EntityTypeSchema,
  MobBehaviorSchema,
} from './domain/entity'
export { EntityManager, EntityManagerLive } from './application/entityManager'
export { MobSpawner, MobSpawnerLive } from './application/spawner'
export * from './domain/mobs'
export {
  AIState,
  AIStateSchema,
  resolveAIState,
  computeStateVelocity,
  distanceToPlayer,
  type AITransitionContext,
  type AIMotionContext,
} from './domain/stateMachine'
export { MIN_SPAWN_DISTANCE, MAX_SPAWN_DISTANCE, MAX_ENTITY_COUNT, SPAWN_INTERVAL_FRAMES, PASSIVE_MOBS } from './domain/spawner-config'
export { HOSTILE_ATTACK_COOLDOWN_SECS, type ManagedEntity } from './domain/entity-internal'
export { hashEntityId, makeWanderDirection, toPublicEntity } from './domain/entity-utils'
export { MobDefinitionSchema } from './domain/mobs/mob-definition'
