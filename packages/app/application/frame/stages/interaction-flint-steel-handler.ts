import { Effect, Option } from 'effect'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { FrameFlintAndSteelInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/flint-and-steel'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { buildTntBreakPositions } from './placement-geometry'
import { readBlockTypeAt } from './interaction-block-access'
import { applyTntPlayerDamage } from './interaction-flint-steel-tnt'
import { handlePortalIgnition } from './interaction-flint-steel-portal'
import { handleFireIgnition } from './interaction-flint-steel-fire'
import { selectedHotbarSlotIndex } from './selected-hotbar-slot'

const TNT_BREAK_RADIUS = 4

const damageHeldFlintAndSteel = (services: FrameFlintAndSteelInteractionServices): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const selectedSlot = yield* services.hotbarService.getSelectedSlot().pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (selectedSlot === null) return
    yield* services.inventoryService
      .damageSlot(selectedHotbarSlotIndex(selectedSlot), 1)
      .pipe(Effect.catchAllCause(() => Effect.void))
  })

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
      const portalIgnited = yield* handlePortalIgnition(services, refs, hit)
      if (portalIgnited) {
        yield* damageHeldFlintAndSteel(services)
        return true
      }
      const fireIgnited = yield* handleFireIgnition(services, refs, hit)
      if (fireIgnited) yield* damageHeldFlintAndSteel(services)
      return fireIgnited
    }

    yield* services.blockService.forceSetBlock(tntPos, 'AIR').pipe(Effect.catchAll(() => Effect.void))
    yield* services.soundManager.playEffect('blockBreak', { position: tntPos })
    for (const pos of buildTntBreakPositions(tntPos, TNT_BREAK_RADIUS)) {
      yield* services.blockService.forceSetBlock(pos, 'AIR').pipe(Effect.catchAll(() => Effect.void))
    }
    yield* applyTntPlayerDamage(services, tntPos)
    yield* damageHeldFlintAndSteel(services)
    return true
  })
