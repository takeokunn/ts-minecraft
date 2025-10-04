
import { describe, expect, it } from '@effect/vitest'
import { fireEvent, render } from '@testing-library/react'
import { Effect, Option, Schema } from 'effect'
import {
  InventoryPanel,
} from './InventoryPanel'
import {
  InventoryEventHandler,
  InventoryPanelModel,
  InventoryView,
  SlotIndexSchema,
  SlotTypeSchema,
  defaultInventoryGUIConfig,
  makeInventorySlot,
  parsePlayerId,
  slotGridPosition,
} from '../../adt/inventory-adt'

const createModel = () => {
  const playerId = Effect.runSync(parsePlayerId('player-ui'))
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
    isHighlighted: false,
  })
  const view: InventoryView = {
    playerId,
    slots: [slot],
    hotbar: [slotIndex],
    selectedSlot: slotIndex,
    armor: {
      helmet: Option.none(),
      chestplate: Option.none(),
      leggings: Option.none(),
      boots: Option.none(),
    },
    offhand: Option.none(),
  }
  const model: InventoryPanelModel = {
    playerId,
    inventory: view,
    config: defaultInventoryGUIConfig,
    isOpen: true,
  }
  return model
}

describe('presentation/inventory/ui/InventoryPanel', () => {
  it('emits events for slot interaction and toggling', async () => {
    const model = createModel()
    const events: Array<string> = []
    const handler: InventoryEventHandler = (event) => {
      events.push(event._tag)
      return Effect.unit
    }

    const { getAllByRole, getByText } = render(
      <InventoryPanel model={model} onEvent={handler} />
    )

    const [slotButton] = getAllByRole('button')
    fireEvent.click(slotButton)
    fireEvent.doubleClick(slotButton)

    await new Promise((resolve) => setTimeout(resolve, 0))

    fireEvent.click(getByText('Close'))

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(events).toContain('SlotClicked')
    expect(events).toContain('QuickMove')
    expect(events).toContain('InventoryClosed')
  })
})
