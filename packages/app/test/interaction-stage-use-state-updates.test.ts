import { Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { resolveInteractionStageUseStateRefUpdates } from '../application/frame/stages/interaction-stage-use-state-updates'
import {
  createActiveInteractionStageSnapshot,
  createInteractionStageRedstoneFlags,
} from '../application/frame/stages/interaction-stage-snapshot-helpers'
import type { InteractionStageIntent } from '../application/frame/stages/interaction-stage-intent'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const makeSnapshot = (overrides: { bowChargeStart?: number | null; totalTimeSecs?: number } = {}) =>
  createActiveInteractionStageSnapshot({
    leftClick: false,
    mouseHeld: false,
    middleClick: false,
    rightClick: false,
    rightMouseHeld: false,
    redstoneFlags: createInteractionStageRedstoneFlags(),
    unequipArmor: false,
    isSpectator: false,
    isCreative: false,
    selectedHotbarItem: Option.none(),
    breakProgressElementOrNull: null,
    bowChargeStart: overrides.bowChargeStart ?? null,
    totalTimeSecs: overrides.totalTimeSecs ?? 10,
  })

const makeIntent = (overrides: Partial<InteractionStageIntent> = {}): InteractionStageIntent => ({
  hasRedstoneInput: false,
  canInteract: true,
  selectedIsShield: false,
  selectedIsBow: false,
  shouldResetBreakProgress: false,
  shouldResetShieldBlocking: false,
  shouldFireBowRelease: false,
  shouldStartBowCharge: false,
  shouldClearBowCharge: false,
  shouldBlockWithShield: false,
  ...overrides,
})

// ─── resolveInteractionStageUseStateRefUpdates ─────────────────────────────────

describe('resolveInteractionStageUseStateRefUpdates — shield blocking', () => {
  it('sets isShieldBlocking=true when shouldBlockWithShield=true', () => {
    const result = resolveInteractionStageUseStateRefUpdates(
      makeSnapshot(),
      makeIntent({ shouldBlockWithShield: true }),
    )
    expect(result.isShieldBlocking).toBe(true)
  })

  it('sets isShieldBlocking=false when shouldBlockWithShield=false', () => {
    const result = resolveInteractionStageUseStateRefUpdates(
      makeSnapshot(),
      makeIntent({ shouldBlockWithShield: false }),
    )
    expect(result.isShieldBlocking).toBe(false)
  })
})

describe('resolveInteractionStageUseStateRefUpdates — bow charge start', () => {
  it('captures totalTimeSecs when shouldStartBowCharge=true', () => {
    const result = resolveInteractionStageUseStateRefUpdates(
      makeSnapshot({ totalTimeSecs: 42, bowChargeStart: null }),
      makeIntent({ shouldStartBowCharge: true }),
    )
    expect(result.bowChargeStart).toBe(42)
  })

  it('clears bowChargeStart to null when shouldClearBowCharge=true', () => {
    const result = resolveInteractionStageUseStateRefUpdates(
      makeSnapshot({ bowChargeStart: 15 }),
      makeIntent({ shouldClearBowCharge: true }),
    )
    expect(result.bowChargeStart).toBeNull()
  })

  it('preserves existing bowChargeStart when neither start nor clear flag is set', () => {
    const result = resolveInteractionStageUseStateRefUpdates(
      makeSnapshot({ bowChargeStart: 7 }),
      makeIntent(),
    )
    expect(result.bowChargeStart).toBe(7)
  })

  it('returns null when bowChargeStart is null and no charge flags', () => {
    const result = resolveInteractionStageUseStateRefUpdates(
      makeSnapshot({ bowChargeStart: null }),
      makeIntent(),
    )
    expect(result.bowChargeStart).toBeNull()
  })

  it('shouldStartBowCharge takes priority over shouldClearBowCharge', () => {
    // Both flags set simultaneously — start wins (ternary short-circuits to start branch)
    const result = resolveInteractionStageUseStateRefUpdates(
      makeSnapshot({ totalTimeSecs: 99, bowChargeStart: null }),
      makeIntent({ shouldStartBowCharge: true, shouldClearBowCharge: true }),
    )
    expect(result.bowChargeStart).toBe(99)
  })
})
