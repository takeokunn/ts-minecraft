import { Effect, Context, Layer, Queue, Ref, Fiber } from 'effect'
import { GameLoopError } from '@/domain/errors'
import { GameStateService } from './game-state'
import { FPSCounter } from '@/presentation/fps-counter'

/**
 * Frame command type for queue-based game loop
 */
export type FrameCommand = {
  readonly _tag: 'Tick'
  readonly timestamp: number
  readonly deltaTime: number
}

/**
 * Service interface for managing the game loop
 */
export interface GameLoopService {
  readonly start: () => Effect.Effect<void, GameLoopError>
  readonly stop: () => Effect.Effect<void, never>
  readonly isRunning: () => Effect.Effect<boolean, never>
}

/**
 * Context tag for GameLoopService
 */
export const GameLoopService = Context.GenericTag<GameLoopService>('@minecraft/application/GameLoopService')

/**
 * Fixed delta time for Phase 3 (16ms = ~60 FPS)
 */
const FIXED_DELTA_TIME = 0.016

/**
 * Maximum queue capacity for frame commands
 */
const QUEUE_CAPACITY = 60

/**
 * Live implementation of GameLoopService
 *
 * Uses Effect.Queue for frame command processing with a bridge pattern
 * that connects requestAnimationFrame to the Effect-TS ecosystem.
 */
export const GameLoopServiceLive = Layer.effect(
  GameLoopService,
  Effect.gen(function* () {
    const gameStateService = yield* GameStateService
    const fpsCounter = yield* FPSCounter
    const frameQueue = yield* Queue.bounded<FrameCommand>(QUEUE_CAPACITY)
    const runningRef = yield* Ref.make(false)

    // Track resources for cleanup
    let processingFiber: Fiber.RuntimeFiber<void, never> | null = null
    let animationFrameId: number | null = null

    /**
     * Frame processing loop - runs in a separate fiber
     */
    const processFrames = Effect.gen(function* () {
      while (true) {
        const cmd = yield* Queue.take(frameQueue)

        // Update game state with error recovery
        yield* gameStateService.update(cmd.deltaTime).pipe(
          Effect.catchAll((error) =>
            Effect.logError(`Game state update error: ${error}`)
          )
        )

        // Update FPS counter with error recovery
        yield* fpsCounter.tick(cmd.deltaTime).pipe(
          Effect.catchAll(() => Effect.void)
        )
      }
    })

    /**
     * Bridge loop - connects requestAnimationFrame to Effect Queue
     */
    const bridgeLoop = () => {
      const isRunning = Effect.runSync(Ref.get(runningRef))
      if (!isRunning) return

      const now = performance.now()

      // Offer frame command to queue (fire-and-forget with error logging)
      Effect.runPromise(
        Queue.offer(frameQueue, {
          _tag: 'Tick',
          timestamp: now,
          deltaTime: FIXED_DELTA_TIME,
        })
      ).catch((error) => {
        console.error('Failed to offer frame command:', error)
      })

      // Schedule next frame
      animationFrameId = requestAnimationFrame(bridgeLoop)
    }

    return GameLoopService.of({
      start: Effect.gen(function* () {
        const currentlyRunning = yield* Ref.get(runningRef)
        if (currentlyRunning) {
          yield* Effect.fail(
            new GameLoopError('Game loop is already running')
          )
        }

        // Mark as running
        yield* Ref.set(runningRef, true)

        // Fork the processing fiber
        processingFiber = yield* Effect.fork(processFrames)

        // Start the bridge loop
        bridgeLoop()

        yield* Effect.log('Game loop started')
      }),

      stop: Effect.gen(function* () {
        yield* Ref.set(runningRef, false)

        // Cancel animation frame
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }

        // Interrupt processing fiber
        if (processingFiber !== null) {
          yield* Fiber.interrupt(processingFiber)
          processingFiber = null
        }

        // Shutdown the queue
        yield* Queue.shutdown(frameQueue)

        yield* Effect.log('Game loop stopped')
      }),

      isRunning: () => Ref.get(runningRef),
    })
  })
)
