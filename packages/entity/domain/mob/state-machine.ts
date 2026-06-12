import { Schema } from 'effect'
import { Vector3Schema, normalize, scale, subtract, zero, type Vector3 } from '@ts-minecraft/core'
import { PositionSchema, type Position } from '@ts-minecraft/core'
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

// Allocation-free variant of computeStateVelocity for the per-entity AI hot path.
// Writes the steering velocity into `out` instead of allocating ~5 Vector3 per call.
// Chase/Flee steer on the horizontal plane (out.y = 0, matching the toHorizontalTarget
// the caller used); Wander normalizes the full wander vector. Behavior mirrors
// computeStateVelocity exactly — a zero-length direction yields the zero vector
// (see normalize(): len === 0 → zero).
const writeHorizontalDir = (
  out: { x: number; y: number; z: number },
  dx: number,
  dz: number,
  speed: number,
): void => {
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len === 0) {
    out.x = 0; out.y = 0; out.z = 0
    return
  }
  const inv = speed / len
  out.x = dx * inv; out.y = 0; out.z = dz * inv
}

export const computeStateVelocityInto = (
  out: { x: number; y: number; z: number },
  state: AIState,
  entityX: number, entityZ: number,
  playerX: number, playerZ: number,
  speed: number,
  wanderX: number, wanderY: number, wanderZ: number,
): void => {
  switch (state) {
    case AIState.Chase:
      writeHorizontalDir(out, playerX - entityX, playerZ - entityZ, speed)
      return
    case AIState.Flee:
      writeHorizontalDir(out, entityX - playerX, entityZ - playerZ, speed)
      return
    case AIState.Wander: {
      const len = Math.sqrt(wanderX * wanderX + wanderY * wanderY + wanderZ * wanderZ)
      if (len === 0) {
        out.x = 0; out.y = 0; out.z = 0
        return
      }
      const inv = speed / len
      out.x = wanderX * inv; out.y = wanderY * inv; out.z = wanderZ * inv
      return
    }
    case AIState.Attack:
    case AIState.Idle:
      out.x = 0; out.y = 0; out.z = 0
      return
  }
}
