
import { Effect, Match, pipe } from 'effect'
import type { JSX } from 'react'
import {
  InventoryClosed,
  InventoryEventHandler,
  InventoryOpened,
  InventoryPanelModel,
  InventoryGUIEvent,
  QuickMove,
  SlotClicked,
  slotIndexToNumber,
} from '../../adt/inventory-adt'
import { ItemSlot } from './ItemSlot'

interface InventoryPanelProps {
  readonly model: InventoryPanelModel
  readonly onEvent: InventoryEventHandler
}

const emit = (handler: InventoryEventHandler, event: InventoryGUIEvent) =>
  handler(event)
    .pipe(Effect.catchAll((error) => Effect.logError(error)))
    .pipe(Effect.runFork)

const isHotbarSlot = (slotType: SlotType) => slotType === 'normal'

const toggleEvent = (model: InventoryPanelModel) =>
  pipe(
    model.isOpen,
    Match.value,
    Match.when(true, () => InventoryClosed({})),
    Match.orElse(() => InventoryOpened({}))
  )

const partitionSlots = (model: InventoryPanelModel) => {
  const main: typeof model.inventory.slots = []
  const hotbar: typeof model.inventory.slots = []

  model.inventory.slots.forEach((slot) => {
    const target = pipe(
      slot.section,
      Match.value,
      Match.when('hotbar', () => hotbar),
      Match.orElse(() => main)
    )
    target.push(slot)
  })

  return { main, hotbar }
}

const slotKey = (slotIndex: number) => `slot-${slotIndex}`

export const InventoryPanel = ({ model, onEvent }: InventoryPanelProps): JSX.Element => {
  const { main, hotbar } = partitionSlots(model)

  const handleSelect = (slot: typeof model.inventory.slots[number]) =>
    emit(onEvent, SlotClicked({ slot: slot.index, button: 'left' }))

  const handleQuickMove = (slot: typeof model.inventory.slots[number]) =>
    emit(onEvent, QuickMove({ slot: slot.index }))

  const columns = `repeat(${model.config.columns}, 1fr)`

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: 'rgba(16, 16, 16, 0.8)',
        borderRadius: '12px',
        border: `1px solid ${model.config.theme.slotBorder}`,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0 }}>Inventory</h2>
        <button
          type="button"
          onClick={() => emit(onEvent, toggleEvent(model))}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {pipe(
            model.isOpen,
            Match.value,
            Match.when(true, () => 'Close'),
            Match.orElse(() => 'Open')
          )}
        </button>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          gap: `${model.config.slotSpacing}px`,
        }}
      >
        {main.map((slot) => (
          <div key={slotKey(slotIndexToNumber(slot.index))}>
            <ItemSlot slot={slot} theme={model.config.theme} onSelect={handleSelect} />
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${hotbar.length || 1}, 1fr)`,
          gap: `${model.config.slotSpacing}px`,
          borderTop: `1px solid ${model.config.theme.slotBorder}`,
          paddingTop: '1rem',
        }}
      >
        {hotbar.map((slot) => (
          <div
            key={slotKey(slotIndexToNumber(slot.index))}
            onDoubleClick={() => handleQuickMove(slot)}
          >
            <ItemSlot slot={slot} theme={model.config.theme} onSelect={handleSelect} />
          </div>
        ))}
      </div>
    </section>
  )
}
