import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { DroppedXpOrbService } from '@ts-minecraft/entity/application/dropped-xp-orb-service';
import { XP_ORB_LIFETIME_TICKS, XP_ORB_PICKUP_DISTANCE } from '@ts-minecraft/entity/domain/dropped-xp-orb';

describe('DroppedXpOrbService', () => {
  const runWithService = <A, E>(effect: Effect.Effect<A, E, DroppedXpOrbService>) =>
    effect.pipe(Effect.provide(DroppedXpOrbService.Default))

  it.effect('spawns XP orbs with deterministic ids and normalized amounts', () =>
    Effect.gen(function* () {
      const service = yield* DroppedXpOrbService

      const first = yield* service.spawn({ amount: 2.8, position: { x: 1, y: 64, z: 1 } })
      const second = yield* service.spawn({ amount: 0, position: { x: 2, y: 64, z: 2 }, pickupDelayTicks: -4 })

      expect(first).toMatchObject({
        id: 'dropped-xp-orb-1',
        amount: 2,
        position: { x: 1, y: 64, z: 1 },
        velocity: { x: 0, y: 0, z: 0 },
        ageTicks: 0,
        pickupDelayTicks: 0,
      })
      expect(second).toMatchObject({
        id: 'dropped-xp-orb-2',
        amount: 1,
        pickupDelayTicks: 0,
      })
      expect(yield* service.getAll()).toHaveLength(2)
    }).pipe(runWithService),
  )

  it.effect('ticks age, pickup delay, and expires old XP orbs', () =>
    Effect.gen(function* () {
      const service = yield* DroppedXpOrbService

      yield* service.spawn({
        amount: 5,
        position: { x: 0, y: 64, z: 0 },
        pickupDelayTicks: 4,
      })

      yield* service.tick(3)
      expect(yield* service.getAll()).toMatchObject([{ ageTicks: 3, pickupDelayTicks: 1 }])

      yield* service.tick(XP_ORB_LIFETIME_TICKS)
      expect(yield* service.getAll()).toEqual([])
    }).pipe(runWithService),
  )

  it.effect('moves XP orbs toward nearby players during ticks', () =>
    Effect.gen(function* () {
      const service = yield* DroppedXpOrbService

      yield* service.spawn({
        amount: 5,
        position: { x: 4, y: 64, z: 0 },
      })

      yield* service.tick(1, { x: 0, y: 64, z: 0 })

      const [orb] = yield* service.getAll()
      expect(orb?.position.x).toBeLessThan(4)
      expect(orb?.position.y).toBe(64)
      expect(orb?.velocity.x).toBeLessThan(0)
    }).pipe(runWithService),
  )

  it.effect('does not attract XP orbs outside attraction range', () =>
    Effect.gen(function* () {
      const service = yield* DroppedXpOrbService

      yield* service.spawn({
        amount: 5,
        position: { x: 12, y: 64, z: 0 },
      })

      yield* service.tick(1, { x: 0, y: 64, z: 0 })

      expect(yield* service.getAll()).toMatchObject([
        {
          position: { x: 12, y: 64, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
        },
      ])
    }).pipe(runWithService),
  )

  it.effect('collects only ready XP orbs within pickup distance', () =>
    Effect.gen(function* () {
      const service = yield* DroppedXpOrbService

      const ready = yield* service.spawn({
        amount: 3,
        position: { x: XP_ORB_PICKUP_DISTANCE - 0.1, y: 64, z: 0 },
      })
      const delayed = yield* service.spawn({
        amount: 7,
        position: { x: 0, y: 64, z: 0 },
        pickupDelayTicks: 2,
      })
      const far = yield* service.spawn({
        amount: 9,
        position: { x: XP_ORB_PICKUP_DISTANCE + 0.1, y: 64, z: 0 },
      })

      const collected = yield* service.collectWithin({ x: 0, y: 64, z: 0 })

      expect(collected).toEqual([ready])
      expect(yield* service.getAll()).toEqual([delayed, far])
    }).pipe(runWithService),
  )

  it.effect('resets XP orbs and deterministic id sequence', () =>
    Effect.gen(function* () {
      const service = yield* DroppedXpOrbService

      yield* service.spawn({ amount: 4, position: { x: 0, y: 64, z: 0 } })
      yield* service.reset()
      const orb = yield* service.spawn({ amount: 6, position: { x: 0, y: 64, z: 0 } })

      expect(yield* service.getAll()).toEqual([orb])
      expect(orb.id).toBe('dropped-xp-orb-1')
    }).pipe(runWithService),
  )
})
