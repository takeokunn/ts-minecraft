import { Effect, Context, Layer, Ref, Schema, Option } from 'effect'
import { PlayerIdSchema, PositionSchema, PlayerId, Position } from '@/shared/kernel'
import { PlayerError } from './errors'
import type { Vector3, Quaternion } from '@/shared/math/three'
import { zero, identity } from '@/shared/math/three'

// Vector3 Schema
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type Vector3Type = Schema.Schema.Type<typeof Vector3Schema>

// Quaternion Schema
export const QuaternionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  w: Schema.Number,
})
export type QuaternionType = Schema.Schema.Type<typeof QuaternionSchema>

// PlayerState Schema
export const PlayerStateSchema = Schema.Struct({
  id: PlayerIdSchema,
  position: PositionSchema,
  velocity: Vector3Schema,
  rotation: QuaternionSchema,
})
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>

export interface PlayerService {
  readonly create: (id: PlayerId, position: Position) => Effect.Effect<void, PlayerError>
  readonly updatePosition: (id: PlayerId, position: Position) => Effect.Effect<void, PlayerError>
  readonly getPosition: (id: PlayerId) => Effect.Effect<Position, PlayerError>
  readonly getVelocity: (id: PlayerId) => Effect.Effect<Vector3, PlayerError>
  readonly getState: (id: PlayerId) => Effect.Effect<PlayerState, PlayerError>
}

export const PlayerService = Context.GenericTag<PlayerService>('@minecraft/PlayerService')

export const PlayerServiceLive = Layer.effect(
  PlayerService,
  Effect.gen(function* () {
    const playersRef = yield* Ref.make<Map<PlayerId, PlayerState>>(new Map())

    return PlayerService.of({
      create: (id, position) =>
        Effect.gen(function* () {
          const players = yield* Ref.get(playersRef)
          if (players.has(id)) {
            return yield* Effect.fail(new PlayerError(id, 'Player already exists'))
          }

          const playerState: PlayerState = {
            id,
            position,
            velocity: zero,
            rotation: identity,
          }

          yield* Ref.update(playersRef, (players) => {
            const newMap = new Map(players)
            newMap.set(id, playerState)
            return newMap
          })
        }),

      updatePosition: (id, position) =>
        Effect.gen(function* () {
          const players = yield* Ref.get(playersRef)
          const player = players.get(id)

          if (!player) {
            return yield* Effect.fail(new PlayerError(id, 'Player not found'))
          }

          const updatedPlayer: PlayerState = {
            ...player,
            position,
          }

          yield* Ref.update(playersRef, (players) => {
            const newMap = new Map(players)
            newMap.set(id, updatedPlayer)
            return newMap
          })
        }),

      getPosition: (id) =>
        Effect.gen(function* () {
          const players = yield* Ref.get(playersRef)
          const player = players.get(id)

          if (!player) {
            return yield* Effect.fail(new PlayerError(id, 'Player not found'))
          }

          return player.position
        }),

      getVelocity: (id) =>
        Effect.gen(function* () {
          const players = yield* Ref.get(playersRef)
          const player = players.get(id)

          if (!player) {
            return yield* Effect.fail(new PlayerError(id, 'Player not found'))
          }

          return player.velocity
        }),

      getState: (id) =>
        Effect.gen(function* () {
          const players = yield* Ref.get(playersRef)
          const player = players.get(id)

          if (!player) {
            return yield* Effect.fail(new PlayerError(id, 'Player not found'))
          }

          return player
        }),
    })
  })
)
