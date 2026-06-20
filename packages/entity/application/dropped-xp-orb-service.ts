import { Effect, Ref } from 'effect'

import {
  XP_ORB_ATTRACTION_ACCELERATION_PER_TICK,
  XP_ORB_ATTRACTION_DISTANCE_SQUARED,
  XP_ORB_LIFETIME_TICKS,
  XP_ORB_MAX_SPEED_PER_TICK,
  XP_ORB_VELOCITY_DAMPING_PER_TICK,
  type DroppedXpOrbEntity,
  type DroppedXpOrbPosition,
} from '../domain/dropped-xp-orb'
import { isWithinXpOrbPickupDistance } from '../domain/dropped-xp-orb-resolution'

const ZERO_VELOCITY: DroppedXpOrbPosition = { x: 0, y: 0, z: 0 }

const normalizeAmount = (amount: number): number => Math.max(1, Math.floor(amount))
const normalizeTicks = (ticks: number): number => Math.max(0, Math.floor(ticks))

const clampVelocity = (velocity: DroppedXpOrbPosition): DroppedXpOrbPosition => {
  const speedSquared = velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z
  const maxSpeedSquared = XP_ORB_MAX_SPEED_PER_TICK * XP_ORB_MAX_SPEED_PER_TICK
  if (speedSquared <= maxSpeedSquared || speedSquared === 0) return velocity

  const scale = XP_ORB_MAX_SPEED_PER_TICK / Math.sqrt(speedSquared)
  return {
    x: velocity.x * scale,
    y: velocity.y * scale,
    z: velocity.z * scale,
  }
}

const applyAttraction = (
  orb: DroppedXpOrbEntity,
  playerPosition: DroppedXpOrbPosition | undefined,
  deltaTicks: number,
): DroppedXpOrbPosition => {
  if (playerPosition === undefined || deltaTicks <= 0) return orb.velocity

  const dx = playerPosition.x - orb.position.x
  const dy = playerPosition.y - orb.position.y
  const dz = playerPosition.z - orb.position.z
  const distanceSquared = dx * dx + dy * dy + dz * dz
  if (distanceSquared === 0 || distanceSquared > XP_ORB_ATTRACTION_DISTANCE_SQUARED) {
    return orb.velocity
  }

  const distance = Math.sqrt(distanceSquared)
  const acceleration = XP_ORB_ATTRACTION_ACCELERATION_PER_TICK * deltaTicks
  return clampVelocity({
    x: orb.velocity.x + (dx / distance) * acceleration,
    y: orb.velocity.y + (dy / distance) * acceleration,
    z: orb.velocity.z + (dz / distance) * acceleration,
  })
}

const integrateOrb = (
  orb: DroppedXpOrbEntity,
  playerPosition: DroppedXpOrbPosition | undefined,
  deltaTicks: number,
): DroppedXpOrbEntity => {
  if (deltaTicks <= 0) return orb

  const attractedVelocity = applyAttraction(orb, playerPosition, deltaTicks)
  const damping = Math.pow(XP_ORB_VELOCITY_DAMPING_PER_TICK, deltaTicks)

  return {
    ...orb,
    position: {
      x: orb.position.x + attractedVelocity.x * deltaTicks,
      y: orb.position.y + attractedVelocity.y * deltaTicks,
      z: orb.position.z + attractedVelocity.z * deltaTicks,
    },
    velocity: {
      x: attractedVelocity.x * damping,
      y: attractedVelocity.y * damping,
      z: attractedVelocity.z * damping,
    },
    ageTicks: normalizeTicks(orb.ageTicks + deltaTicks),
    pickupDelayTicks: normalizeTicks(orb.pickupDelayTicks - deltaTicks),
  }
}

export type DroppedXpOrbSpawnInput = {
  readonly amount: number
  readonly position: DroppedXpOrbPosition
  readonly velocity?: DroppedXpOrbPosition
  readonly pickupDelayTicks?: number
}

export class DroppedXpOrbService extends Effect.Service<DroppedXpOrbService>()(
  '@minecraft/application/DroppedXpOrbService',
  {
    effect: Effect.gen(function* () {
      const orbsRef = yield* Ref.make<readonly DroppedXpOrbEntity[]>([])
      const nextIdRef = yield* Ref.make(0)

      const spawn = (input: DroppedXpOrbSpawnInput) =>
        Effect.gen(function* () {
          const sequence = yield* Ref.updateAndGet(nextIdRef, (value) => value + 1)
          const orb: DroppedXpOrbEntity = {
            id: `dropped-xp-orb-${sequence}`,
            amount: normalizeAmount(input.amount),
            position: input.position,
            velocity: input.velocity ?? ZERO_VELOCITY,
            ageTicks: 0,
            pickupDelayTicks: normalizeTicks(input.pickupDelayTicks ?? 0),
          }

          yield* Ref.update(orbsRef, (orbs) => [...orbs, orb])
          return orb
        })

      const getAll = () => Ref.get(orbsRef)

      const tick = (ageDeltaTicks = 1, playerPosition?: DroppedXpOrbPosition) =>
        Ref.update(orbsRef, (orbs) => {
          const deltaTicks = normalizeTicks(ageDeltaTicks)
          return orbs
            .map((orb) => integrateOrb(orb, playerPosition, deltaTicks))
            .filter((orb) => orb.ageTicks < XP_ORB_LIFETIME_TICKS)
        })

      const collectWithin = (playerPosition: DroppedXpOrbPosition) =>
        Effect.gen(function* () {
          const orbs = yield* Ref.get(orbsRef)
          const collected = orbs.filter(
            (orb) => orb.pickupDelayTicks <= 0 && isWithinXpOrbPickupDistance(playerPosition, orb.position),
          )
          if (collected.length === 0) return collected

          const collectedIds = new Set(collected.map((orb) => orb.id))
          yield* Ref.update(orbsRef, (current) => current.filter((orb) => !collectedIds.has(orb.id)))
          return collected
        })

      const reset = () =>
        Effect.all([Ref.set(orbsRef, []), Ref.set(nextIdRef, 0)], {
          discard: true,
        })

      return {
        spawn,
        getAll,
        tick,
        collectWithin,
        reset,
      } as const
    }),
  },
) {}
