import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { resolveMusicPlaybackPlan } from '../application/music-manager-state'
import type { ActiveTrack } from '../application/music-manager-state'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const noTrack: Option.Option<ActiveTrack> = Option.none()
const dayTrack: ActiveTrack = { environment: 'day', handle: {} as any }
const nightTrack: ActiveTrack = { environment: 'night', handle: {} as any }

// ─── resolveMusicPlaybackPlan — disabled ──────────────────────────────────────

describe('resolveMusicPlaybackPlan — music disabled', () => {
  it('should stop active track when disabled', () => {
    const plan = resolveMusicPlaybackPlan({ enabled: false, activeTrack: Option.some(dayTrack), environment: 'day' })
    expect(plan.shouldStopActiveTrack).toBe(true)
  })

  it('should not stop anything when disabled with no active track', () => {
    const plan = resolveMusicPlaybackPlan({ enabled: false, activeTrack: noTrack, environment: 'day' })
    expect(plan.shouldStopActiveTrack).toBe(false)
  })

  it('never starts a new track when disabled', () => {
    const plan = resolveMusicPlaybackPlan({ enabled: false, activeTrack: noTrack, environment: 'day' })
    expect(Option.isNone(plan.environmentToPlay)).toBe(true)
  })
})

// ─── resolveMusicPlaybackPlan — same environment ──────────────────────────────

describe('resolveMusicPlaybackPlan — same environment already playing', () => {
  it('does not stop or restart when the correct track is already playing', () => {
    const plan = resolveMusicPlaybackPlan({ enabled: true, activeTrack: Option.some(dayTrack), environment: 'day' })
    expect(plan.shouldStopActiveTrack).toBe(false)
    expect(Option.isNone(plan.environmentToPlay)).toBe(true)
  })
})

// ─── resolveMusicPlaybackPlan — environment change ────────────────────────────

describe('resolveMusicPlaybackPlan — environment change', () => {
  it('stops the old track and starts the new environment', () => {
    const plan = resolveMusicPlaybackPlan({ enabled: true, activeTrack: Option.some(dayTrack), environment: 'night' })
    expect(plan.shouldStopActiveTrack).toBe(true)
    expect(Option.getOrNull(plan.environmentToPlay)).toBe('night')
  })

  it('starts first track with no stop when no track is playing', () => {
    const plan = resolveMusicPlaybackPlan({ enabled: true, activeTrack: noTrack, environment: 'day' })
    expect(plan.shouldStopActiveTrack).toBe(false)
    expect(Option.getOrNull(plan.environmentToPlay)).toBe('day')
  })
})
