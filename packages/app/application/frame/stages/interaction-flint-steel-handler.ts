import { Effect, Option } from 'effect'
import type { FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { FrameFlintAndSteelInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { buildTntBreakPositions } from './placement-geometry'
import { readBlockTypeAt } from './interaction-block-access'
import { applyTntPlayerDamage } from './interaction-flint-steel-tnt'
import { handlePortalIgnition } from './interaction-flint-steel-portal'

const TNT_BREAK_RADIUS = 4

export const handleFlintAndSteel = (
  services: FrameFlintAndSteelInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const hit = Option.getOrNull(context.targetHit)
    if (hit === null) return false
    const tntPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
    const blockType = yield* readBlockTypeAt(services.chunkManagerService, tntPos).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (blockType !== 'TNT') {
      return yield* handlePortalIgnition(services, refs, hit)
    }

    yield* services.blockService.forceSetBlock(tntPos, 'AIR').pipe(Effect.catchAll(() => Effect.void))
    yield* services.soundManager.playEffect('blockBreak', { position: tntPos })
    for (const pos of buildTntBreakPositions(tntPos, TNT_BREAK_RADIUS)) {
      yield* services.blockService.forceSetBlock(pos, 'AIR').pipe(Effect.catchAll(() => Effect.void))
    }
    yield* applyTntPlayerDamage(services, tntPos)
    return true
  })
