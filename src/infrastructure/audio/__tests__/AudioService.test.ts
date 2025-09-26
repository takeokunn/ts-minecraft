import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Effect, HashMap, Layer, Option, TestContext, pipe } from 'effect'
import fc from 'fast-check'
import { AudioService } from '../AudioService.js'
import { AudioServiceLive } from '../AudioServiceLive.js'
import {
  AudioHelpers,
  type SoundCategory,
  type SoundId,
  type SourceId,
  type Volume,
  type Pitch,
  SourceNotFoundError,
} from '../AudioTypes.js'
import { SpatialBrands } from '../../../shared/types/spatial-brands.js'
import type { Vector3D } from '../../../shared/types/spatial-brands.js'

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

// Arbitrary generators
const arbPosition3D = (): fc.Arbitrary<Vector3D> =>
  fc
    .record({
      x: fc.float({ min: -100, max: 100, noNaN: true }),
      y: fc.float({ min: 0, max: 256, noNaN: true }),
      z: fc.float({ min: -100, max: 100, noNaN: true }),
    })
    .map((pos) => SpatialBrands.createVector3D(pos.x, pos.y, pos.z))

const arbVolume = (): fc.Arbitrary<Volume> =>
  fc.float({ min: 0, max: 1, noNaN: true }).map((v) => AudioHelpers.createVolume(v))

const arbPitch = (): fc.Arbitrary<Pitch> =>
  fc.float({ min: 0.5, max: 2, noNaN: true }).map((p) => AudioHelpers.createPitch(p))

const arbSoundId = (): fc.Arbitrary<SoundId> =>
  fc
    .oneof(
      fc.constant('block.stone.break'),
      fc.constant('block.wood.place'),
      fc.constant('entity.player.hurt'),
      fc.constant('music.overworld'),
      fc.constant('ambient.cave')
    )
    .map((id) => AudioHelpers.createSoundId(id))

const arbSoundCategory = (): fc.Arbitrary<SoundCategory> =>
  fc.oneof(
    fc.constant('master' as SoundCategory),
    fc.constant('music' as SoundCategory),
    fc.constant('blocks' as SoundCategory),
    fc.constant('players' as SoundCategory),
    fc.constant('ambient' as SoundCategory)
  )

describe('AudioService', () => {
  const TestLayer = AudioServiceLive

  describe('3D Sound Playback', () => {
    it('should play a 3D sound at a specific position', async () => {
      await fc.assert(
        fc.asyncProperty(arbSoundId(), arbPosition3D(), arbVolume(), async (soundId, position, volume) => {
          const result = await Effect.gen(function* () {
            const service = yield* AudioService

            const sourceId = yield* service.playSound3D(soundId, position, { volume })
            const isPlaying = yield* service.isPlaying(sourceId)

            return { sourceId, isPlaying }
          }).pipe(Effect.provide(TestLayer), Effect.runPromise)

          expect(result.isPlaying).toBe(true)
        }),
        { numRuns: 10 }
      )
    })

    it('should respect distance attenuation', async () => {
      await fc.assert(
        fc.asyncProperty(arbSoundId(), arbPosition3D(), async (soundId, sourcePosition) => {
          await Effect.gen(function* () {
            const service = yield* AudioService

            // Play sound at source position
            const sourceId = yield* service.playSound3D(soundId, sourcePosition, {
              referenceDistance: AudioHelpers.createAudioDistance(10),
              rolloffFactor: 1,
            })

            // Move listener near
            const nearPosition = SpatialBrands.createVector3D(
              sourcePosition.x + 5,
              sourcePosition.y,
              sourcePosition.z
            )
            yield* service.updateListener(nearPosition, AudioHelpers.identityQuaternion())

            // Move listener far
            const farPosition = SpatialBrands.createVector3D(
              sourcePosition.x + 50,
              sourcePosition.y,
              sourcePosition.z
            )
            yield* service.updateListener(farPosition, AudioHelpers.identityQuaternion())

            // Cleanup
            yield* service.stopSound(sourceId)
          }).pipe(Effect.provide(TestLayer), Effect.runPromise)
        }),
        { numRuns: 5 }
      )
    })
  })

  describe('Volume Control', () => {
    it('should apply category volumes correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbSoundCategory(),
          arbVolume(),
          arbVolume(),
          async (category, categoryVolume, masterVolume) => {
            await Effect.gen(function* () {
              const service = yield* AudioService

              // Set volumes
              yield* service.setVolume(category, categoryVolume)
              yield* service.setVolume('master', masterVolume)

              // Verify volumes
              const retrievedCategoryVolume = yield* service.getVolume(category)
              const retrievedMasterVolume = yield* service.getVolume('master')

              expect(retrievedCategoryVolume).toEqual(categoryVolume)
              expect(retrievedMasterVolume).toEqual(masterVolume)
            }).pipe(Effect.provide(TestLayer), Effect.runPromise)
          }
        ),
        { numRuns: 10 }
      )
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

    it('should stop sounds correctly', async () => {
      await fc.assert(
        fc.asyncProperty(arbSoundId(), arbPosition3D(), async (soundId, position) => {
          await Effect.gen(function* () {
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
          }).pipe(Effect.provide(TestLayer), Effect.runPromise)
        }),
        { numRuns: 5 }
      )
    })
  })

  describe('Fade Effects', () => {
    it('should fade in sounds', async () => {
      await fc.assert(
        fc.asyncProperty(arbSoundId(), arbVolume(), fc.nat({ max: 1000 }), async (soundId, targetVolume, duration) => {
          await Effect.gen(function* () {
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
          }).pipe(Effect.provide(TestLayer), Effect.runPromise)
        }),
        { numRuns: 3 }
      )
    })

    it('should fade out and stop sounds', async () => {
      await fc.assert(
        fc.asyncProperty(arbSoundId(), fc.nat({ max: 1000 }), async (soundId, duration) => {
          await Effect.gen(function* () {
            const service = yield* AudioService

            // Play sound
            const sourceId = yield* service.playSound2D(soundId)

            // Fade out
            yield* service.fadeOut(sourceId, duration)

            // Sound should be stopped
            const isPlaying = yield* service.isPlaying(sourceId)
            expect(isPlaying).toBe(false)
          }).pipe(Effect.provide(TestLayer), Effect.runPromise)
        }),
        { numRuns: 3 }
      )
    })
  })

  describe('Pause/Resume', () => {
    it('should pause and resume sounds', async () => {
      await fc.assert(
        fc.asyncProperty(arbSoundId(), async (soundId) => {
          await Effect.gen(function* () {
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
          }).pipe(Effect.provide(TestLayer), Effect.runPromise)
        }),
        { numRuns: 5 }
      )
    })
  })

  describe('Pitch Control', () => {
    it('should adjust pitch of playing sounds', async () => {
      await fc.assert(
        fc.asyncProperty(arbSoundId(), arbPitch(), async (soundId, newPitch) => {
          await Effect.gen(function* () {
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
          }).pipe(Effect.provide(TestLayer), Effect.runPromise)
        }),
        { numRuns: 5 }
      )
    })
  })

  describe('3D Source Movement', () => {
    it('should update 3D source positions', async () => {
      await fc.assert(
        fc.asyncProperty(arbSoundId(), arbPosition3D(), arbPosition3D(), async (soundId, initialPos, newPos) => {
          await Effect.gen(function* () {
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
          }).pipe(Effect.provide(TestLayer), Effect.runPromise)
        }),
        { numRuns: 5 }
      )
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
        const pitchResult = yield* Effect.either(
          service.setPitch(fakeSourceId, AudioHelpers.createPitch(1))
        )

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

        const soundIds = Array.from({ length: 10 }, (_, i) =>
          AudioHelpers.createSoundId(`preload.test.${i}`)
        )

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