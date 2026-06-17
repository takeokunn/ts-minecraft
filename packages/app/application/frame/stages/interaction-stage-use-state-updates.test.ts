import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import type { InteractionStageSnapshot } from './interaction-stage-snapshot'
import type { InteractionStageIntent } from './interaction-stage-intent'
import { resolveInteractionStageUseStateRefUpdates } from './interaction-stage-use-state-updates'

const makeSnapshot = (overrides: Partial<InteractionStageSnapshot> = {}): InteractionStageSnapshot => ({
  paused: false,
  leftClick: false,
  mouseHeld: false,
  middleClick: false,
  rightClick: false,
  rightMouseHeld: false,
  redstoneFlags: {
    placeWire: false,
    placeLever: false,
    placeButton: false,
    placeTorch: false,
    placePiston: false,
    toggleLever: false,
    pressButton: false,
    toggleTorch: false,
  },
  unequipArmor: false,
  isSpectator: false,
  isCreative: false,
  selectedHotbarItem: Option.none<InventoryItem>(),
  breakProgressElementOrNull: null,
  bowChargeStart: null,
  totalTimeSecs: 0,
  ...overrides,
})

const makeIntent = (overrides: Partial<InteractionStageIntent> = {}): InteractionStageIntent => ({
  canInteract: true,
  shouldResetBreakProgress: false,
  selectedIsBow: false,
  selectedIsShield: false,
  shouldStartBowCharge: false,
  shouldClearBowCharge: false,
  shouldFireBowRelease: false,
  shouldBlockWithShield: false,
  shouldResetShieldBlocking: false,
  hasRedstoneInput: false,
  ...overrides,
})

describe('resolveInteractionStageUseStateRefUpdates', () => {
  it('keeps the previous bow charge when nothing changes', () => {
    const result = resolveInteractionStageUseStateRefUpdates(
      makeSnapshot({ bowChargeStart: 7.5, totalTimeSecs: 9 }),
      makeIntent(),
    )

    expect(result).toEqual({
      isShieldBlocking: false,
      bowChargeStart: 7.5,
    })
  })

  it('starts bow charge from the current frame time', () => {
    const result = resolveInteractionStageUseStateRefUpdates(
      makeSnapshot({ totalTimeSecs: 12.5, bowChargeStart: null }),
      makeIntent({ shouldStartBowCharge: true }),
    )

    expect(result.bowChargeStart).toBe(12.5)
  })

  it('clears bow charge when the release condition is met', () => {
    const result = resolveInteractionStageUseStateRefUpdates(
      makeSnapshot({ bowChargeStart: 12.5 }),
      makeIntent({ shouldClearBowCharge: true }),
    )

    expect(result.bowChargeStart).toBeNull()
  })
})
