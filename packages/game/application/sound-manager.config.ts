import type { OscillatorWave } from '../domain/audio-types'

type SoundDefinition = {
  readonly frequency: number
  readonly durationMs: number
  readonly wave: OscillatorWave
  readonly baseGain: number
}

export const SOUND_LIBRARY = {
  blockBreak: { frequency: 220, durationMs: 70, wave: 'square' as OscillatorWave, baseGain: 0.4 },
  blockPlace: { frequency: 320, durationMs: 50, wave: 'triangle' as OscillatorWave, baseGain: 0.32 },
  playerHurt: { frequency: 140, durationMs: 120, wave: 'sawtooth' as OscillatorWave, baseGain: 0.5 },
  entityHit: { frequency: 280, durationMs: 90, wave: 'square' as OscillatorWave, baseGain: 0.38 },
} satisfies Record<string, SoundDefinition>

export const DEFAULT_LISTENER_POSITION = { x: 0, y: 64, z: 0 }
