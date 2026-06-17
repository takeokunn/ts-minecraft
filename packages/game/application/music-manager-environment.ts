import type { Position } from '@ts-minecraft/core'
import type { MusicEnvironment } from './music-manager.types'

export type MusicEnvironmentContext = {
  readonly isNight: boolean
  readonly playerPosition: Position
  readonly caveThresholdY: number
}

export const resolveMusicEnvironment = (
  context: MusicEnvironmentContext,
): MusicEnvironment => {
  if (context.playerPosition.y < context.caveThresholdY) return 'cave'
  return context.isNight ? 'night' : 'day'
}
