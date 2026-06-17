import type { Position, Vector3 } from '@ts-minecraft/core'
import { isEndermanProvokedByLook } from '../../domain/mob/enderman-anger'

type EndermanProvocationInput = {
  readonly isEnderman: boolean
  readonly isProvoked: boolean
  readonly playerLookOrigin: Position
  readonly playerLookDirection: Vector3 | undefined
  readonly playerLookBlocked: ((position: Position) => boolean) | undefined
  readonly endermanPosition: Position
  readonly detectionRange: number
}

export const shouldEndermanBecomeProvoked = ({
  isEnderman,
  isProvoked,
  playerLookOrigin,
  playerLookDirection,
  playerLookBlocked,
  endermanPosition,
  detectionRange,
}: EndermanProvocationInput): boolean => {
  if (!isEnderman || isProvoked || playerLookDirection === undefined) {
    return false
  }

  return playerLookBlocked === undefined
    ? isEndermanProvokedByLook({
        playerPosition: playerLookOrigin,
        playerLookDirection,
        endermanPosition,
        detectionRange,
      })
    : isEndermanProvokedByLook({
        playerPosition: playerLookOrigin,
        playerLookDirection,
        endermanPosition,
        detectionRange,
        isSightBlocked: playerLookBlocked,
      })
}
