import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, MutableRef, Option } from 'effect'
import { AudioEnginePort, type AudioEnginePortShape, type ToneRequest } from '@ts-minecraft/game'
import { MusicManager } from '@ts-minecraft/game'

const makeFakeAudioEngine = () => {
  const playRequests: ToneRequest[] = []
  const stoppedToneIds: number[] = []
  const masterGains: number[] = []
  const nextToneIdRef = MutableRef.make(1)

  const engine: AudioEnginePortShape = {
    playTone: (request) =>
      Effect.sync(() => {
        playRequests.push(request)
        const id = MutableRef.get(nextToneIdRef)
        MutableRef.set(nextToneIdRef, id + 1)
        return { id }
      }),
    stopTone: (handle) =>
      Effect.sync(() => {
        stoppedToneIds.push(handle.id)
      }),
    setMasterGain: (gain) =>
      Effect.sync(() => {
        masterGains.push(gain)
      }),
  }

  return { engine, playRequests, stoppedToneIds, masterGains }
}

const makeMusicLayer = (engine: AudioEnginePortShape) =>
  MusicManager.Default.pipe(
    Layer.provide(Layer.succeed(AudioEnginePort, engine)),
  )

describe('audio/music-manager', () => {
  it.effect('plays looping music track for selected environment', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const musicManager = yield* MusicManager
      yield* musicManager.applySettings({ enabled: true, masterVolume: 0.8, musicVolume: 0.5 })
      yield* musicManager.setEnvironment('day')
      const result = yield* musicManager.getCurrentEnvironment()
      expect(fake.masterGains.at(-1)).toBeCloseTo(0.8, 5)
      expect(fake.playRequests.length).toBe(1)
      expect(fake.playRequests[0]!.loop).toBe(true)
      expect(result).toEqual(Option.some('day'))
    }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
  })

  it.effect('does not restart track when environment does not change', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const musicManager = yield* MusicManager
      yield* musicManager.applySettings({ enabled: true, masterVolume: 1, musicVolume: 1 })
      yield* musicManager.setEnvironment('night')
      yield* musicManager.setEnvironment('night')
      expect(fake.playRequests.length).toBe(1)
      expect(fake.stoppedToneIds.length).toBe(0)
    }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
  })

  it.effect('stops previous track when environment changes', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const musicManager = yield* MusicManager
      yield* musicManager.applySettings({ enabled: true, masterVolume: 1, musicVolume: 1 })
      yield* musicManager.setEnvironment('day')
      yield* musicManager.setEnvironment('cave')
      expect(fake.playRequests.length).toBe(2)
      expect(fake.stoppedToneIds).toEqual([1])
    }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
  })

  it.effect('updates environment from context (day/night/cave heuristic)', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const musicManager = yield* MusicManager
      yield* musicManager.applySettings({ enabled: true, masterVolume: 1, musicVolume: 1 })

      yield* musicManager.updateFromContext({
        isNight: false,
        playerPosition: { x: 0, y: 20, z: 0 },
      })
      yield* musicManager.updateFromContext({
        isNight: false,
        playerPosition: { x: 0, y: 70, z: 0 },
      })
      yield* musicManager.updateFromContext({
        isNight: true,
        playerPosition: { x: 0, y: 70, z: 0 },
      })

      const currentEnvironment = yield* musicManager.getCurrentEnvironment()
      expect(fake.playRequests.length).toBe(3)
      expect(currentEnvironment).toEqual(Option.some('night'))
    }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
  })

  it.effect('stops active music when disabled by settings', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const musicManager = yield* MusicManager
      yield* musicManager.applySettings({ enabled: true, masterVolume: 1, musicVolume: 1 })
      yield* musicManager.setEnvironment('day')
      yield* musicManager.applySettings({ enabled: false, masterVolume: 1, musicVolume: 1 })
      yield* musicManager.updateFromContext({
        isNight: true,
        playerPosition: { x: 0, y: 80, z: 0 },
      })
      const currentEnvironment = yield* musicManager.getCurrentEnvironment()
      expect(fake.stoppedToneIds).toEqual([1])
      expect(fake.playRequests.length).toBe(1)
      expect(currentEnvironment).toEqual(Option.none())
    }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
  })

  it.effect('getState returns current enabled flag and volumes', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const musicManager = yield* MusicManager
      yield* musicManager.applySettings({ enabled: true, masterVolume: 0.6, musicVolume: 0.4 })
      const state = yield* musicManager.getState()
      expect(state.enabled).toBe(true)
      expect(state.masterVolume).toBeCloseTo(0.6, 5)
      expect(state.musicVolume).toBeCloseTo(0.4, 5)
    }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
  })

  it.effect('stop() halts the active track and clears getCurrentEnvironment', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const musicManager = yield* MusicManager
      yield* musicManager.applySettings({ enabled: true, masterVolume: 1, musicVolume: 1 })
      yield* musicManager.setEnvironment('day')
      // Track is playing
      const envBefore = yield* musicManager.getCurrentEnvironment()
      expect(Option.isSome(envBefore)).toBe(true)

      yield* musicManager.stop()

      // After stop() the active track should be cleared
      const envAfter = yield* musicManager.getCurrentEnvironment()
      expect(envAfter).toEqual(Option.none())
      // The engine received a stopTone call for the day track
      expect(fake.stoppedToneIds).toEqual([1])
    }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
  })
})
