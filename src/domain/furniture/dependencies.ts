// Temporary stub implementations for FurnitureService dependencies
// These should be replaced with actual implementations from other domains

import { Context, Effect, Layer } from 'effect'
import type { PlayerId, Vector3D } from './types'

// EventBus stub
export interface EventBus {
  readonly publish: (event: any) => Effect.Effect<void, never>
  readonly subscribe: (handler: (event: any) => void) => Effect.Effect<void, never>
}

export const EventBus = Context.GenericTag<EventBus>('@minecraft/domain/EventBus')

export const EventBusLive = Layer.succeed(
  EventBus,
  EventBus.of({
    publish: () => Effect.void,
    subscribe: () => Effect.void,
  })
)

// WorldManager stub
export interface WorldManager {
  readonly getBlock: (position: Vector3D) => Effect.Effect<{ type: string; metadata?: any }, never>
  readonly setBlock: (position: Vector3D, block: { type: string; metadata?: any }) => Effect.Effect<void, never>
  readonly getNearbyHostileMobs: (position: Vector3D, radius: number) => Effect.Effect<ReadonlyArray<any>, never>
  readonly isThunderstorm: () => Effect.Effect<boolean, never>
  readonly clearWeather: () => Effect.Effect<void, never>
}

export const WorldManager = Context.GenericTag<WorldManager>('@minecraft/domain/WorldManager')

export const WorldManagerLive = Layer.succeed(
  WorldManager,
  WorldManager.of({
    getBlock: () => Effect.succeed({ type: 'air' }),
    setBlock: () => Effect.void,
    getNearbyHostileMobs: () => Effect.succeed([]),
    isThunderstorm: () => Effect.succeed(false),
    clearWeather: () => Effect.void,
  })
)

// TimeSystem stub
export interface TimeSystem {
  readonly getCurrentTime: () => Effect.Effect<number, never>
  readonly setTime: (time: number) => Effect.Effect<void, never>
}

export const TimeSystem = Context.GenericTag<TimeSystem>('@minecraft/domain/TimeSystem')

export const TimeSystemLive = Layer.succeed(
  TimeSystem,
  TimeSystem.of({
    getCurrentTime: () => Effect.succeed(13000), // Default to night time
    setTime: () => Effect.void,
  })
)

// PlayerManager stub
export interface PlayerManager {
  readonly getOnlinePlayerCount: () => Effect.Effect<number, never>
  readonly setPosition: (playerId: PlayerId, position: Vector3D) => Effect.Effect<void, never>
  readonly setPose: (playerId: PlayerId, pose: string) => Effect.Effect<void, never>
  readonly getPlayerName: (playerId: PlayerId) => Effect.Effect<string, never>
}

export const PlayerManager = Context.GenericTag<PlayerManager>('@minecraft/domain/PlayerManager')

export const PlayerManagerLive = Layer.succeed(
  PlayerManager,
  PlayerManager.of({
    getOnlinePlayerCount: () => Effect.succeed(1),
    setPosition: () => Effect.void,
    setPose: () => Effect.void,
    getPlayerName: (playerId) => Effect.succeed(`Player_${playerId}`),
  })
)
