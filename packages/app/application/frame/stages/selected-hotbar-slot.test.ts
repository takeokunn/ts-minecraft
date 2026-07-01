import { describe, expect, it } from 'vitest'
import { SlotIndex } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { selectedHotbarSlotIndex } from './selected-hotbar-slot'

// ─── selectedHotbarSlotIndex ──────────────────────────────────────────────────
describe('selectedHotbarSlotIndex', () => {
  it('maps selectedSlot=0 to HOTBAR_START', () => {
    const result = selectedHotbarSlotIndex(SlotIndex.make(0))
    expect(SlotIndex.toNumber(result)).toBe(HOTBAR_START)
  })

  it('maps selectedSlot=1 to HOTBAR_START + 1', () => {
    const result = selectedHotbarSlotIndex(SlotIndex.make(1))
    expect(SlotIndex.toNumber(result)).toBe(HOTBAR_START + 1)
  })

  it('maps selectedSlot=8 (last hotbar slot) to HOTBAR_START + 8', () => {
    const result = selectedHotbarSlotIndex(SlotIndex.make(8))
    expect(SlotIndex.toNumber(result)).toBe(HOTBAR_START + 8)
  })

  it('adds selectedSlot offset linearly to HOTBAR_START', () => {
    for (let i = 0; i < 9; i++) {
      const result = selectedHotbarSlotIndex(SlotIndex.make(i))
      expect(SlotIndex.toNumber(result)).toBe(HOTBAR_START + i)
    }
  })
})
