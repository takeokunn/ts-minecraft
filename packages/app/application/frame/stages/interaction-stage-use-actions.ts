import { Effect, Option } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { TargetBlockHit, TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import type {
  InteractionStageIntent,
} from '@ts-minecraft/app/frame/stages/interaction-stage-intent'
import type { InteractionStageSnapshot } from '@ts-minecraft/app/frame/stages/interaction-stage-snapshot'
import { pistonFacingFromCamera } from '@ts-minecraft/app/frame/stages/interaction-redstone-handler'
import { runInteractionStageUseStateActions } from '@ts-minecraft/app/frame/stages/interaction-stage-use-state-actions'
import { runInteractionStageUseTargetActions } from '@ts-minecraft/app/frame/stages/interaction-stage-use-target-actions'
import * as THREE from 'three'

// Module scratch for the piston-facing lookup (frame loop is single-fiber).
const _pistonFacingScratch = new THREE.Vector3()

export const runInteractionStageUseActions = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'respawnPositionRef'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'soundManager'
    | 'hotbarService'
    | 'chestService'
    | 'furnaceService'
    | 'timeService'
    | 'netherService'
    | 'inventoryService'
    | 'inventoryRenderer' | 'sleepOverlay'
    | 'xpService'
    | 'multiplayer'
    | 'entityManager'
    | 'equipmentService'
    | 'fishingService'
    | 'hungerService'
    | 'healthService'
    | 'gameState'
    | 'cropGrowthService'
    | 'fluidService'
    | 'redstoneService'
    | 'gameMode'
    | 'particleSystem'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef' | 'isShieldBlockingRef' | 'bowChargeStartRef'>,
  context: {
    readonly snapshot: InteractionStageSnapshot
    readonly intent: InteractionStageIntent
    readonly targetBlock: Option.Option<TargetBlockHit>
    readonly targetHit: Option.Option<TargetRayHit>
  },
  ): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    yield* runInteractionStageUseStateActions(services, refs, {
      snapshot: context.snapshot,
      intent: context.intent,
      targetBlock: context.targetBlock,
      // Compute the view cardinal only when a piston is actually being placed —
      // getWorldDirection costs a matrix decompose.
      ...(context.snapshot.redstoneFlags.placePiston || context.snapshot.redstoneFlags.placeObserver || context.snapshot.redstoneFlags.placeRepeater || context.snapshot.redstoneFlags.placeComparator || context.snapshot.redstoneFlags.placeDispenser
        ? { pistonFacing: pistonFacingFromCamera(deps.camera, _pistonFacingScratch) }
        : {}),
    })

    yield* runInteractionStageUseTargetActions(deps, services, refs, {
      snapshot: context.snapshot,
      intent: context.intent,
      targetHit: context.targetHit,
    })
  })
