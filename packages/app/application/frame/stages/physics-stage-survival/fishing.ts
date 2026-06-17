import { Effect, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { PhysicsStageServices } from '../physics-stage-types/services'

export const handleFishingCatch = (
  services: Pick<PhysicsStageServices, 'fishingService' | 'inventoryService' | 'soundManager'>,
  position: Position,
  deltaSecs: number,
): Effect.Effect<void, never> =>
  services.fishingService.tick(deltaSecs).pipe(
    Effect.flatMap((caught) => {
      const caughtBlock = Option.getOrNull(caught)
      if (caughtBlock === null) {
        return Effect.void
      }

      return services.inventoryService.addBlock(caughtBlock, 1).pipe(
        Effect.catchAll(() => Effect.void),
        Effect.flatMap(() => services.soundManager.playEffect('blockPlace', { position })),
      )
    }),
  )
