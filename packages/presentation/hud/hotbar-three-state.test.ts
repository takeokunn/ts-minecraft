import { describe, it } from '@effect/vitest'
import { Option } from 'effect'
import { expect } from 'vitest'
import { InventoryItem, SlotIndex } from '@ts-minecraft/core'
import {
  EMPTY_HOTBAR_VALUES,
  captureSlotValues,
  resolveHotbarUpdate,
  slotsMatchSnapshot,
  type HotbarState,
} from '@ts-minecraft/presentation/hud'

describe('hotbar-three-state', () => {
  it('captures a fixed 9-slot snapshot from sparse slot input', () => {
    const slots: ReadonlyArray<Option.Option<InventoryItem>> = [
      Option.some('STONE' as InventoryItem),
      Option.none(),
      Option.some('DIRT' as InventoryItem),
    ]

    expect(captureSlotValues(slots)).toEqual([
      'STONE',
      null,
      'DIRT',
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it('matches only when all normalized slots are identical', () => {
    const current = captureSlotValues([
      Option.some('STONE' as InventoryItem),
      Option.none(),
      Option.some('DIRT' as InventoryItem),
    ])

    expect(slotsMatchSnapshot([
      Option.some('STONE' as InventoryItem),
      Option.none(),
      Option.some('DIRT' as InventoryItem),
    ], current)).toBe(true)

    expect(slotsMatchSnapshot([
      Option.some('STONE' as InventoryItem),
      Option.some('DIRT' as InventoryItem),
      Option.some('DIRT' as InventoryItem),
    ], current)).toBe(false)
  })

  it('resolves a first render as changed and a repeated render as unchanged', () => {
    const slots: ReadonlyArray<Option.Option<InventoryItem>> = [
      Option.some('STONE' as InventoryItem),
      Option.none(),
      Option.none(),
      Option.none(),
      Option.none(),
      Option.none(),
      Option.none(),
      Option.none(),
      Option.none(),
    ]

    const initialState: HotbarState = {
      slots: EMPTY_HOTBAR_VALUES,
      selectedIndex: 0,
      selectedItemKey: '',
      hasState: false,
    }

    const firstDecision = resolveHotbarUpdate(slots, SlotIndex.make(0), initialState)
    expect(firstDecision.unchanged).toBe(false)
    expect(firstDecision.slotsChanged).toBe(true)
    expect(firstDecision.heldItemChanged).toBe(true)
    expect(firstDecision.selectedItem).toBe('STONE')
    expect(firstDecision.nextState.hasState).toBe(true)

    const secondDecision = resolveHotbarUpdate(slots, SlotIndex.make(0), firstDecision.nextState)
    expect(secondDecision.unchanged).toBe(true)
    expect(secondDecision.slotsChanged).toBe(false)
    expect(secondDecision.heldItemChanged).toBe(false)
    expect(secondDecision.shouldShowItemName).toBe(false)
  })
})
