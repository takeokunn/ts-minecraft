import { Effect } from 'effect'
import { isTransparent } from '@ts-minecraft/block/domain/light'
import { CHUNK_HEIGHT, PLAYER_HALF_HEIGHT, PLAYER_HALF_WIDTH, type BlockType, type Position } from '@ts-minecraft/core'
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

const CACTUS_CONTACT_EPSILON = 0.02

export const isPositionExposedToSky = (
  columnBlockAt: (worldY: number) => BlockType | null,
  fromWorldY: number,
): boolean => {
  for (let y = Math.floor(fromWorldY) + 1; y < CHUNK_HEIGHT; y += 1) {
    const blockType = columnBlockAt(y)
    if (blockType !== null && !isTransparent(blockType)) {
      return false
    }
  }

  return true
}

const hasCactusContactAt = (
  services: PhysicsStageServices,
  position: Position,
): Effect.Effect<boolean, PhysicsColumnReadError> =>
  makeColumnReaderAt(services.chunkManagerService, position).pipe(
    Effect.map((columnBlockAt) => {
      const lowerBodyBlock = columnBlockAt(position.y - PLAYER_HALF_HEIGHT + CACTUS_CONTACT_EPSILON)
      const midBodyBlock = columnBlockAt(position.y)
      const upperBodyBlock = columnBlockAt(position.y + PLAYER_HALF_HEIGHT - CACTUS_CONTACT_EPSILON)
      return lowerBodyBlock === 'CACTUS' || midBodyBlock === 'CACTUS' || upperBodyBlock === 'CACTUS'
    }),
  )

const detectCactusContact = (
  services: PhysicsStageServices,
  refreshedPos: Position,
  feetBlock: BlockType | null,
  eyeBlock: BlockType | null,
): Effect.Effect<boolean, PhysicsColumnReadError> => {
  if (feetBlock === 'CACTUS' || eyeBlock === 'CACTUS') {
    return Effect.succeed(true)
  }

  const sampleDistance = PLAYER_HALF_WIDTH + CACTUS_CONTACT_EPSILON
  const samplePositions: readonly Position[] = [
    { x: refreshedPos.x + sampleDistance, y: refreshedPos.y, z: refreshedPos.z },
    { x: refreshedPos.x - sampleDistance, y: refreshedPos.y, z: refreshedPos.z },
    { x: refreshedPos.x, y: refreshedPos.y, z: refreshedPos.z + sampleDistance },
    { x: refreshedPos.x, y: refreshedPos.y, z: refreshedPos.z - sampleDistance },
  ]

  return Effect.reduce(samplePositions, false, (foundCactus, samplePosition) =>
    foundCactus
      ? Effect.succeed(true)
      : hasCactusContactAt(services, samplePosition),
  )
}

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
      const exposedToSky = isPositionExposedToSky(columnBlockAt, refreshedPos.y + PLAYER_HALF_HEIGHT)

      return applySurvivalFootstepEffects(services, refs, refreshedPos, movement, groundBlock).pipe(
        Effect.flatMap(() => detectCactusContact(services, refreshedPos, feetBlock, eyeBlock)),
        Effect.flatMap((touchingCactus) =>
          services.weatherService.getWeather().pipe(
            Effect.flatMap((weather) =>
              applySurvivalHazardEffects(
                services,
                refs,
                inputs,
                refreshedPos,
                movement,
                feetBlock,
                eyeBlock,
                touchingCactus,
                weather === 'thunder' && exposedToSky,
                applyDamage,
              ),
            ),
          ),
        ),
        Effect.flatMap(() =>
          applySurvivalAirEffects(services, refs, inputs, refreshedPos, movement, eyeBlock, applyDamage),
        ),
      )
    }),
  )
