import { Vector3Schema } from '@domain/entities/types'
import { Data, pipe, Schema } from 'effect'
// Using string types for PlayerId and BlockTypeId to avoid circular dependencies

// Audio Branded Types
export const Volume = Schema.Number.pipe(
  Schema.between(0, 1),
  Schema.brand('Volume'),
  Schema.annotations({
    title: 'Volume',
    description: 'Audio volume level between 0 and 1',
  })
)
export type Volume = Schema.Schema.Type<typeof Volume>

export const Pitch = Schema.Number.pipe(
  Schema.between(0.5, 2),
  Schema.brand('Pitch'),
  Schema.annotations({
    title: 'Pitch',
    description: 'Audio pitch multiplier between 0.5 and 2',
  })
)
export type Pitch = Schema.Schema.Type<typeof Pitch>

export const AudioDistance = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('AudioDistance'),
  Schema.annotations({
    title: 'AudioDistance',
    description: 'Distance for audio calculations',
  })
)
export type AudioDistance = Schema.Schema.Type<typeof AudioDistance>

export const SoundId = Schema.String.pipe(
  Schema.brand('SoundId'),
  Schema.annotations({
    title: 'SoundId',
    description: 'Unique identifier for a sound',
  })
)
export type SoundId = Schema.Schema.Type<typeof SoundId>

export const SourceId = Schema.String.pipe(
  Schema.brand('SourceId'),
  Schema.annotations({
    title: 'SourceId',
    description: 'Unique identifier for an audio source instance',
  })
)
export type SourceId = Schema.Schema.Type<typeof SourceId>

// Sound Categories
export const SoundCategory = Schema.Literal(
  'master',
  'music',
  'blocks',
  'hostile',
  'neutral',
  'players',
  'ambient',
  'weather',
  'records'
)
export type SoundCategory = Schema.Schema.Type<typeof SoundCategory>

// Quaternion for 3D orientation
export const Quaternion = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
  w: Schema.Number.pipe(Schema.finite()),
}).pipe(
  Schema.brand('Quaternion'),
  Schema.annotations({
    title: 'Quaternion',
    description: '3D rotation quaternion',
  })
)
export type Quaternion = Schema.Schema.Type<typeof Quaternion>

// Sound Definition
export const SoundDefinition = Schema.Struct({
  id: SoundId,
  category: SoundCategory,
  defaultVolume: Volume,
  defaultPitch: Pitch,
  maxDistance: AudioDistance,
  referenceDistance: AudioDistance,
  isLooping: Schema.Boolean,
  priority: Schema.Number.pipe(Schema.between(0, 10)),
})
export type SoundDefinition = Schema.Schema.Type<typeof SoundDefinition>

// 3D Audio Source
export const AudioSource3D = Schema.Struct({
  soundId: SoundId,
  position: Vector3Schema,
  velocity: Schema.optional(Vector3Schema),
  volume: Volume,
  pitch: Pitch,
  referenceDistance: AudioDistance,
  rolloffFactor: Schema.Number.pipe(Schema.positive()),
})
export type AudioSource3D = Schema.Schema.Type<typeof AudioSource3D>

// Stop Reason
export const StopReason = Schema.Literal('manual', 'finished', 'error', 'replaced')
export type StopReason = Schema.Schema.Type<typeof StopReason>

// Audio Events
const SoundPlayedEvent = Schema.Struct({
  _tag: Schema.Literal('SoundPlayed'),
  source: AudioSource3D,
  timestamp: Schema.Number,
})

const SoundStoppedEvent = Schema.Struct({
  _tag: Schema.Literal('SoundStopped'),
  sourceId: SourceId,
  reason: StopReason,
})

const VolumeChangedEvent = Schema.Struct({
  _tag: Schema.Literal('VolumeChanged'),
  category: SoundCategory,
  newVolume: Volume,
})

const ListenerMovedEvent = Schema.Struct({
  _tag: Schema.Literal('ListenerMoved'),
  position: Vector3Schema,
  orientation: Quaternion,
})

export const AudioEvent = Schema.Union(SoundPlayedEvent, SoundStoppedEvent, VolumeChangedEvent, ListenerMovedEvent)
export type AudioEvent = Schema.Schema.Type<typeof AudioEvent>

// Weapon Types for combat sounds
export const WeaponType = Schema.Literal('sword', 'axe', 'pickaxe', 'shovel', 'fist')
export type WeaponType = Schema.Schema.Type<typeof WeaponType>

// Hit Types for combat
export const HitType = Schema.Literal('player', 'mob', 'block', 'miss')
export type HitType = Schema.Schema.Type<typeof HitType>

// Tool Types for block breaking
export const ToolType = Schema.Literal('pickaxe', 'axe', 'shovel', 'shears', 'hand')
export type ToolType = Schema.Schema.Type<typeof ToolType>

// Biome Types for ambient sounds
export const BiomeType = Schema.Literal('plains', 'forest', 'desert', 'ocean', 'mountains', 'swamp', 'tundra', 'jungle')
export type BiomeType = Schema.Schema.Type<typeof BiomeType>

// Time of Day for ambient sounds
export const TimeOfDay = Schema.Literal('dawn', 'day', 'dusk', 'night')
export type TimeOfDay = Schema.Schema.Type<typeof TimeOfDay>

// Sound Trigger Types
const BlockBreakTrigger = Schema.Struct({
  _tag: Schema.Literal('BlockBreak'),
  blockType: Schema.String, // BlockTypeId
  tool: Schema.optional(ToolType),
})

const BlockPlaceTrigger = Schema.Struct({
  _tag: Schema.Literal('BlockPlace'),
  blockType: Schema.String, // BlockTypeId
})

const FootstepTrigger = Schema.Struct({
  _tag: Schema.Literal('Footstep'),
  surfaceType: Schema.String, // BlockTypeId
  isRunning: Schema.Boolean,
})

const CombatTrigger = Schema.Struct({
  _tag: Schema.Literal('Combat'),
  weaponType: Schema.optional(WeaponType),
  hitType: HitType,
})

const AmbientTrigger = Schema.Struct({
  _tag: Schema.Literal('Ambient'),
  biome: BiomeType,
  timeOfDay: TimeOfDay,
})

export const SoundTrigger = Schema.Union(
  BlockBreakTrigger,
  BlockPlaceTrigger,
  FootstepTrigger,
  CombatTrigger,
  AmbientTrigger
)
export type SoundTrigger = Schema.Schema.Type<typeof SoundTrigger>

// Play Options
export const PlayOptions = Schema.Struct({
  volume: Schema.optional(Volume),
  pitch: Schema.optional(Pitch),
  loop: Schema.optional(Schema.Boolean),
  referenceDistance: Schema.optional(AudioDistance),
  rolloffFactor: Schema.optional(Schema.Number.pipe(Schema.positive())),
  maxDistance: Schema.optional(AudioDistance),
  priority: Schema.optional(Schema.Number.pipe(Schema.between(0, 10))),
})
export type PlayOptions = Schema.Schema.Type<typeof PlayOptions>

// Audio Source State
export const AudioSourceState = Schema.Struct({
  id: SourceId,
  soundId: SoundId,
  startTime: Schema.Number,
  is3D: Schema.Boolean,
  position: Schema.optional(Vector3Schema),
  baseVolume: Volume,
  category: SoundCategory,
})
export type AudioSourceState = Schema.Schema.Type<typeof AudioSourceState>

// Audio Errors
export const AudioError = Data.tagged<{
  readonly _tag: 'AudioError'
  readonly message: string
}>('AudioError')

export type AudioError = ReturnType<typeof AudioError>

export const SoundNotFoundError = Data.tagged<{
  readonly _tag: 'SoundNotFoundError'
  readonly soundId: SoundId
  readonly message: string
}>('SoundNotFoundError')

export type SoundNotFoundError = ReturnType<typeof SoundNotFoundError>

export const SourceNotFoundError = Data.tagged<{
  readonly _tag: 'SourceNotFoundError'
  readonly sourceId: SourceId
  readonly message: string
}>('SourceNotFoundError')

export type SourceNotFoundError = ReturnType<typeof SourceNotFoundError>

export const AudioLoadError = Data.tagged<{
  readonly _tag: 'AudioLoadError'
  readonly soundId: SoundId
  readonly message: string
  readonly cause?: unknown
}>('AudioLoadError')

export type AudioLoadError = ReturnType<typeof AudioLoadError>

export const AudioContextError = Data.tagged<{
  readonly _tag: 'AudioContextError'
  readonly message: string
}>('AudioContextError')

export type AudioContextError = ReturnType<typeof AudioContextError>

// Helper functions for creating audio types
export const AudioHelpers = {
  createVolume: (value: number): Volume => {
    const clamped = Math.max(0, Math.min(1, value))
    // Handle very small numbers that may cause precision issues
    const normalized = clamped < 0.0001 ? 0 : clamped
    return pipe(normalized, Schema.decodeSync(Volume))
  },

  createPitch: (value: number): Pitch => pipe(Math.max(0.5, Math.min(2, value)), Schema.decodeSync(Pitch)),

  createAudioDistance: (value: number): AudioDistance => pipe(Math.max(0, value), Schema.decodeSync(AudioDistance)),

  createSoundId: (value: string): SoundId => Schema.decodeSync(SoundId)(value),

  createSourceId: (value: string): SourceId => Schema.decodeSync(SourceId)(value),

  identityQuaternion: (): Quaternion => Schema.decodeSync(Quaternion)({ x: 0, y: 0, z: 0, w: 1 }),
}
