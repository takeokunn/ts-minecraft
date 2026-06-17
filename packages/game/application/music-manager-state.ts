import * as Option from 'effect/Option'
import type { ToneHandle } from '../domain/audio-types'
import type { MusicEnvironment } from './music-manager.types'

export type ActiveTrack = {
  readonly environment: MusicEnvironment
  readonly handle: ToneHandle
}

export type MusicPlaybackPlan = {
  readonly shouldStopActiveTrack: boolean
  readonly environmentToPlay: Option.Option<MusicEnvironment>
}

type ResolveMusicPlaybackPlanArgs = {
  readonly enabled: boolean
  readonly activeTrack: Option.Option<ActiveTrack>
  readonly environment: MusicEnvironment
}

export const resolveMusicPlaybackPlan = (
  args: ResolveMusicPlaybackPlanArgs,
): MusicPlaybackPlan => {
  if (!args.enabled) {
    return {
      shouldStopActiveTrack: Option.isSome(args.activeTrack),
      environmentToPlay: Option.none(),
    }
  }

  const currentTrack = Option.getOrNull(args.activeTrack)
  if (currentTrack !== null && currentTrack.environment === args.environment) {
    return {
      shouldStopActiveTrack: false,
      environmentToPlay: Option.none(),
    }
  }

  return {
    shouldStopActiveTrack: Option.isSome(args.activeTrack),
    environmentToPlay: Option.some(args.environment),
  }
}
