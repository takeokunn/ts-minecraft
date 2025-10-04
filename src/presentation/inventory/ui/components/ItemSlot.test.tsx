
import { describe, expect, it } from '@effect/vitest'
import { fireEvent, render } from '@testing-library/react'
import { Effect, Option, Schema } from 'effect'
import { ItemSlot } from './ItemSlot'
import { makeInventorySlot, slotGridPosition, SlotIndexSchema, SlotTypeSchema } from '../../adt/inventory-adt'

describe('presentation/inventory/ui/ItemSlot', () => {
  it('renders item count and triggers selection', () => {
    const slotIndex = Effect.runSync(Schema.decode(SlotIndexSchema)(0))
    const slotType = Effect.runSync(Schema.decode(SlotTypeSchema)('normal'))
    const position = Effect.runSync(slotGridPosition({ index: 0, columns: 9, spacing: 2, slotSize: 32 }))
    const slot = makeInventorySlot({
      index: slotIndex,
      section: 'main',
      slotType,
      position,
      item: Option.none(),
      isDisabled: false,
      isHighlighted: true,
    })

    const theme = {
      ...makeTheme(),
      slotSelected: '#ff0000',
    }

    const selected: Array<number> = []

    const { getByRole } = render(
      <ItemSlot
        slot={slot}
        theme={theme}
        onSelect={(current) => selected.push(current.index)}
      />
    )

    fireEvent.click(getByRole('button'))

    expect(selected).toHaveLength(1)
    expect(selected[0]).toBe(slotIndex)
  })
})

const makeTheme = () => ({
  slotBackground: '#222222',
  slotBorder: '#333333',
  slotHover: '#444444',
  slotSelected: '#555555',
  slotDisabled: '#111111',
  itemCountColor: '#ffffff',
  itemDurabilityColor: '#00ff00',
  tooltipBackground: '#000000',
  tooltipText: '#ffffff',
})
