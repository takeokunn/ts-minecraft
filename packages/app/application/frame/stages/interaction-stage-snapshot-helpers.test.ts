import { describe, it } from '@effect/vitest'
import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import { expect } from 'vitest'

import {
  createActiveInteractionStageSnapshot,
  createInteractionStageRedstoneFlags,
  createPausedInteractionStageSnapshot,
} from './interaction-stage-snapshot-helpers'

describe('interaction-stage-snapshot-helpers', () => {
  it('builds the paused snapshot with the expected inactive defaults', () => {
    expect(createPausedInteractionStageSnapshot({ totalTimeSecs: 12.5 })).toEqual({
      paused: true,
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
      bowChargeStart: null,
      totalTimeSecs: 12.5,
    })
  })

  it('keeps the active snapshot fields intact', () => {
    const progressElement = {} as HTMLElement
    const selectedHotbarItem = Option.some('BOW' as InventoryItem)

    expect(
      createActiveInteractionStageSnapshot({
        leftClick: true,
        mouseHeld: true,
        middleClick: false,
        rightClick: true,
        rightMouseHeld: true,
        redstoneFlags: createInteractionStageRedstoneFlags({
          placeWire: true,
          toggleTorch: true,
        }),
        unequipArmor: true,
        isSpectator: false,
        isCreative: true,
        selectedHotbarItem,
        breakProgressElementOrNull: progressElement,
        bowChargeStart: 4,
        totalTimeSecs: 12.5,
      }),
    ).toEqual({
      paused: false,
      leftClick: true,
      mouseHeld: true,
      middleClick: false,
      rightClick: true,
      rightMouseHeld: true,
      redstoneFlags: createInteractionStageRedstoneFlags({
        placeWire: true,
        toggleTorch: true,
      }),
      unequipArmor: true,
      isSpectator: false,
      isCreative: true,
      selectedHotbarItem,
      breakProgressElementOrNull: progressElement,
      bowChargeStart: 4,
      totalTimeSecs: 12.5,
    })
  })
})
