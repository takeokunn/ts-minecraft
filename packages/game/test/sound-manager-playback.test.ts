import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import * as Option from 'effect/Option'
import { resolveSoundEffectPlaybackRequest } from '../application/sound-manager-playback'

describe('audio/sound-manager-playback', () => {
  it('returns none while disabled', () => {
    const result = resolveSoundEffectPlaybackRequest({
      effect: 'blockBreak',
      enabled: false,
      listenerPosition: { x: 0, y: 64, z: 0 },
      sfxVolume: 1,
      position: { x: 0, y: 64, z: 0 },
    })

    expect(Option.isNone(result)).toBe(true)
  })

  it('builds a non-spatial playback request with gain scaling', () => {
    const result = resolveSoundEffectPlaybackRequest({
      effect: 'blockBreak',
      enabled: true,
      listenerPosition: { x: 0, y: 64, z: 0 },
      sfxVolume: 0.5,
      gainScale: 0.5,
    })

    expect(Option.isSome(result)).toBe(true)
    const request = Option.getOrThrow(result)
    expect(request.gain).toBeCloseTo(0.1, 5)
    expect(request.pan).toBe(0)
    expect(request.position).toBeUndefined()
    expect(request.loop).toBe(false)
  })

  it('builds a spatial playback request with relative coordinates', () => {
    const result = resolveSoundEffectPlaybackRequest({
      effect: 'blockPlace',
      enabled: true,
      listenerPosition: { x: 0, y: 64, z: 0 },
      sfxVolume: 1,
      position: { x: 24, y: 64, z: 0 },
    })

    const request = Option.getOrThrow(result)
    expect(request.position).toEqual({ x: 24, y: 0, z: 0 })
    expect(request.pan).toBeGreaterThan(0)
    expect(request.gain).toBeLessThan(1)
  })
})
