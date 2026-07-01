import { Option } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  shouldRunInteractionStageUseTargetActions,
} from '../application/frame/stages/interaction-stage-use-target-actions-helpers'
import {
  createActiveInteractionStageSnapshot,
  createInteractionStageRedstoneFlags,
} from '../application/frame/stages/interaction-stage-snapshot-helpers'
import type { InteractionStageIntent } from '../application/frame/stages/interaction-stage-intent'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const makeSnapshot = (rightClick: boolean) =>
  createActiveInteractionStageSnapshot({
    leftClick: false,
    mouseHeld: false,
    middleClick: false,
    rightClick,
    rightMouseHeld: false,
    redstoneFlags: createInteractionStageRedstoneFlags(),
    unequipArmor: false,
    isSpectator: false,
    isCreative: false,
    selectedHotbarItem: Option.none(),
    breakProgressElementOrNull: null,
    bowChargeStart: null,
    totalTimeSecs: 0,
  })

const makeIntent = (selectedIsBow: boolean): InteractionStageIntent => ({
  hasRedstoneInput: false,
  canInteract: true,
  selectedIsShield: false,
  selectedIsBow,
  shouldResetBreakProgress: true,
  shouldResetShieldBlocking: true,
  shouldFireBowRelease: false,
  shouldStartBowCharge: false,
  shouldClearBowCharge: false,
  shouldBlockWithShield: false,
})

// ─── shouldRunInteractionStageUseTargetActions ─────────────────────────────────

describe('shouldRunInteractionStageUseTargetActions', () => {
  it('returns true when rightClick=true and bow not selected', () => {
    expect(shouldRunInteractionStageUseTargetActions(makeSnapshot(true), makeIntent(false))).toBe(true)
  })

  it('returns false when rightClick=false regardless of bow', () => {
    expect(shouldRunInteractionStageUseTargetActions(makeSnapshot(false), makeIntent(false))).toBe(false)
  })

  it('returns false when bow is selected even with rightClick=true', () => {
    expect(shouldRunInteractionStageUseTargetActions(makeSnapshot(true), makeIntent(true))).toBe(false)
  })

  it('returns false when both conditions are false', () => {
    expect(shouldRunInteractionStageUseTargetActions(makeSnapshot(false), makeIntent(true))).toBe(false)
  })
})
