import type { MusicManager, SoundManager } from '@ts-minecraft/game'

export type FrameAudioServices = {
  readonly soundManager: SoundManager
  readonly musicManager: MusicManager
}
