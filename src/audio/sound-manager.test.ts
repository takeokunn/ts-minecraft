import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { AudioEngine, type AudioEngine as AudioEngineService, type ToneRequest } from '@/audio/audio-engine'
import { SoundManager, SoundManagerLive } from '@/audio/sound-manager'

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

const makeSoundLayer = (engine: AudioEngineService) =>
  SoundManagerLive.pipe(
    Layer.provide(Layer.succeed(AudioEngine, engine)),
  )

describe('audio/sound-manager', () => {
  it.effect('plays sound effects with configured master/sfx volume', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const soundManager = yield* SoundManager
      yield* soundManager.applySettings({ enabled: true, masterVolume: 0.5, sfxVolume: 0.4 })
      yield* soundManager.playEffect('blockBreak')
      expect(fake.masterGains.at(-1)).toBeCloseTo(0.5, 5)
      expect(fake.playRequests.length).toBe(1)
      expect(fake.playRequests[0]!.loop).toBe(false)
      expect(fake.playRequests[0]!.gain).toBeCloseTo(0.08, 4)
    }).pipe(Effect.provide(makeSoundLayer(fake.engine)))
  })

  it.effect('applies positional attenuation and stereo pan for 3D playback', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const soundManager = yield* SoundManager
      yield* soundManager.applySettings({ enabled: true, masterVolume: 1, sfxVolume: 1 })
      yield* soundManager.setListenerPosition({ x: 0, y: 64, z: 0 })

      yield* soundManager.playEffect('blockPlace', { position: { x: 0, y: 64, z: 0 } })
      yield* soundManager.playEffect('blockPlace', { position: { x: 24, y: 64, z: 0 } })
      yield* soundManager.playEffect('blockPlace', { position: { x: -12, y: 64, z: 0 } })

      const near = fake.playRequests[0]
      const farRight = fake.playRequests[1]
      const left = fake.playRequests[2]

      expect(near).toBeDefined()
      expect(farRight).toBeDefined()
      expect(left).toBeDefined()

      expect(near!.gain > farRight!.gain).toBe(true)
      expect(farRight!.pan).toBeGreaterThan(0)
      expect(left!.pan).toBeLessThan(0)
    }).pipe(Effect.provide(makeSoundLayer(fake.engine)))
  })

  it.effect('does not play sounds while disabled', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const soundManager = yield* SoundManager
      yield* soundManager.applySettings({ enabled: false, masterVolume: 1, sfxVolume: 1 })
      yield* soundManager.playEffect('playerHurt')
      expect(fake.playRequests).toHaveLength(0)
    }).pipe(Effect.provide(makeSoundLayer(fake.engine)))
  })
})
