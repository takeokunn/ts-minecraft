import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  createInteractionStageRedstoneFlags,
  createPausedInteractionStageSnapshot,
  createActiveInteractionStageSnapshot,
} from './interaction-stage-snapshot-helpers'

// ─── createInteractionStageRedstoneFlags ──────────────────────────────────────

describe('createInteractionStageRedstoneFlags', () => {
  it('returns all-false flags when called with no overrides', () => {
    const flags = createInteractionStageRedstoneFlags()
    expect(flags.placeWire).toBe(false)
    expect(flags.placeLever).toBe(false)
    expect(flags.placeButton).toBe(false)
    expect(flags.placeTorch).toBe(false)
    expect(flags.placePiston).toBe(false)
    expect(flags.toggleLever).toBe(false)
    expect(flags.pressButton).toBe(false)
    expect(flags.toggleTorch).toBe(false)
  })

  it('applies partial overrides while keeping other flags false', () => {
    const flags = createInteractionStageRedstoneFlags({ placeWire: true, toggleLever: true })
    expect(flags.placeWire).toBe(true)
    expect(flags.toggleLever).toBe(true)
    expect(flags.placeLever).toBe(false)
  })
})

// ─── createPausedInteractionStageSnapshot ─────────────────────────────────────

describe('createPausedInteractionStageSnapshot', () => {
  it('sets paused to true', () => {
    expect(createPausedInteractionStageSnapshot({ totalTimeSecs: 0 }).paused).toBe(true)
  })

  it('sets all click flags to false', () => {
    const snap = createPausedInteractionStageSnapshot({ totalTimeSecs: 5 })
    expect(snap.leftClick).toBe(false)
    expect(snap.rightClick).toBe(false)
    expect(snap.middleClick).toBe(false)
    expect(snap.mouseHeld).toBe(false)
  })

  it('preserves totalTimeSecs from context', () => {
    expect(createPausedInteractionStageSnapshot({ totalTimeSecs: 42 }).totalTimeSecs).toBe(42)
  })

  it('sets selectedHotbarItem to None', () => {
    expect(Option.isNone(createPausedInteractionStageSnapshot({ totalTimeSecs: 0 }).selectedHotbarItem)).toBe(true)
  })
})

// ─── createActiveInteractionStageSnapshot ─────────────────────────────────────

describe('createActiveInteractionStageSnapshot', () => {
  const baseContext = {
    leftClick: true,
    mouseHeld: false,
    middleClick: false,
    rightClick: false,
    rightMouseHeld: false,
    redstoneFlags: createInteractionStageRedstoneFlags(),
    unequipArmor: false,
    isSpectator: false,
    isCreative: true,
    selectedHotbarItem: Option.none<string>() as any,
    breakProgressElementOrNull: null,
    bowChargeStart: 1.5,
    totalTimeSecs: 10,
  }

  it('sets paused to false', () => {
    expect(createActiveInteractionStageSnapshot(baseContext).paused).toBe(false)
  })

  it('propagates all input flags from context', () => {
    const snap = createActiveInteractionStageSnapshot(baseContext)
    expect(snap.leftClick).toBe(true)
    expect(snap.isCreative).toBe(true)
    expect(snap.bowChargeStart).toBe(1.5)
    expect(snap.totalTimeSecs).toBe(10)
  })
})
