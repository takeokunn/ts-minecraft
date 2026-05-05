import { Schema } from 'effect'
import { Vector3Schema, normalize, scale, subtract, zero, type Vector3 } from '@ts-minecraft/kernel'
import { PositionSchema, type Position } from '@ts-minecraft/kernel'
import { MobBehaviorSchema } from './entity'

export const AIStateSchema = Schema.Literal('Idle', 'Wander', 'Chase', 'Flee', 'Attack')
export type AIState = Schema.Schema.Type<typeof AIStateSchema>
export const AIState = {
  Idle: 'Idle' as const,
  Wander: 'Wander' as const,
  Chase: 'Chase' as const,
  Flee: 'Flee' as const,
  Attack: 'Attack' as const,
}

export const AITransitionContextSchema = Schema.Struct({
  behavior: MobBehaviorSchema,
  distanceToPlayer: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  canSeePlayer: Schema.Boolean,
  healthRatio: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  randomWanderRoll: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  attackRange: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  detectionRange: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  fleeHealthThreshold: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type AITransitionContext = Schema.Schema.Type<typeof AITransitionContextSchema>

const WANDER_TRIGGER_THRESHOLD = 0.25
const WANDER_CONTINUE_THRESHOLD = 0.85

export const resolveAIState = (
  currentState: AIState,
  context: AITransitionContext,
): AIState => {
  if (
    context.behavior === 'hostile'
    && context.canSeePlayer
    && context.distanceToPlayer <= context.attackRange
  ) {
    return AIState.Attack
  }

  if (context.canSeePlayer && context.distanceToPlayer <= context.detectionRange) {
    if (context.behavior === 'hostile') {
      return context.healthRatio <= context.fleeHealthThreshold ? AIState.Flee : AIState.Chase
    }

    return AIState.Flee
  }

  if (context.randomWanderRoll < WANDER_TRIGGER_THRESHOLD) {
    return AIState.Wander
  }

  if (currentState === AIState.Wander && context.randomWanderRoll < WANDER_CONTINUE_THRESHOLD) {
    return AIState.Wander
  }

  return AIState.Idle
}

export const distanceToPlayer = (entityPosition: Position, playerPosition: Position): number => {
  const dx = playerPosition.x - entityPosition.x
  const dy = playerPosition.y - entityPosition.y
  const dz = playerPosition.z - entityPosition.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export const distanceToPlayerSq = (entityPosition: Position, playerPosition: Position): number => {
  const dx = playerPosition.x - entityPosition.x
  const dy = playerPosition.y - entityPosition.y
  const dz = playerPosition.z - entityPosition.z
  return dx * dx + dy * dy + dz * dz
}

export const AIMotionContextSchema = Schema.Struct({
  state: AIStateSchema,
  entityPosition: PositionSchema,
  playerPosition: PositionSchema,
  speed: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  wanderDirection: Vector3Schema,
})
export type AIMotionContext = Schema.Schema.Type<typeof AIMotionContextSchema>

const toVector3 = (position: Position): Vector3 => ({
  x: position.x,
  y: position.y,
  z: position.z,
})

const directionBetween = (from: Position, to: Position): Vector3 =>
  normalize(subtract(toVector3(to), toVector3(from)))

export const computeStateVelocity = (context: AIMotionContext): Vector3 => {
  switch (context.state) {
    case AIState.Chase:
      return scale(directionBetween(context.entityPosition, context.playerPosition), context.speed)
    case AIState.Flee:
      return scale(directionBetween(context.playerPosition, context.entityPosition), context.speed)
    case AIState.Wander:
      return scale(normalize(context.wanderDirection), context.speed)
    case AIState.Attack:
    case AIState.Idle:
      return zero
  }
}
