import { Effect, Ref, HashMap, Option } from 'effect'
import type { PlayerId, Position } from '@ts-minecraft/core'
import { zero, identity } from '@ts-minecraft/core'
import type { Vector3 } from '@ts-minecraft/core'
import { PlayerError } from '../domain/errors'
import type { PlayerState } from '../domain/player-state'

export class PlayerService extends Effect.Service<PlayerService>()(
  '@minecraft/application/PlayerService',
  {
    effect: Ref.make(HashMap.empty<PlayerId, PlayerState>()).pipe(Effect.map((playersRef) => {
      const notFound = (id: PlayerId) => new PlayerError({ playerId: id, reason: 'Player not found' })
      return {
        create: (id: PlayerId, position: Position): Effect.Effect<void, PlayerError> =>
          Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] => {
            const exists = Option.isSome(HashMap.get(players, id))
            return exists
              ? [true, players]
              : [false, HashMap.set(players, id, { id, position, velocity: zero, rotation: identity })]
          }).pipe(
            Effect.flatMap((alreadyExists) =>
              alreadyExists
                ? Effect.fail(new PlayerError({ playerId: id, reason: 'Player already exists' }))
                : Effect.void
            )
          ),

        updatePosition: (id: PlayerId, position: Position): Effect.Effect<void, PlayerError> =>
          Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] => {
            const player = Option.getOrNull(HashMap.get(players, id))
            if (!player) return [true, players]
            return [false, HashMap.set(players, id, { ...player, position })]
          }).pipe(
            Effect.flatMap((playerNotFound) =>
              playerNotFound
                ? Effect.fail(notFound(id))
                : Effect.void
            )
          ),

        updateVelocity: (id: PlayerId, velocity: Vector3): Effect.Effect<void, PlayerError> =>
          Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] => {
            const player = Option.getOrNull(HashMap.get(players, id))
            if (!player) return [true, players]
            return [false, HashMap.set(players, id, { ...player, velocity })]
          }).pipe(
            Effect.flatMap((playerNotFound) =>
              playerNotFound
                ? Effect.fail(notFound(id))
                : Effect.void
            )
          ),

        getPosition: (id: PlayerId): Effect.Effect<Position, PlayerError> =>
          Ref.get(playersRef).pipe(
            Effect.flatMap((players) => {
              const player = Option.getOrNull(HashMap.get(players, id))
              return player ? Effect.succeed(player.position) : Effect.fail(notFound(id))
            })
          ),

        getVelocity: (id: PlayerId): Effect.Effect<Vector3, PlayerError> =>
          Ref.get(playersRef).pipe(
            Effect.flatMap((players) => {
              const player = Option.getOrNull(HashMap.get(players, id))
              return player ? Effect.succeed(player.velocity) : Effect.fail(notFound(id))
            })
          ),

        getState: (id: PlayerId): Effect.Effect<PlayerState, PlayerError> =>
          Ref.get(playersRef).pipe(
            Effect.flatMap((players) => {
              const player = Option.getOrNull(HashMap.get(players, id))
              return player ? Effect.succeed(player) : Effect.fail(notFound(id))
            })
          ),
      }
    }))
  }
) {}
export const PlayerServiceLive = PlayerService.Default
