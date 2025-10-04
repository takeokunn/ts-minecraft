import type { Vector3D } from '@domain/entities/types'
import { Clock, Duration, Effect, HashMap, Layer, Match, Option, Predicate, Queue, Ref, Schedule, Stream, pipe } from 'effect'
import { nanoid } from 'nanoid'
import * as THREE from 'three'
import { AudioService } from './AudioService'
import {
  AudioContextError,
  AudioError,
  AudioEvent,
  AudioHelpers,
  AudioLoadError,
  AudioSourceState,
  type Pitch,
  type PlayOptions,
  type Quaternion,
  type SoundCategory,
  type SoundDefinition,
  type SoundId,
  type SourceId,
  SourceNotFoundError,
  StopReason,
  type Volume,
} from './AudioTypes'

interface ActiveSource {
  audio: THREE.PositionalAudio | THREE.Audio
  sourceState: AudioSourceState
  isPaused: boolean
}

/**
 * Create the AudioService implementation
 */
const makeAudioService = Effect.gen(function* () {
  // Initialize audio context and listener
  const audioContext = yield* Effect.try({
    try: () => {
      // @ts-expect-error - WebAudio API
      const AudioContext = window.AudioContext || window.webkitAudioContext
      return new AudioContext()
    },
    catch: () => AudioContextError({ message: 'Failed to create audio context' }),
  })

  const listener = yield* Effect.sync(() => new THREE.AudioListener())

  // State management
  const activeSources = yield* Ref.make(HashMap.empty<SourceId, ActiveSource>())
  const soundLibrary = yield* Ref.make(HashMap.empty<SoundId, AudioBuffer>())
  const soundDefinitions = yield* Ref.make(HashMap.empty<SoundId, SoundDefinition>())

  // Volume settings per category with defaults
  const volumeSettings = yield* Ref.make<HashMap.HashMap<SoundCategory, Volume>>(
    HashMap.fromIterable(
      [
        ['master', AudioHelpers.createVolume(1.0)],
        ['music', AudioHelpers.createVolume(0.7)],
        ['blocks', AudioHelpers.createVolume(1.0)],
        ['hostile', AudioHelpers.createVolume(1.0)],
        ['neutral', AudioHelpers.createVolume(1.0)],
        ['players', AudioHelpers.createVolume(1.0)],
        ['ambient', AudioHelpers.createVolume(0.5)],
        ['weather', AudioHelpers.createVolume(0.8)],
        ['records', AudioHelpers.createVolume(1.0)],
      ] satisfies ReadonlyArray<readonly [SoundCategory, Volume]>
    )
  )

  // Event queue
  const eventQueue = yield* Queue.unbounded<AudioEvent>()
  const events = Stream.fromQueue(eventQueue)

  // Doppler factor
  const dopplerFactor = yield* Ref.make(1.0)

  // Helper: Generate unique source ID
  const generateSourceId = (): SourceId => AudioHelpers.createSourceId(nanoid())

  // Helper: Calculate final volume
  const calculateFinalVolume = (
    baseVolume: Volume,
    category: SoundCategory,
    volumeMap: HashMap.HashMap<SoundCategory, Volume>
  ): number => {
    const categoryVolume = pipe(
      HashMap.get(volumeMap, category),
      Option.getOrElse(() => AudioHelpers.createVolume(1.0))
    )
    const masterVolume = pipe(
      HashMap.get(volumeMap, 'master'),
      Option.getOrElse(() => AudioHelpers.createVolume(1.0))
    )

    return Number(baseVolume) * Number(categoryVolume) * Number(masterVolume)
  }

  // Helper: Load sound from URL
  const loadSound = (soundId: SoundId) =>
    Effect.gen(function* () {
      const url = `/assets/sounds/${soundId}.ogg`

      const arrayBuffer = yield* Effect.tryPromise({
        try: () => fetch(url).then((response) => response.arrayBuffer()),
        catch: (error) =>
          AudioLoadError({
            soundId,
            message: `Failed to fetch sound: ${error}`,
            cause: error,
          }),
      })

      const audioBuffer = yield* Effect.tryPromise({
        try: () => audioContext.decodeAudioData(arrayBuffer),
        catch: (error) =>
          AudioLoadError({
            soundId,
            message: `Failed to decode audio: ${error}`,
            cause: error,
          }),
      })

      yield* Ref.update(soundLibrary, HashMap.set(soundId, audioBuffer))
      return audioBuffer
    })

  // Play sound in 3D space
  const playSound3D = (
    sound: SoundId,
    position: Vector3D,
    options?: Partial<PlayOptions>
  ): Effect.Effect<SourceId, AudioError> =>
    Effect.gen(function* () {
      // Get or load sound buffer
      const library = yield* Ref.get(soundLibrary)
      const buffer = yield* pipe(
        HashMap.get(library, sound),
        Option.match({
          onNone: () => loadSound(sound),
          onSome: Effect.succeed,
        })
      )

      // Create 3D audio source
      const positionalAudio = new THREE.PositionalAudio(listener)
      positionalAudio.setBuffer(buffer)
      positionalAudio.setRefDistance(Number(options?.referenceDistance || AudioHelpers.createAudioDistance(10)))
      positionalAudio.setRolloffFactor(options?.rolloffFactor || 1)
      positionalAudio.setDistanceModel('exponential')
      positionalAudio.setMaxDistance(Number(options?.maxDistance || AudioHelpers.createAudioDistance(100)))

      // Set position
      positionalAudio.position.set(position.x, position.y, position.z)

      // Set volume
      const volumes = yield* Ref.get(volumeSettings)
      const baseVolume = pipe(
        Option.fromNullable(options?.volume),
        Option.getOrElse(() => AudioHelpers.createVolume(1.0))
      )
      const finalVolume = calculateFinalVolume(baseVolume, 'blocks', volumes)
      positionalAudio.setVolume(finalVolume)

      // Set pitch
      const pitch = pipe(
        Option.fromNullable(options?.pitch),
        Option.getOrElse(() => AudioHelpers.createPitch(1.0))
      )
      positionalAudio.setPlaybackRate(Number(pitch))

      // Set loop
      const shouldLoop = pipe(
        Option.fromNullable(options),
        Option.flatMap((opts) => Option.fromNullable(opts.loop)),
        Option.getOrElse(() => false)
      )
      positionalAudio.setLoop(shouldLoop)

      // Play
      positionalAudio.play()

      // Create source state
      const sourceId = generateSourceId()
      const startTime = yield* Clock.currentTimeMillis
      const sourceState: AudioSourceState = {
        id: sourceId,
        soundId: sound,
        startTime,
        is3D: true,
        position,
        baseVolume,
        category: 'blocks',
      }

      const activeSource: ActiveSource = {
        audio: positionalAudio,
        sourceState,
        isPaused: false,
      }

      yield* Ref.update(activeSources, HashMap.set(sourceId, activeSource))

      const finishedEvent = {
        _tag: 'SoundStopped',
        sourceId,
        reason: 'finished',
      } satisfies AudioEvent

      yield* pipe(
        shouldLoop,
        Match.value,
        Match.when(false, () =>
          Effect.sync(() => {
            positionalAudio.onEnded = () => {
              Effect.runSync(
                pipe(
                  Ref.update(activeSources, HashMap.remove(sourceId)),
                  Effect.zipRight(Queue.offer(eventQueue, finishedEvent))
                )
              )
            }
          })
        ),
        Match.when(true, () => Effect.unit),
        Match.exhaustive
      )

      const timestamp = yield* Clock.currentTimeMillis
      const playedEvent = {
        _tag: 'SoundPlayed',
        source: {
          soundId: sound,
          position,
          volume: baseVolume,
          pitch,
          referenceDistance: options?.referenceDistance ?? AudioHelpers.createAudioDistance(10),
          rolloffFactor: options?.rolloffFactor ?? 1,
        },
        timestamp,
      } satisfies AudioEvent

      yield* Queue.offer(eventQueue, playedEvent)

      return sourceId
    }).pipe(
      Effect.mapError((error): AudioError =>
        pipe(
          Match.value(error),
          Match.tags({
            AudioLoadError: (err) => AudioError({ message: err.message }),
            AudioContextError: (err) => AudioError({ message: err.message }),
          }),
          Match.orElse((err) => AudioError({ message: String(err) }))
        )
      )
    )

  // Play sound in 2D (non-spatial)
  const playSound2D = (sound: SoundId, options?: Partial<PlayOptions>): Effect.Effect<SourceId, AudioError> =>
    Effect.gen(function* () {
      // Get or load sound buffer
      const library = yield* Ref.get(soundLibrary)
      const buffer = yield* pipe(
        HashMap.get(library, sound),
        Option.match({
          onNone: () => loadSound(sound),
          onSome: Effect.succeed,
        })
      )

      // Create 2D audio source
      const audio = new THREE.Audio(listener)
      audio.setBuffer(buffer)

      // Set volume
      const volumes = yield* Ref.get(volumeSettings)
      const baseVolume = options?.volume || AudioHelpers.createVolume(1.0)
      const finalVolume = calculateFinalVolume(baseVolume, 'music', volumes)
      audio.setVolume(finalVolume)

      // Set pitch
      const pitch = options?.pitch || AudioHelpers.createPitch(1.0)
      audio.setPlaybackRate(Number(pitch))

      // Set loop
      const shouldLoop = pipe(
        Option.fromNullable(options),
        Option.flatMap((opts) => Option.fromNullable(opts.loop)),
        Option.getOrElse(() => false)
      )
      audio.setLoop(shouldLoop)

      // Play
      audio.play()

      // Create source state
      const sourceId = generateSourceId()
      const startTime = yield* Clock.currentTimeMillis
      const sourceState: AudioSourceState = {
        id: sourceId,
        soundId: sound,
        startTime,
        is3D: false,
        baseVolume,
        category: 'music',
      }

      // Register source
      const activeSource: ActiveSource = {
        audio,
        sourceState,
        isPaused: false,
      }

      yield* Ref.update(activeSources, HashMap.set(sourceId, activeSource))

      // Auto-cleanup on end
      const finishedEvent = {
        _tag: 'SoundStopped',
        sourceId,
        reason: 'finished',
      } satisfies AudioEvent

      yield* Effect.when(
        Effect.sync(() => {
          audio.onEnded = () => {
            Effect.runSync(
              pipe(
                Ref.update(activeSources, HashMap.remove(sourceId)),
                Effect.zipRight(Queue.offer(eventQueue, finishedEvent))
              )
            )
          }
        }),
        () => shouldLoop === false
      )

      return sourceId
    }).pipe(
      Effect.mapError((error): AudioError =>
        pipe(
          Match.value(error),
          Match.tags({
            AudioLoadError: (err) => AudioError({ message: err.message }),
            AudioContextError: (err) => AudioError({ message: err.message }),
          }),
          Match.orElse((err) => AudioError({ message: String(err) }))
        )
      )
    )

  // Stop a sound
  const stopSound = (sourceId: SourceId) =>
    Effect.gen(function* () {
      const sources = yield* Ref.get(activeSources)
      const source = HashMap.get(sources, sourceId)

      yield* pipe(
        source,
        Option.match({
          onNone: () =>
            Effect.fail(
              SourceNotFoundError({
                sourceId,
                message: `Source ${sourceId} not found`,
              })
            ),
          onSome: (activeSource) =>
            Effect.gen(function* () {
              activeSource.audio.stop()
              yield* Ref.update(activeSources, HashMap.remove(sourceId))
              const stoppedEvent = {
                _tag: 'SoundStopped',
                sourceId,
                reason: 'manual',
              } satisfies AudioEvent
              yield* Queue.offer(eventQueue, stoppedEvent)
            }),
        })
      )
    })

  // Stop all sounds
  const stopAllSounds = () =>
    Effect.gen(function* () {
      const sources = yield* Ref.get(activeSources)

      yield* Effect.forEach(HashMap.values(sources), (source) =>
        Effect.sync(() => {
          source.audio.stop()
        })
      )

      yield* Ref.set(activeSources, HashMap.empty())
    })

  // Update listener position and orientation
  const updateListener = (position: Vector3D, orientation: Quaternion) =>
    Effect.gen(function* () {
      listener.position.set(position.x, position.y, position.z)

      const quaternion = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w)
      yield* pipe(
        Option.fromNullable(Reflect.get(listener, 'setRotationFromQuaternion')),
        Option.filter(Predicate.isFunction),
        Option.match({
          onNone: () => Effect.unit,
          onSome: (setter) => Effect.sync(() => setter.call(listener, quaternion)),
        })
      )

      const movedEvent = {
        _tag: 'ListenerMoved',
        position,
        orientation,
      } satisfies AudioEvent

      yield* Queue.offer(eventQueue, movedEvent)
    })

  // Set volume for a category
  const setVolume = (category: SoundCategory, volume: Volume) =>
    Effect.gen(function* () {
      yield* Ref.update(volumeSettings, HashMap.set(category, volume))

      // Update active sounds
      const sources = yield* Ref.get(activeSources)
      const volumes = yield* Ref.get(volumeSettings)

      yield* Effect.forEach(HashMap.values(sources), (source) =>
        Effect.sync(() => {
          const finalVolume = calculateFinalVolume(source.sourceState.baseVolume, source.sourceState.category, volumes)
          source.audio.setVolume(finalVolume)
        })
      )

      const volumeChangedEvent = {
        _tag: 'VolumeChanged',
        category,
        newVolume: volume,
      } satisfies AudioEvent

      yield* Queue.offer(eventQueue, volumeChangedEvent)
    })

  // Get volume for a category
  const getVolume = (category: SoundCategory) =>
    Effect.gen(function* () {
      const volumes = yield* Ref.get(volumeSettings)
      return pipe(
        HashMap.get(volumes, category),
        Option.getOrElse(() => AudioHelpers.createVolume(1.0))
      )
    })

  // Preload sounds
  const preloadSounds = (soundIds: ReadonlyArray<SoundId>) =>
    Effect.gen(function* () {
      yield* Effect.forEach(soundIds, loadSound, { concurrency: 4 })
    })

  // Fade in
  const fadeIn = (sourceId: SourceId, targetVolume: Volume, duration: number) =>
    Effect.gen(function* () {
      const sources = yield* Ref.get(activeSources)
      const source = HashMap.get(sources, sourceId)

      yield* pipe(
        source,
        Option.match({
          onNone: () =>
            Effect.fail(
              SourceNotFoundError({
                sourceId,
                message: `Source ${sourceId} not found`,
              })
            ),
          onSome: (activeSource) =>
            Effect.gen(function* () {
              const startVolume = activeSource.audio.getVolume()
              const steps = Math.ceil(duration / 50) // 50ms steps
              const volumeStep = (Number(targetVolume) - startVolume) / steps

              yield* Effect.repeat(
                Effect.gen(function* () {
                  const currentVolume = activeSource.audio.getVolume()
                  const nextVolume = Math.min(currentVolume + volumeStep, Number(targetVolume))
                  activeSource.audio.setVolume(nextVolume)
                }),
                Schedule.recurs(steps).pipe(Schedule.delayed(() => Duration.millis(50)))
              )
            }),
        })
      )
    })

  // Fade out
  const fadeOut = (sourceId: SourceId, duration: number) =>
    Effect.gen(function* () {
      const sources = yield* Ref.get(activeSources)
      const source = HashMap.get(sources, sourceId)

      yield* pipe(
        source,
        Option.match({
          onNone: () =>
            Effect.fail(
              SourceNotFoundError({
                sourceId,
                message: `Source ${sourceId} not found`,
              })
            ),
          onSome: (activeSource) =>
            Effect.gen(function* () {
              const startVolume = activeSource.audio.getVolume()
              const steps = Math.ceil(duration / 50) // 50ms steps
              const volumeStep = startVolume / steps

              yield* Effect.repeat(
                Effect.gen(function* () {
                  const currentVolume = activeSource.audio.getVolume()
                  const nextVolume = Math.max(0, currentVolume - volumeStep)
                  activeSource.audio.setVolume(nextVolume)
                }),
                Schedule.recurs(steps).pipe(Schedule.delayed(() => Duration.millis(50)))
              )

              yield* stopSound(sourceId)
            }),
        })
      )
    })

  // Check if playing
  const isPlaying = (sourceId: SourceId) =>
    Effect.gen(function* () {
      const sources = yield* Ref.get(activeSources)
      return HashMap.has(sources, sourceId)
    })

  // Get active sound count
  const getActiveSoundCount = () =>
    Effect.gen(function* () {
      const sources = yield* Ref.get(activeSources)
      return HashMap.size(sources)
    })

  // Set doppler factor
  const setDopplerFactor = (factor: number) =>
    Effect.gen(function* () {
      yield* Ref.set(dopplerFactor, factor)
      yield* pipe(
        Option.fromNullable(Reflect.get(listener, 'setDopplerFactor')),
        Option.filter(Predicate.isFunction),
        Option.match({
          onNone: () => Effect.unit,
          onSome: (setter) => Effect.sync(() => setter.call(listener, factor)),
        })
      )
    })

  // Pause sound
  const pauseSound = (sourceId: SourceId) =>
    Effect.gen(function* () {
      const sources = yield* Ref.get(activeSources)
      const source = HashMap.get(sources, sourceId)

      yield* pipe(
        source,
        Option.match({
          onNone: () =>
            Effect.fail(
              SourceNotFoundError({
                sourceId,
                message: `Source ${sourceId} not found`,
              })
            ),
          onSome: (activeSource) =>
            Effect.gen(function* () {
              activeSource.audio.pause()
              activeSource.isPaused = true
            }),
        })
      )
    })

  // Resume sound
  const resumeSound = (sourceId: SourceId) =>
    Effect.gen(function* () {
      const sources = yield* Ref.get(activeSources)
      const source = HashMap.get(sources, sourceId)

      yield* pipe(
        source,
        Option.match({
          onNone: () =>
            Effect.fail(
              SourceNotFoundError({
                sourceId,
                message: `Source ${sourceId} not found`,
              })
            ),
          onSome: (activeSource) =>
            Effect.gen(function* () {
              activeSource.audio.play()
              activeSource.isPaused = false
            }),
        })
      )
    })

  // Set pitch
  const setPitch = (sourceId: SourceId, pitch: Pitch) =>
    Effect.gen(function* () {
      const sources = yield* Ref.get(activeSources)
      const source = HashMap.get(sources, sourceId)

      yield* pipe(
        source,
        Option.match({
          onNone: () =>
            Effect.fail(
              SourceNotFoundError({
                sourceId,
                message: `Source ${sourceId} not found`,
              })
            ),
          onSome: (activeSource) =>
            Effect.sync(() => {
              activeSource.audio.setPlaybackRate(Number(pitch))
            }),
        })
      )
    })

  // Update source position
  const updateSourcePosition = (sourceId: SourceId, position: Vector3D) =>
    Effect.gen(function* () {
      const sources = yield* Ref.get(activeSources)
      const source = HashMap.get(sources, sourceId)

      yield* pipe(
        source,
        Option.match({
          onNone: () =>
            Effect.fail(
              SourceNotFoundError({
                sourceId,
                message: `Source ${sourceId} not found`,
              })
            ),
          onSome: (activeSource) =>
            pipe(
              Option.fromPredicate(
                (audio: THREE.PositionalAudio | THREE.Audio): audio is THREE.PositionalAudio =>
                  audio instanceof THREE.PositionalAudio
              )(activeSource.audio),
              Option.match({
                onNone: () => Effect.unit,
                onSome: (positionalAudio) =>
                  Effect.sync(() => {
                    positionalAudio.position.set(position.x, position.y, position.z)
                    activeSource.sourceState = { ...activeSource.sourceState, position }
                  }),
              })
            ),
        })
      )
    })

  return AudioService.of({
    playSound3D,
    playSound2D,
    stopSound,
    stopAllSounds,
    updateListener,
    setVolume,
    getVolume,
    preloadSounds,
    events,
    fadeIn,
    fadeOut,
    isPlaying,
    getActiveSoundCount,
    setDopplerFactor,
    pauseSound,
    resumeSound,
    setPitch,
    updateSourcePosition,
  })
})

/**
 * AudioService Layer
 */
export const AudioServiceLive = Layer.effect(AudioService, makeAudioService)
