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
  // Mob vocalizations (tone-synth only). Kept clearly distinct from the player's
  // own cues: entityHit (player swing landing, 280Hz square) and playerHurt
  // (140Hz sawtooth). mobHurt is a short mid pained chirp; mobDeath is a longer,
  // lower descending-feel groan — both sawtooth so they read as "creature" not
  // "block". Only player-kills vocalize (burn/environmental deaths stay silent).
  mobHurt: { frequency: 200, durationMs: 110, wave: 'sawtooth' as OscillatorWave, baseGain: 0.42 },
  mobDeath: { frequency: 90, durationMs: 220, wave: 'sawtooth' as OscillatorWave, baseGain: 0.5 },
  // Enchanting confirmation: a bright, longer triangle chime — reads as "magical
  // success", clearly distinct from the dull blockPlace tick it replaces.
  enchant: { frequency: 660, durationMs: 200, wave: 'triangle' as OscillatorWave, baseGain: 0.34 },
} satisfies Record<string, SoundDefinition>

export const DEFAULT_LISTENER_POSITION = { x: 0, y: 64, z: 0 }
