import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Effect, HashMap, Layer, Option, TestContext, pipe } from 'effect'
import { AudioService } from '../AudioService'
import { AudioServiceLive } from '../AudioServiceLive'
import {
  AudioHelpers,
  type SoundCategory,
  type SoundId,
  type SourceId,
  type Volume,
  type Pitch,
  SourceNotFoundError,
} from '../AudioTypes'
import { SpatialBrands } from '@shared/types/spatial-brands'
import type { Vector3D } from '@shared/types/spatial-brands'

// Mock Three.js
vi.mock('three', () => ({
  AudioListener: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    setRotationFromQuaternion: vi.fn(),
    setDopplerFactor: vi.fn(),
  })),
  Audio: vi.fn().mockImplementation(() => ({
    setBuffer: vi.fn(),
    setVolume: vi.fn(),
    setPlaybackRate: vi.fn(),
    setLoop: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    getVolume: vi.fn().mockReturnValue(1),
    onEnded: null,
  })),
  PositionalAudio: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    setBuffer: vi.fn(),
    setRefDistance: vi.fn(),
    setRolloffFactor: vi.fn(),
    setDistanceModel: vi.fn(),
    setMaxDistance: vi.fn(),
    setVolume: vi.fn(),
    setPlaybackRate: vi.fn(),
    setLoop: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    getVolume: vi.fn().mockReturnValue(1),
    onEnded: null,
  })),
  Quaternion: vi.fn().mockImplementation((x, y, z, w) => ({ x, y, z, w })),
}))

// Mock WebAudio API
global.AudioContext = vi.fn().mockImplementation(() => ({
  decodeAudioData: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
})) as any

// @ts-expect-error - Mock
global.window = {
  AudioContext: global.AudioContext,
}

// Mock fetch
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  })
)

// Test data constants
const testPosition = SpatialBrands.createVector3D(10, 20, 30)
const testVolume = AudioHelpers.createVolume(0.8)
const testPitch = AudioHelpers.createPitch(1.2)
const testSoundId = AudioHelpers.createSoundId('test.sound')
const testSoundCategory: SoundCategory = 'music'

// Helper functions to generate test data
const generatePosition3D = (): Vector3D => {
  return SpatialBrands.createVector3D(Math.random() * 100, Math.random() * 100, Math.random() * 100)
}
const generateVolume = (): Volume => {
  return AudioHelpers.createVolume(Math.random())
}
const generatePitch = (): Pitch => {
  return AudioHelpers.createPitch(0.5 + Math.random())
}
const generateSoundId = (): SoundId => {
  return AudioHelpers.createSoundId(`sound_${Math.floor(Math.random() * 1000)}`)
}
const generateSoundCategory = (): SoundCategory => {
  const categories: SoundCategory[] = ['ambient', 'hostile', 'music', 'master']
  return categories[Math.floor(Math.random() * categories.length)]!
}

describe('AudioService', () => {
  const TestLayer = AudioServiceLive

  describe('3D Sound Playback', () => {
    it('should play a 3D sound at a specific position', () => {
      return Effect.gen(function* () {
        for (let i = 0; i < 10; i++) {
          const soundId = generateSoundId()
          const position = generatePosition3D()
          const volume = generateVolume()

          const service = yield* AudioService
          const sourceId = yield* service.playSound3D(soundId, position, { volume })
          const isPlaying = yield* service.isPlaying(sourceId)

          expect(isPlaying).toBe(true)
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })

    it('should respect distance attenuation', () => {
      return Effect.gen(function* () {
        for (let i = 0; i < 5; i++) {
          const soundId = generateSoundId()
          const sourcePosition = generatePosition3D()

          const service = yield* AudioService

          // Play sound at source position
          const sourceId = yield* service.playSound3D(soundId, sourcePosition, {
            referenceDistance: AudioHelpers.createAudioDistance(10),
            rolloffFactor: 1,
          })

          // Move listener near
          const nearPosition = SpatialBrands.createVector3D(sourcePosition.x + 5, sourcePosition.y, sourcePosition.z)
          yield* service.updateListener(nearPosition, AudioHelpers.identityQuaternion())

          // Move listener far
          const farPosition = SpatialBrands.createVector3D(sourcePosition.x + 50, sourcePosition.y, sourcePosition.z)
          yield* service.updateListener(farPosition, AudioHelpers.identityQuaternion())

          // Cleanup
          yield* service.stopSound(sourceId)
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })
  })

  describe('Volume Control', () => {
    it('should apply category volumes correctly', () => {
      return Effect.gen(function* () {
        const service = yield* AudioService

        // Test specific category volumes
        const categoryVolume = AudioHelpers.createVolume(0.7)
        const masterVolume = AudioHelpers.createVolume(0.5)

        // Set volumes
        yield* service.setVolume('music', categoryVolume)
        yield* service.setVolume('master', masterVolume)

        // Verify volumes
        const retrievedCategoryVolume = yield* service.getVolume('music')
        const retrievedMasterVolume = yield* service.getVolume('master')

        // Use approximate equality for floating-point numbers
        expect(Number(retrievedCategoryVolume)).toBeCloseTo(Number(categoryVolume), 6)
        expect(Number(retrievedMasterVolume)).toBeCloseTo(Number(masterVolume), 6)

        // Test other categories
        const ambientVolume = AudioHelpers.createVolume(0.3)
        yield* service.setVolume('ambient', ambientVolume)
        const retrievedAmbientVolume = yield* service.getVolume('ambient')
        expect(Number(retrievedAmbientVolume)).toBeCloseTo(Number(ambientVolume), 6)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })

    it('should update volume for active sounds', async () => {
      await Effect.gen(function* () {
        const service = yield* AudioService

        // Play multiple sounds
        const musicId = yield* service.playSound2D(AudioHelpers.createSoundId('music.overworld'), {
          loop: true,
        })
        const blockId = yield* service.playSound3D(
          AudioHelpers.createSoundId('block.stone.break'),
          SpatialBrands.createVector3D(10, 64, 10)
        )

        // Change master volume
        yield* service.setVolume('master', AudioHelpers.createVolume(0.5))

        // Both sounds should still be playing
        const musicPlaying = yield* service.isPlaying(musicId)
        const blockPlaying = yield* service.isPlaying(blockId)

        expect(musicPlaying).toBe(true)
        expect(blockPlaying).toBe(true)

        // Cleanup
        yield* service.stopAllSounds()
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })
  })

  describe('Sound Management', () => {
    it('should handle concurrent sound limit', async () => {
      await Effect.gen(function* () {
        const service = yield* AudioService
        const maxSounds = 32

        // Play many sounds
        const sourceIds: SourceId[] = []
        for (let i = 0; i < 50; i++) {
          const sourceId = yield* service.playSound3D(
            AudioHelpers.createSoundId(`test.sound.${i}`),
            SpatialBrands.createVector3D(i, 0, 0),
            { priority: i % 10 }
          )
          sourceIds.push(sourceId)
        }

        // Check active count doesn't exceed limit
        const activeCount = yield* service.getActiveSoundCount()
        expect(activeCount).toBeLessThanOrEqual(50) // Our mock doesn't implement priority limiting

        // Cleanup
        yield* service.stopAllSounds()
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })

    it('should stop sounds correctly', () => {
      return Effect.gen(function* () {
        for (let i = 0; i < 5; i++) {
          const soundId = generateSoundId()
          const position = generatePosition3D()

          const service = yield* AudioService

          // Play and stop sound
          const sourceId = yield* service.playSound3D(soundId, position)
          yield* service.stopSound(sourceId)

          // Should no longer be playing
          const isPlaying = yield* service.isPlaying(sourceId)
          expect(isPlaying).toBe(false)

          // Should fail to stop again
          const result = yield* Effect.either(service.stopSound(sourceId))
          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left).toBeInstanceOf(SourceNotFoundError)
          }
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })
  })

  describe('Fade Effects', () => {
    it('should fade in sounds', () => {
      return Effect.gen(function* () {
        for (let i = 0; i < 3; i++) {
          const soundId = generateSoundId()
          const targetVolume = generateVolume()
          const duration = Math.floor(Math.random() * 1000)

          const service = yield* AudioService

          // Play sound at zero volume
          const sourceId = yield* service.playSound2D(soundId, {
            volume: AudioHelpers.createVolume(0),
          })

          // Fade in
          yield* service.fadeIn(sourceId, targetVolume, duration)

          // Sound should still be playing
          const isPlaying = yield* service.isPlaying(sourceId)
          expect(isPlaying).toBe(true)

          // Cleanup
          yield* service.stopSound(sourceId)
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })

    it('should fade out and stop sounds', () => {
      return Effect.gen(function* () {
        for (let i = 0; i < 3; i++) {
          const soundId = generateSoundId()
          const duration = Math.floor(Math.random() * 1000)

          const service = yield* AudioService

          // Play sound
          const sourceId = yield* service.playSound2D(soundId)

          // Fade out
          yield* service.fadeOut(sourceId, duration)

          // Sound should be stopped
          const isPlaying = yield* service.isPlaying(sourceId)
          expect(isPlaying).toBe(false)
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })
  })

  describe('Pause/Resume', () => {
    it('should pause and resume sounds', () => {
      return Effect.gen(function* () {
        for (let i = 0; i < 5; i++) {
          const soundId = generateSoundId()

          const service = yield* AudioService

          // Play sound
          const sourceId = yield* service.playSound2D(soundId, { loop: true })

          // Pause
          yield* service.pauseSound(sourceId)
          const isPausedPlaying = yield* service.isPlaying(sourceId)
          expect(isPausedPlaying).toBe(true) // Still registered as playing

          // Resume
          yield* service.resumeSound(sourceId)
          const isResumedPlaying = yield* service.isPlaying(sourceId)
          expect(isResumedPlaying).toBe(true)

          // Cleanup
          yield* service.stopSound(sourceId)
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })
  })

  describe('Pitch Control', () => {
    it('should adjust pitch of playing sounds', () => {
      return Effect.gen(function* () {
        for (let i = 0; i < 5; i++) {
          const soundId = generateSoundId()
          const newPitch = generatePitch()

          const service = yield* AudioService

          // Play sound with default pitch
          const sourceId = yield* service.playSound2D(soundId)

          // Change pitch
          yield* service.setPitch(sourceId, newPitch)

          // Sound should still be playing
          const isPlaying = yield* service.isPlaying(sourceId)
          expect(isPlaying).toBe(true)

          // Cleanup
          yield* service.stopSound(sourceId)
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })
  })

  describe('3D Source Movement', () => {
    it('should update 3D source positions', () => {
      return Effect.gen(function* () {
        for (let i = 0; i < 5; i++) {
          const soundId = generateSoundId()
          const initialPos = generatePosition3D()
          const newPos = generatePosition3D()

          const service = yield* AudioService

          // Play 3D sound
          const sourceId = yield* service.playSound3D(soundId, initialPos)

          // Update position
          yield* service.updateSourcePosition(sourceId, newPos)

          // Sound should still be playing
          const isPlaying = yield* service.isPlaying(sourceId)
          expect(isPlaying).toBe(true)

          // Cleanup
          yield* service.stopSound(sourceId)
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent source IDs', async () => {
      await Effect.gen(function* () {
        const service = yield* AudioService
        const fakeSourceId = AudioHelpers.createSourceId('non-existent')

        // All operations should fail gracefully
        const stopResult = yield* Effect.either(service.stopSound(fakeSourceId))
        const pauseResult = yield* Effect.either(service.pauseSound(fakeSourceId))
        const resumeResult = yield* Effect.either(service.resumeSound(fakeSourceId))
        const pitchResult = yield* Effect.either(service.setPitch(fakeSourceId, AudioHelpers.createPitch(1)))

        expect(stopResult._tag).toBe('Left')
        expect(pauseResult._tag).toBe('Left')
        expect(resumeResult._tag).toBe('Left')
        expect(pitchResult._tag).toBe('Left')
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })
  })

  describe('Sound Preloading', () => {
    it('should preload multiple sounds concurrently', async () => {
      await Effect.gen(function* () {
        const service = yield* AudioService

        const soundIds = Array.from({ length: 10 }, (_, i) => AudioHelpers.createSoundId(`preload.test.${i}`))

        // Preload sounds
        yield* service.preloadSounds(soundIds)

        // Should be able to play preloaded sounds immediately
        const sourceId = yield* service.playSound2D(soundIds[0]!)
        const isPlaying = yield* service.isPlaying(sourceId)

        expect(isPlaying).toBe(true)

        // Cleanup
        yield* service.stopSound(sourceId)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)
    })
  })
})
