import { distance, zero, type Position, type Vector3 } from '@ts-minecraft/core'
import { computeCirclingVelocity, computeLandingVelocity, computeStrafingVelocity, computeTakeoffVelocity } from './dragon-flight'
import { dragonDamageMultiplier, shouldUseBreathAttack } from './dragon-combat'
import { MAX_DRAGON_HEALTH } from './dragon-healing'

export const DragonPhase = {
  Circling: 'Circling',
  Strafing: 'Strafing',
  Landing: 'Landing',
  Perched: 'Perched',
  Takeoff: 'Takeoff',
  DeathSequence: 'DeathSequence',
} as const
export type DragonPhase = (typeof DragonPhase)[keyof typeof DragonPhase]

export type DragonPhaseState = {
  readonly phase: DragonPhase
  readonly phaseTimer: number
  readonly phaseProgress: number
  readonly perchPosition: Position | null
  readonly circlingRadius: number
  readonly circlingHeight: number
  readonly circlingAngle: number
}

export type DragonPhaseInput = {
  readonly dragonPosition: Position
  readonly dragonHealth: number
  readonly playerPosition: Position | null
  readonly portalPosition: Position
  readonly randomValue: number
  readonly tick: number
}

export type DragonPhaseIntent = {
  readonly newPhase: DragonPhase
  readonly newVelocity: Vector3
  readonly wantsBreathAttack: boolean
  readonly healsFromCrystals: boolean
  readonly damageMultiplier: number
}

export type DragonPhaseStep = {
  readonly nextState: DragonPhaseState
  readonly intent: DragonPhaseIntent
}

const PLAYER_NEARBY_RANGE = 96
const CIRCLING_ANGLE_STEP = 0.05
const PERCHED_TAKEOFF_TICKS = 100
const TAKEOFF_COMPLETE_Y = 80
const LOW_ALTITUDE_Y = 70

const healthRatio = (health: number): number => health / MAX_DRAGON_HEALTH

const playerNearby = (state: DragonPhaseState, input: DragonPhaseInput): boolean =>
  input.playerPosition !== null
  && distance(input.dragonPosition, input.playerPosition) <= PLAYER_NEARBY_RANGE
  && state.circlingAngle > Math.PI * 2

const resolveNextPhase = (state: DragonPhaseState, input: DragonPhaseInput): DragonPhase => {
  if (input.dragonHealth <= 0) return DragonPhase.DeathSequence

  switch (state.phase) {
    case DragonPhase.Circling:
      return playerNearby(state, input) ? DragonPhase.Strafing : DragonPhase.Circling
    case DragonPhase.Strafing:
      return healthRatio(input.dragonHealth) < 0.5 && input.dragonPosition.y < LOW_ALTITUDE_Y
        ? DragonPhase.Landing
        : DragonPhase.Strafing
    case DragonPhase.Landing:
      return input.dragonPosition.y <= input.portalPosition.y ? DragonPhase.Perched : DragonPhase.Landing
    case DragonPhase.Perched:
      return state.phaseTimer >= PERCHED_TAKEOFF_TICKS || healthRatio(input.dragonHealth) < 0.1
        ? DragonPhase.Takeoff
        : DragonPhase.Perched
    case DragonPhase.Takeoff:
      return input.dragonPosition.y > TAKEOFF_COMPLETE_Y ? DragonPhase.Circling : DragonPhase.Takeoff
    case DragonPhase.DeathSequence:
      return DragonPhase.DeathSequence
  }
}

const progressFor = (phase: DragonPhase, phaseTimer: number): number => {
  if (phase === DragonPhase.Perched) return Math.min(1, phaseTimer / PERCHED_TAKEOFF_TICKS)
  return 0
}

const velocityFor = (phase: DragonPhase, input: DragonPhaseInput, state: DragonPhaseState): Vector3 => {
  switch (phase) {
    case DragonPhase.Circling:
      return computeCirclingVelocity(
        input.portalPosition,
        state.circlingRadius,
        state.circlingHeight,
        state.circlingAngle,
        0.8,
      )
    case DragonPhase.Strafing:
      return input.playerPosition === null ? zero : computeStrafingVelocity(input.dragonPosition, input.playerPosition, 0.8)
    case DragonPhase.Landing:
      return computeLandingVelocity(input.dragonPosition, input.portalPosition, 0.8)
    case DragonPhase.Takeoff:
      return computeTakeoffVelocity(input.dragonPosition, 0.8)
    case DragonPhase.Perched:
    case DragonPhase.DeathSequence:
      return zero
  }
}

export const tickDragonPhase = (state: DragonPhaseState, input: DragonPhaseInput): DragonPhaseStep => {
  const nextPhase = resolveNextPhase(state, input)
  const samePhase = nextPhase === state.phase
  const phaseTimer = samePhase ? state.phaseTimer + 1 : 0
  const circlingAngle = nextPhase === DragonPhase.Circling && samePhase
    ? state.circlingAngle + CIRCLING_ANGLE_STEP
    : state.circlingAngle
  const nextState: DragonPhaseState = {
    ...state,
    phase: nextPhase,
    phaseTimer,
    phaseProgress: progressFor(nextPhase, phaseTimer),
    perchPosition: nextPhase === DragonPhase.Perched ? input.portalPosition : state.perchPosition,
    circlingAngle,
  }
  const distanceToPlayer = input.playerPosition === null ? Number.POSITIVE_INFINITY : distance(input.dragonPosition, input.playerPosition)

  return {
    nextState,
    intent: {
      newPhase: nextPhase,
      newVelocity: velocityFor(nextPhase, input, nextState),
      wantsBreathAttack: shouldUseBreathAttack(nextPhase, distanceToPlayer, input.randomValue),
      healsFromCrystals: nextPhase !== DragonPhase.DeathSequence,
      damageMultiplier: dragonDamageMultiplier(nextPhase),
    },
  }
}
