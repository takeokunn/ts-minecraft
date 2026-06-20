import { Effect } from 'effect'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { FrameFlintAndSteelInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/flint-and-steel'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { readBlockTypeAt, markChunkDirtyAt } from './interaction-block-access'
import { adjacentToHit } from './placement-geometry'

export const handleFireIgnition = (
  services: FrameFlintAndSteelInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  hit: TargetRayHit,
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const ignitionPos = adjacentToHit(hit)
    const current = yield* readBlockTypeAt(services.chunkManagerService, ignitionPos).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (current !== 'AIR') return false

    const placed = yield* services.blockService.forceSetBlock(ignitionPos, 'FIRE').pipe(
      Effect.map(() => true),
      Effect.catchAll(() => Effect.succeed(false)),
    )
    if (!placed) return false

    yield* markChunkDirtyAt(services.chunkManagerService, refs.dirtyChunksRef, ignitionPos)
    yield* services.soundManager.playEffect('blockPlace', { position: ignitionPos })
    return true
  })
