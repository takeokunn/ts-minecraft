import { Effect } from 'effect'

import { AudioEnginePort } from '../domain/audio-engine-port'

import { createMusicManagerRuntime } from './music-manager-runtime'
import type { MusicEnvironment, MusicSettings } from './music-manager.types'

export type { MusicEnvironment, MusicSettings }
export { MusicEnvironmentSchema, MusicSettingsSchema } from './music-manager.types'

export class MusicManager extends Effect.Service<MusicManager>()(
  '@minecraft/audio/MusicManager',
  {
    effect: Effect.gen(function* () {
      const audioEngine = yield* AudioEnginePort
      return yield* createMusicManagerRuntime(audioEngine)
    }),
  },
) {}
