import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, MutableRef } from 'effect'
import { AudioEnginePort, type AudioEnginePortShape, type ToneRequest } from '@ts-minecraft/game'
import { SoundManager, SoundManagerLive } from '@ts-minecraft/game'
import { SOUND_LIBRARY } from '../application/sound-manager.config'

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

const makeSoundLayer = (engine: AudioEnginePortShape) =>
  SoundManagerLive.pipe(
    Layer.provide(Layer.succeed(AudioEnginePort, engine)),
  )

describe('audio/sound-manager', () => {
  it.effect('plays sound effects with configured master/sfx volume', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const soundManager = yield* SoundManager
      yield* soundManager.applySettings({ enabled: true, masterVolume: 0.5, sfxVolume: 0.4 })
      yield* soundManager.playEffect('blockBreak')
      // masterVolume is applied by the engine's master gain NODE (0.5)...
      expect(fake.masterGains.at(-1)).toBeCloseTo(0.5, 5)
      expect(fake.playRequests.length).toBe(1)
      expect(fake.playRequests[0]!.loop).toBe(false)
      // ...so the per-tone gain carries only baseGain(0.4) × sfxVolume(0.4) = 0.16.
      // (Effective = 0.16 × 0.5 = 0.08; previously masterVolume was multiplied
      // in BOTH places → 0.04, i.e. squared — the bug this asserts is fixed.)
      expect(fake.playRequests[0]!.gain).toBeCloseTo(0.16, 4)
    }).pipe(Effect.provide(makeSoundLayer(fake.engine)))
  })

  it.effect('applies positional attenuation and 3D coordinates for playback', () => {
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
      expect(near!.position).toEqual({ x: 0, y: 0, z: 0 })
      expect(farRight!.position).toEqual({ x: 24, y: 0, z: 0 })
      expect(left!.position).toEqual({ x: -12, y: 0, z: 0 })

      // Co-located (distance 0): attenuation = 1/(1+0) = 1 → full gain
      // (blockPlace baseGain 0.32 × sfx 1), and pan centred at 0.
      expect(near!.gain).toBeCloseTo(0.32, 4)
      expect(near!.pan).toBeCloseTo(0, 5)
      // dx=24 → attenuation 1/(1+24/12) = 1/3 → 0.32/3; pan = clamp(24/12=2) → 1.
      expect(farRight!.gain).toBeCloseTo(0.32 / 3, 4)
      expect(farRight!.pan).toBeCloseTo(1, 5)
    }).pipe(Effect.provide(makeSoundLayer(fake.engine)))
  })

  it.effect('routes mob vocalizations (mobHurt/mobDeath) through playEffect with the configured synth + spatial gain', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const soundManager = yield* SoundManager
      yield* soundManager.applySettings({ enabled: true, masterVolume: 1, sfxVolume: 1 })
      yield* soundManager.setListenerPosition({ x: 0, y: 64, z: 0 })

      // mobHurt co-located (distance 0 → attenuation 1 → full per-tone gain).
      yield* soundManager.playEffect('mobHurt', { position: { x: 0, y: 64, z: 0 } })
      // mobDeath off to the right (dx=24 → attenuation 1/(1+24/12)=1/3; pan clamps to 1).
      yield* soundManager.playEffect('mobDeath', { position: { x: 24, y: 64, z: 0 } })

      const hurt = fake.playRequests[0]
      const death = fake.playRequests[1]
      expect(fake.playRequests).toHaveLength(2)
      expect(hurt).toBeDefined()
      expect(death).toBeDefined()

      // Identity comes ONLY from SOUND_LIBRARY — no hardcoded frequencies/waves.
      expect(hurt!.frequency).toBe(SOUND_LIBRARY.mobHurt.frequency)
      expect(hurt!.wave).toBe(SOUND_LIBRARY.mobHurt.wave)
      expect(hurt!.loop).toBe(false)
      // sfx=1, attenuation=1 → finalGain = baseGain.
      expect(hurt!.gain).toBeCloseTo(SOUND_LIBRARY.mobHurt.baseGain, 4)
      expect(hurt!.pan).toBeCloseTo(0, 5)
      expect(hurt!.position).toEqual({ x: 0, y: 0, z: 0 })

      expect(death!.frequency).toBe(SOUND_LIBRARY.mobDeath.frequency)
      expect(death!.wave).toBe(SOUND_LIBRARY.mobDeath.wave)
      expect(death!.loop).toBe(false)
      // dx=24 → attenuation 1/3 → finalGain = baseGain/3; pan = clamp(2) → 1.
      expect(death!.gain).toBeCloseTo(SOUND_LIBRARY.mobDeath.baseGain / 3, 4)
      expect(death!.pan).toBeCloseTo(1, 5)
      expect(death!.position).toEqual({ x: 24, y: 0, z: 0 })
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

  it.effect('getState returns the current enabled flag, volumes, and listener position', () => {
    const fake = makeFakeAudioEngine()
    return Effect.gen(function* () {
      const soundManager = yield* SoundManager
      yield* soundManager.applySettings({ enabled: true, masterVolume: 0.7, sfxVolume: 0.3 })
      yield* soundManager.setListenerPosition({ x: 5, y: 64, z: -3 })
      const state = yield* soundManager.getState()
      expect(state.enabled).toBe(true)
      expect(state.masterVolume).toBeCloseTo(0.7, 5)
      expect(state.sfxVolume).toBeCloseTo(0.3, 5)
      expect(state.listenerPosition).toEqual({ x: 5, y: 64, z: -3 })
    }).pipe(Effect.provide(makeSoundLayer(fake.engine)))
  })
})
