import { Effect } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { makeColumnReaderAt, type PhysicsColumnReadError } from '../physics-stage-utils'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import { EYE_LEVEL_OFFSET } from '@ts-minecraft/app/frame-handler.config'
import { FOOTSTEP_GROUND_SAMPLE_OFFSET } from './footstep-sound-logic'
import { applySurvivalAirEffects } from './environment-air'
import { applySurvivalFootstepEffects } from './environment-footstep'
import { applySurvivalHazardEffects } from './environment-hazards'
import type { ApplyPlayerDamage, SurvivalMovementState } from './types'

export const applySurvivalEnvironmentEffects = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  refreshedPos: Position,
  movement: SurvivalMovementState,
  applyDamage: ApplyPlayerDamage,
): Effect.Effect<void, PhysicsColumnReadError> =>
  makeColumnReaderAt(services.chunkManagerService, refreshedPos).pipe(
    Effect.flatMap((columnBlockAt) => {
      const feetBlock = columnBlockAt(refreshedPos.y)
      const groundBlock = columnBlockAt(refreshedPos.y - FOOTSTEP_GROUND_SAMPLE_OFFSET)
      const eyeBlock = columnBlockAt(refreshedPos.y + EYE_LEVEL_OFFSET)

      return applySurvivalFootstepEffects(services, refs, refreshedPos, movement, groundBlock).pipe(
        Effect.flatMap(() =>
          applySurvivalHazardEffects(
            services,
            refs,
            inputs,
            refreshedPos,
            movement,
            feetBlock,
            eyeBlock,
            applyDamage,
          ),
        ),
        Effect.flatMap(() =>
          applySurvivalAirEffects(services, refs, inputs, refreshedPos, movement, eyeBlock, applyDamage),
        ),
      )
    }),
  )
