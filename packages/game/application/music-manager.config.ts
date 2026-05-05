import type { OscillatorWave } from '../domain/audio-types'

type EnvironmentTrack = {
  readonly frequency: number
  readonly wave: OscillatorWave
  readonly baseGain: number
}

export const TRACKS = {
  day: { frequency: 174.61, wave: 'sine' as OscillatorWave, baseGain: 0.28 },
  night: { frequency: 130.81, wave: 'triangle' as OscillatorWave, baseGain: 0.24 },
  cave: { frequency: 98.0, wave: 'sawtooth' as OscillatorWave, baseGain: 0.2 },
} satisfies Record<string, EnvironmentTrack>

export const DEFAULT_CAVE_THRESHOLD_Y = 40
