import { Effect, Context, Layer, Ref, Schema, Clock } from 'effect'
import { PlayerService, PlayerError } from '@/domain'
import { WorldService, WorldError } from '@/domain'
import { PlayerId, Position } from '@/shared/kernel'
import { BlockType } from '@/domain'

/**
 * Schema for TimingState representing frame timing information
 */
export const TimingStateSchema = Schema.Struct({
  lastFrameTime: Schema.Number,
  deltaTime: Schema.Number,
  frameCount: Schema.Number,
})

/**
 * Timing state interface for tracking frame timing
 */
export interface TimingState {
  readonly lastFrameTime: number
  readonly deltaTime: number
  readonly frameCount: number
}

/**
 * Service interface for coordinating game state across services
 */
export interface GameStateService {
  readonly update: (deltaTime: number) => Effect.Effect<void, never>
  readonly getTiming: () => Effect.Effect<TimingState, never>
  readonly getPlayerPosition: (playerId: PlayerId) => Effect.Effect<Position, PlayerError>
  readonly getWorldBlocks: (worldId: string, min: Position, max: Position) => Effect.Effect<ReadonlyArray<[Position, BlockType]>, WorldError>
}

/**
 * Context tag for GameStateService
 */
export const GameStateService = Context.GenericTag<GameStateService>('@minecraft/application/GameStateService')

/**
 * Live implementation of GameStateService
 *
 * Coordinates between PlayerService and WorldService while managing
 * its own timing state using service-specific Refs.
 */
export const GameStateServiceLive = Layer.effect(
  GameStateService,
  Effect.gen(function* () {
    const playerService = yield* PlayerService
    const worldService = yield* WorldService
    const timingStateRef = yield* Ref.make<TimingState>({
      lastFrameTime: 0,
      deltaTime: 0,
      frameCount: 0,
    })

    return GameStateService.of({
      update: (deltaTime) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          yield* Ref.update(timingStateRef, (state) => ({
            lastFrameTime: now,
            deltaTime,
            frameCount: state.frameCount + 1,
          }))
        }),

      getTiming: () => Ref.get(timingStateRef),

      getPlayerPosition: (playerId) => playerService.getPosition(playerId),

      getWorldBlocks: (worldId, min, max) => worldService.getBlocksInArea(worldId, min, max),
    })
  })
)
