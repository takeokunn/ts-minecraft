import { describe, it } from '@effect/vitest'
import { Option } from 'effect'
import { expect } from 'vitest'
import { InventoryItem, SlotIndex, StackCount } from '@ts-minecraft/core'
import type { HotbarSlotStack } from '@ts-minecraft/inventory/application/hotbar-service'
import {
  EMPTY_HOTBAR_VALUES,
  captureSlotValues,
  resolveHotbarUpdate,
  slotsMatchSnapshot,
  type HotbarState,
} from '@ts-minecraft/presentation/hud'

const stack = (itemType: InventoryItem, count = 1): Option.Option<HotbarSlotStack> =>
  Option.some({ itemType, count: StackCount.make(count) })

describe('hotbar-three-state', () => {
  it('captures a fixed 9-slot snapshot from sparse slot input', () => {
    const slots: ReadonlyArray<Option.Option<HotbarSlotStack>> = [
      stack('STONE', 7),
      Option.none(),
      stack('DIRT'),
    ]

    expect(captureSlotValues(slots)).toEqual([
      { item: 'STONE', count: 7 },
      null,
      { item: 'DIRT', count: 1 },
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
      stack('STONE', 3),
      Option.none(),
      stack('DIRT'),
    ])

    expect(slotsMatchSnapshot([
      stack('STONE', 3),
      Option.none(),
      stack('DIRT'),
    ], current)).toBe(true)

    expect(slotsMatchSnapshot([
      stack('STONE', 3),
      stack('DIRT'),
      stack('DIRT'),
    ], current)).toBe(false)
  })

  it('detects a pure stack-count change as slotsChanged (badge must re-render)', () => {
    const current = captureSlotValues([stack('STONE', 8)])

    expect(slotsMatchSnapshot([stack('STONE', 8)], current)).toBe(true)
    expect(slotsMatchSnapshot([stack('STONE', 7)], current)).toBe(false)
  })

  it('resolves a first render as changed and a repeated render as unchanged', () => {
    const slots: ReadonlyArray<Option.Option<HotbarSlotStack>> = [
      stack('STONE', 5),
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
    expect(firstDecision.selectedItem).toEqual({ item: 'STONE', count: 5 })
    expect(firstDecision.nextState.hasState).toBe(true)

    const secondDecision = resolveHotbarUpdate(slots, SlotIndex.make(0), firstDecision.nextState)
    expect(secondDecision.unchanged).toBe(true)
    expect(secondDecision.slotsChanged).toBe(false)
    expect(secondDecision.heldItemChanged).toBe(false)
    expect(secondDecision.shouldShowItemName).toBe(false)
  })

  it('a count-only change re-renders slots but keeps the held-item model (same item)', () => {
    const initial = resolveHotbarUpdate([stack('STONE', 8)], SlotIndex.make(0), {
      slots: EMPTY_HOTBAR_VALUES,
      selectedIndex: 0,
      selectedItemKey: '',
      hasState: false,
    })

    const afterPlace = resolveHotbarUpdate([stack('STONE', 7)], SlotIndex.make(0), initial.nextState)
    expect(afterPlace.slotsChanged).toBe(true)
    expect(afterPlace.unchanged).toBe(false)
    expect(afterPlace.heldItemChanged).toBe(false)
    expect(afterPlace.shouldShowItemName).toBe(false)
  })
})
