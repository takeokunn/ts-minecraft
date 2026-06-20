import { describe, it } from '@effect/vitest'
import { Option } from 'effect'
import { expect } from 'vitest'
import type { InventoryItem } from '@ts-minecraft/core'
import { renderSlotElements } from './inventory-renderer-refresh'

const makeSlotElement = (): HTMLDivElement => {
  const attributes = new Map<string, string>()
  return {
    dataset: {},
    style: { cssText: '' },
    textContent: '',
    title: '',
    setAttribute: (name: string, value: string) => {
      attributes.set(name, value)
    },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    removeAttribute: (name: string) => {
      attributes.delete(name)
    },
  } as unknown as HTMLDivElement
}

describe('presentation/inventory/inventory-renderer-refresh', () => {
  it('adds a readable item hover tooltip with enchantments', () => {
    const slotEl = makeSlotElement()

    renderSlotElements(
      [slotEl],
      [
        Option.some({
          itemType: 'DIAMOND_SWORD' as InventoryItem,
          count: 1,
          enchantments: [
            { type: 'SHARPNESS', level: 4 },
            { type: 'MENDING', level: 1 },
          ] as const,
        }),
      ],
      -1,
    )

    expect(slotEl.title).toBe('Diamond Sword\nCount: 1\nEnchantments:\nSharpness IV\nMending I')
    expect(slotEl.dataset['tooltip']).toBe(slotEl.title)
    expect(slotEl.getAttribute('aria-label')).toBe('Diamond Sword, Count: 1, Enchantments:, Sharpness IV, Mending I')
  })

  it('clears a stale tooltip when a slot becomes empty', () => {
    const slotEl = makeSlotElement()

    renderSlotElements(
      [slotEl],
      [Option.some({ itemType: 'DIRT' as InventoryItem, count: 64 })],
      -1,
    )
    expect(slotEl.title).toBe('Dirt\nCount: 64')

    renderSlotElements([slotEl], [Option.none()], -1)

    expect(slotEl.title).toBe('')
    expect(slotEl.dataset['tooltip']).toBeUndefined()
    expect(slotEl.getAttribute('aria-label')).toBeNull()
  })
})
