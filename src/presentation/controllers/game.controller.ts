import { Effect, Context } from 'effect'
import { WorldService } from '@/application/services/world.service'
import { PlayerMovementCommand } from '@/application/commands/player-movement'
import { BlockInteractionCommand } from '@/application/commands/block-interaction'

/**
 * Game Controller
 * メインゲーム機能の制御を担当する薄いコントローラー層
 * ビジネスロジックは含まず、適切なサービスへの委譲のみを行う
 */
export interface GameControllerInterface {
  readonly startGame: () => Effect.Effect<void, never, never>
  readonly pauseGame: () => Effect.Effect<void, never, never>
  readonly resumeGame: () => Effect.Effect<void, never, never>
  readonly handlePlayerInput: (input: PlayerInput) => Effect.Effect<void, never, never>
  readonly handleBlockInteraction: (interaction: BlockInteraction) => Effect.Effect<void, never, never>
}

export interface PlayerInput {
  readonly type: 'movement' | 'action' | 'jump'
  readonly data: Record<string, unknown>
}

export interface BlockInteraction {
  readonly type: 'place' | 'break' | 'interact'
  readonly position: { x: number; y: number; z: number }
  readonly blockType?: string
}

const GameControllerLive = Effect.gen(function* ($) {
  const worldService = yield* $(WorldService)
  const playerMovement = yield* $(PlayerMovementCommand)
  const blockInteraction = yield* $(BlockInteractionCommand)

  const startGame = () =>
    Effect.gen(function* ($) {
      yield* $(worldService.initialize())
      yield* $(Effect.log('Game started'))
    })

  const pauseGame = () =>
    Effect.gen(function* ($) {
      yield* $(worldService.pause())
      yield* $(Effect.log('Game paused'))
    })

  const resumeGame = () =>
    Effect.gen(function* ($) {
      yield* $(worldService.resume())
      yield* $(Effect.log('Game resumed'))
    })

  const handlePlayerInput = (input: PlayerInput) =>
    Effect.gen(function* ($) {
      switch (input.type) {
        case 'movement':
          yield* $(playerMovement.execute(input.data))
          break
        case 'action':
        case 'jump':
          // 他のアクションの処理
          yield* $(Effect.log(`Player input: ${input.type}`))
          break
      }
    })

  const handleBlockInteraction = (interaction: BlockInteraction) =>
    Effect.gen(function* ($) {
      yield* $(blockInteraction.execute({
        type: interaction.type,
        position: interaction.position,
        blockType: interaction.blockType,
      }))
    })

  return {
    startGame,
    pauseGame,
    resumeGame,
    handlePlayerInput,
    handleBlockInteraction,
  }
})

export class GameController extends Context.GenericTag('GameController')<
  GameController,
  GameControllerInterface
>() {
  static readonly Live = GameControllerLive.pipe(Effect.map(GameController.of))
}