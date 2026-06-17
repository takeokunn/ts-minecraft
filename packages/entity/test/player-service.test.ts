import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect } from 'vitest'
import { PlayerService } from '../application/player-service'
import { PlayerId, DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'

// ─── Test helpers ─────────────────────────────────────────────────────────────

const withPlayerService = <A>(
  f: (ps: PlayerService) => Effect.Effect<A, never>,
): Effect.Effect<A, never, never> =>
  Effect.gen(function* () {
    const ps = yield* PlayerService
    return yield* f(ps)
  }).pipe(Effect.provide(PlayerService.Default))

const P1 = DEFAULT_PLAYER_ID
const P2 = PlayerId.make('player-2')

const pos = (x: number, y: number, z: number): Position => ({ x, y, z })
const vel = (x: number, y: number, z: number) => ({ x, y, z })

// ─── create ───────────────────────────────────────────────────────────────────

describe('PlayerService — create', () => {
  it.effect('creates a player at the given position', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        yield* ps.create(P1, pos(10, 64, -5))
        const p = yield* ps.getPosition(P1)
        expect(p).toEqual(pos(10, 64, -5))
      })
    )
  )

  it.effect('newly created player has zero velocity', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        yield* ps.create(P1, pos(0, 64, 0))
        const v = yield* ps.getVelocity(P1)
        expect(v).toEqual({ x: 0, y: 0, z: 0 })
      })
    )
  )

  it.effect('creating the same player twice fails with PlayerError', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        yield* ps.create(P1, pos(0, 64, 0))
        const result = yield* ps.create(P1, pos(1, 64, 1)).pipe(Effect.either)
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('PlayerError')
          expect(result.left.reason).toMatch(/already exists/)
        }
      })
    )
  )

  it.effect('multiple distinct players can coexist', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        yield* ps.create(P1, pos(0, 64, 0))
        yield* ps.create(P2, pos(100, 64, 100))
        const p1Pos = yield* ps.getPosition(P1)
        const p2Pos = yield* ps.getPosition(P2)
        expect(p1Pos).toEqual(pos(0, 64, 0))
        expect(p2Pos).toEqual(pos(100, 64, 100))
      })
    )
  )
})

// ─── updatePosition ───────────────────────────────────────────────────────────

describe('PlayerService — updatePosition', () => {
  it.effect('updates position of an existing player', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        yield* ps.create(P1, pos(0, 64, 0))
        yield* ps.updatePosition(P1, pos(5, 65, -3))
        const p = yield* ps.getPosition(P1)
        expect(p).toEqual(pos(5, 65, -3))
      })
    )
  )

  it.effect('updating position of unknown player fails with PlayerError', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        const result = yield* ps.updatePosition(P1, pos(0, 64, 0)).pipe(Effect.either)
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') expect(result.left._tag).toBe('PlayerError')
      })
    )
  )

  it.effect('updating one player does not affect another', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        yield* ps.create(P1, pos(0, 64, 0))
        yield* ps.create(P2, pos(10, 64, 10))
        yield* ps.updatePosition(P1, pos(99, 64, 99))
        const p2Pos = yield* ps.getPosition(P2)
        expect(p2Pos).toEqual(pos(10, 64, 10))
      })
    )
  )
})

// ─── updateVelocity ───────────────────────────────────────────────────────────

describe('PlayerService — updateVelocity', () => {
  it.effect('updates velocity of an existing player', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        yield* ps.create(P1, pos(0, 64, 0))
        yield* ps.updateVelocity(P1, vel(3, -9.8, 0))
        const v = yield* ps.getVelocity(P1)
        expect(v).toEqual(vel(3, -9.8, 0))
      })
    )
  )

  it.effect('updating velocity of unknown player fails with PlayerError', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        const result = yield* ps.updateVelocity(P1, vel(0, 0, 0)).pipe(Effect.either)
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') expect(result.left._tag).toBe('PlayerError')
      })
    )
  )
})

// ─── getPosition / getVelocity ────────────────────────────────────────────────

describe('PlayerService — getPosition / getVelocity', () => {
  it.effect('getPosition fails for unknown player', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        const result = yield* ps.getPosition(P1).pipe(Effect.either)
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('PlayerError')
          expect(result.left.reason).toMatch(/not found/)
        }
      })
    )
  )

  it.effect('getVelocity fails for unknown player', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        const result = yield* ps.getVelocity(P1).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  )
})

// ─── getState ─────────────────────────────────────────────────────────────────

describe('PlayerService — getState', () => {
  it.effect('returns full player state', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        yield* ps.create(P1, pos(3, 70, -2))
        const state = yield* ps.getState(P1)
        expect(state.id).toBe(P1)
        expect(state.position).toEqual(pos(3, 70, -2))
        expect(state.velocity).toEqual({ x: 0, y: 0, z: 0 })
      })
    )
  )

  it.effect('state reflects velocity after update', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        yield* ps.create(P1, pos(0, 64, 0))
        yield* ps.updateVelocity(P1, vel(1, 2, 3))
        const state = yield* ps.getState(P1)
        expect(state.velocity).toEqual(vel(1, 2, 3))
      })
    )
  )

  it.effect('getState fails for unknown player', () =>
    withPlayerService((ps) =>
      Effect.gen(function* () {
        const result = yield* ps.getState(P1).pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  )
})
