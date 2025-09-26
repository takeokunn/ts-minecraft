import { Context, Effect, Stream } from 'effect'
import type { Vector3D } from '../../shared/types/spatial-brands.js'
import type {
  AudioDistance,
  AudioError,
  AudioEvent,
  AudioLoadError,
  Pitch,
  PlayOptions,
  Quaternion,
  SoundCategory,
  SoundId,
  SourceId,
  SourceNotFoundError,
  Volume,
} from './AudioTypes.js'

/**
 * AudioService Interface
 * Manages 3D spatial audio, sound playback, and volume control
 */
export interface AudioService {
  /**
   * Play a sound in 3D space
   */
  readonly playSound3D: (
    sound: SoundId,
    position: Vector3D,
    options?: Partial<PlayOptions>
  ) => Effect.Effect<SourceId, AudioError>

  /**
   * Play a sound in 2D (no spatial positioning)
   */
  readonly playSound2D: (
    sound: SoundId,
    options?: Partial<PlayOptions>
  ) => Effect.Effect<SourceId, AudioError>

  /**
   * Stop a playing sound
   */
  readonly stopSound: (sourceId: SourceId) => Effect.Effect<void, SourceNotFoundError>

  /**
   * Stop all sounds
   */
  readonly stopAllSounds: () => Effect.Effect<void>

  /**
   * Update the audio listener position and orientation
   */
  readonly updateListener: (
    position: Vector3D,
    orientation: Quaternion
  ) => Effect.Effect<void>

  /**
   * Set the volume for a sound category
   */
  readonly setVolume: (category: SoundCategory, volume: Volume) => Effect.Effect<void>

  /**
   * Get the current volume for a category
   */
  readonly getVolume: (category: SoundCategory) => Effect.Effect<Volume>

  /**
   * Preload sounds into memory
   */
  readonly preloadSounds: (soundIds: ReadonlyArray<SoundId>) => Effect.Effect<void, AudioLoadError>

  /**
   * Get a stream of audio events
   */
  readonly events: Stream.Stream<AudioEvent>

  /**
   * Fade in a sound
   */
  readonly fadeIn: (
    sourceId: SourceId,
    targetVolume: Volume,
    duration: number
  ) => Effect.Effect<void, SourceNotFoundError>

  /**
   * Fade out a sound
   */
  readonly fadeOut: (
    sourceId: SourceId,
    duration: number
  ) => Effect.Effect<void, SourceNotFoundError>

  /**
   * Check if a sound is currently playing
   */
  readonly isPlaying: (sourceId: SourceId) => Effect.Effect<boolean>

  /**
   * Get the number of active sound sources
   */
  readonly getActiveSoundCount: () => Effect.Effect<number>

  /**
   * Set the global doppler factor for velocity-based pitch shifting
   */
  readonly setDopplerFactor: (factor: number) => Effect.Effect<void>

  /**
   * Pause a sound
   */
  readonly pauseSound: (sourceId: SourceId) => Effect.Effect<void, SourceNotFoundError>

  /**
   * Resume a paused sound
   */
  readonly resumeSound: (sourceId: SourceId) => Effect.Effect<void, SourceNotFoundError>

  /**
   * Set the pitch of a playing sound
   */
  readonly setPitch: (sourceId: SourceId, pitch: Pitch) => Effect.Effect<void, SourceNotFoundError>

  /**
   * Update the position of a 3D sound source
   */
  readonly updateSourcePosition: (
    sourceId: SourceId,
    position: Vector3D
  ) => Effect.Effect<void, SourceNotFoundError>
}

/**
 * AudioService Context Tag
 */
export const AudioService = Context.GenericTag<AudioService>('@minecraft/AudioService')