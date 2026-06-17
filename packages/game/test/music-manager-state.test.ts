import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import * as Option from 'effect/Option'
import type { ToneHandle } from '../domain/audio-types'
import { resolveMusicPlaybackPlan, type ActiveTrack } from '../application/music-manager-state'

const makeActiveTrack = (environment: ActiveTrack['environment']): ActiveTrack => ({
  environment,
  handle: { id: 1 } as ToneHandle,
})

describe('audio/music-manager-state', () => {
  it('stops the active track when music is disabled', () => {
    const plan = resolveMusicPlaybackPlan({
      enabled: false,
      activeTrack: Option.some(makeActiveTrack('day')),
      environment: 'night',
    })

    expect(plan.shouldStopActiveTrack).toBe(true)
    expect(plan.environmentToPlay).toEqual(Option.none())
  })

  it('keeps the current track when the environment does not change', () => {
    const plan = resolveMusicPlaybackPlan({
      enabled: true,
      activeTrack: Option.some(makeActiveTrack('cave')),
      environment: 'cave',
    })

    expect(plan.shouldStopActiveTrack).toBe(false)
    expect(plan.environmentToPlay).toEqual(Option.none())
  })

  it('replaces the active track when the environment changes', () => {
    const plan = resolveMusicPlaybackPlan({
      enabled: true,
      activeTrack: Option.some(makeActiveTrack('day')),
      environment: 'night',
    })

    expect(plan.shouldStopActiveTrack).toBe(true)
    expect(plan.environmentToPlay).toEqual(Option.some('night'))
  })

  it('starts the requested environment when no track is active', () => {
    const plan = resolveMusicPlaybackPlan({
      enabled: true,
      activeTrack: Option.none(),
      environment: 'day',
    })

    expect(plan.shouldStopActiveTrack).toBe(false)
    expect(plan.environmentToPlay).toEqual(Option.some('day'))
  })
})
