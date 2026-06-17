import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'

import {
  resolveInteractionStageIntent,
} from './interaction-stage-intent'
import type { InteractionStageSnapshot } from './interaction-stage-snapshot'

const makeSnapshot = (
  overrides: Partial<InteractionStageSnapshot> = {},
): InteractionStageSnapshot => ({
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

describe('resolveInteractionStageIntent', () => {
  it('treats any redstone input as interactable and keeps break progress reset when the mouse is not held', () => {
    const intent = resolveInteractionStageIntent(
      makeSnapshot({
        redstoneFlags: { ...makeSnapshot().redstoneFlags, placeButton: true },
      }),
    )

    expect(intent.hasRedstoneInput).toBe(true)
    expect(intent.canInteract).toBe(true)
    expect(intent.shouldResetBreakProgress).toBe(true)
  })

  it('recognizes bow selection and starts charging only while right mouse is held with no prior charge', () => {
    const intent = resolveInteractionStageIntent(
      makeSnapshot({
        rightMouseHeld: true,
        selectedHotbarItem: Option.some('BOW' as InventoryItem),
      }),
    )

    expect(intent.selectedIsBow).toBe(true)
    expect(intent.selectedIsShield).toBe(false)
    expect(intent.shouldStartBowCharge).toBe(true)
    expect(intent.shouldBlockWithShield).toBe(false)
    expect(intent.shouldClearBowCharge).toBe(false)
  })

  it('fires bow release and clears charge once the bow is no longer selected and the mouse is released', () => {
    const intent = resolveInteractionStageIntent(
      makeSnapshot({
        rightMouseHeld: false,
        selectedHotbarItem: Option.some('STONE' as InventoryItem),
        bowChargeStart: 12.5,
      }),
    )

    expect(intent.shouldFireBowRelease).toBe(true)
    expect(intent.shouldClearBowCharge).toBe(true)
    expect(intent.shouldStartBowCharge).toBe(false)
  })

  it('suppresses interaction while paused or spectating', () => {
    const pausedIntent = resolveInteractionStageIntent(
      makeSnapshot({
        paused: true,
        leftClick: true,
        bowChargeStart: 1,
        rightMouseHeld: false,
      }),
    )
    const spectatorIntent = resolveInteractionStageIntent(
      makeSnapshot({
        isSpectator: true,
        rightMouseHeld: true,
        selectedHotbarItem: Option.some('SHIELD' as InventoryItem),
      }),
    )

    expect(pausedIntent.canInteract).toBe(false)
    expect(pausedIntent.shouldFireBowRelease).toBe(false)
    expect(pausedIntent.shouldResetShieldBlocking).toBe(true)

    expect(spectatorIntent.canInteract).toBe(false)
    expect(spectatorIntent.shouldResetShieldBlocking).toBe(true)
    expect(spectatorIntent.shouldBlockWithShield).toBe(true)
  })
})
