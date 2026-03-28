import { describe, expect, it } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { AudioEngine, type AudioEngine as AudioEngineService, type ToneRequest } from '@/audio/audio-engine'
import { MusicManager, MusicManagerLive } from '@/audio/music-manager'

const makeFakeAudioEngine = () => {
  const playRequests: ToneRequest[] = []
  const stoppedToneIds: number[] = []
  const masterGains: number[] = []
  let nextToneId = 1

  const engine: AudioEngineService = {
    playTone: (request) =>
      Effect.sync(() => {
        playRequests.push(request)
        const id = nextToneId
        nextToneId += 1
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

const makeMusicLayer = (engine: AudioEngineService) =>
  MusicManagerLive.pipe(
    Layer.provide(Layer.succeed(AudioEngine, engine)),
  )

describe('audio/music-manager', () => {
  it('plays looping music track for selected environment', () => {
    const fake = makeFakeAudioEngine()

    const result = Effect.runSync(
      Effect.gen(function* () {
        const musicManager = yield* MusicManager
        yield* musicManager.applySettings({ enabled: true, masterVolume: 0.8, musicVolume: 0.5 })
        yield* musicManager.setEnvironment('day')
        return yield* musicManager.getCurrentEnvironment()
      }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
    )

    expect(fake.masterGains.at(-1)).toBeCloseTo(0.8, 5)
    expect(fake.playRequests.length).toBe(1)
    expect(fake.playRequests[0]?.loop).toBe(true)
    expect(Option.getOrElse(result, () => 'none')).toBe('day')
  })

  it('does not restart track when environment does not change', () => {
    const fake = makeFakeAudioEngine()

    Effect.runSync(
      Effect.gen(function* () {
        const musicManager = yield* MusicManager
        yield* musicManager.applySettings({ enabled: true, masterVolume: 1, musicVolume: 1 })
        yield* musicManager.setEnvironment('night')
        yield* musicManager.setEnvironment('night')
      }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
    )

    expect(fake.playRequests.length).toBe(1)
    expect(fake.stoppedToneIds.length).toBe(0)
  })

  it('stops previous track when environment changes', () => {
    const fake = makeFakeAudioEngine()

    Effect.runSync(
      Effect.gen(function* () {
        const musicManager = yield* MusicManager
        yield* musicManager.applySettings({ enabled: true, masterVolume: 1, musicVolume: 1 })
        yield* musicManager.setEnvironment('day')
        yield* musicManager.setEnvironment('cave')
      }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
    )

    expect(fake.playRequests.length).toBe(2)
    expect(fake.stoppedToneIds).toEqual([1])
  })

  it('updates environment from context (day/night/cave heuristic)', () => {
    const fake = makeFakeAudioEngine()

    const currentEnvironment = Effect.runSync(
      Effect.gen(function* () {
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

        return yield* musicManager.getCurrentEnvironment()
      }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
    )

    expect(fake.playRequests.length).toBe(3)
    expect(Option.getOrElse(currentEnvironment, () => 'none')).toBe('night')
  })

  it('stops active music when disabled by settings', () => {
    const fake = makeFakeAudioEngine()

    const currentEnvironment = Effect.runSync(
      Effect.gen(function* () {
        const musicManager = yield* MusicManager
        yield* musicManager.applySettings({ enabled: true, masterVolume: 1, musicVolume: 1 })
        yield* musicManager.setEnvironment('day')
        yield* musicManager.applySettings({ enabled: false, masterVolume: 1, musicVolume: 1 })
        yield* musicManager.updateFromContext({
          isNight: true,
          playerPosition: { x: 0, y: 80, z: 0 },
        })
        return yield* musicManager.getCurrentEnvironment()
      }).pipe(Effect.provide(makeMusicLayer(fake.engine)))
    )

    expect(fake.stoppedToneIds).toEqual([1])
    expect(fake.playRequests.length).toBe(1)
    expect(Option.isNone(currentEnvironment)).toBe(true)
  })
})
