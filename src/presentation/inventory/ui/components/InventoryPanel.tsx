import { Effect, Match, pipe } from 'effect'
import type { JSX } from 'react'
import {
  InventoryClosed,
  InventoryEventHandler,
  InventoryGUIEvent,
  InventoryOpened,
  InventoryPanelModel,
  QuickMove,
  SlotClicked,
  slotIndexToNumber,
  type InventorySlot,
} from '../../adt'
import { ItemSlot } from './index'

interface InventoryPanelProps {
  readonly model: InventoryPanelModel
  readonly onEvent: InventoryEventHandler
}

const emit = (handler: InventoryEventHandler, event: InventoryGUIEvent) =>
  handler(event).pipe(
    Effect.catchAllCause((cause) => Effect.logError(cause)),
    Effect.asVoid,
    Effect.runSync
  )

const toggleEvent = (model: InventoryPanelModel) =>
  pipe(
    model.isOpen,
    Match.value,
    Match.when(true, () => InventoryClosed({})),
    Match.orElse(() => InventoryOpened({}))
  )

type PartitionedSlots = {
  readonly main: ReadonlyArray<InventorySlot>
  readonly hotbar: ReadonlyArray<InventorySlot>
}

const partitionSlots = (model: InventoryPanelModel): PartitionedSlots =>
  model.inventory.slots.reduce<PartitionedSlots>(
    (acc, slot) =>
      pipe(
        slot.section,
        Match.value,
        Match.when('hotbar', () => ({
          main: acc.main,
          hotbar: [...acc.hotbar, slot],
        })),
        Match.orElse(() => ({
          main: [...acc.main, slot],
          hotbar: acc.hotbar,
        }))
      ),
    { main: [], hotbar: [] }
  )

const slotKey = (slotIndex: number) => `slot-${slotIndex}`

export const InventoryPanel = ({ model, onEvent }: InventoryPanelProps): JSX.Element => {
  const { main, hotbar } = partitionSlots(model)

  const handleSelect = (slot: InventorySlot) => emit(onEvent, SlotClicked({ slot: slot.index, button: 'left' }))

  const handleQuickMove = (slot: InventorySlot) => emit(onEvent, QuickMove({ slot: slot.index }))

  const columns = `repeat(${model.config.columns}, 1fr)`
  const hotbarColumns = pipe(
    hotbar.length,
    Match.value,
    Match.when(0, () => 1),
    Match.orElse((count) => count)
  )

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
        data-testid="inventory-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          gap: `${model.config.slotSpacing}px`,
        }}
      >
        {main.map((slot) => (
          <div key={slotKey(slotIndexToNumber(slot.index))} data-slot-section="main">
            <ItemSlot slot={slot} theme={model.config.theme} onSelect={handleSelect} />
          </div>
        ))}
      </div>

      <div
        data-testid="inventory-hotbar-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${hotbarColumns}, 1fr)`,
          gap: `${model.config.slotSpacing}px`,
          borderTop: `1px solid ${model.config.theme.slotBorder}`,
          paddingTop: '1rem',
        }}
      >
        {hotbar.map((slot) => (
          <div
            key={slotKey(slotIndexToNumber(slot.index))}
            data-slot-section="hotbar"
            onDoubleClick={() => handleQuickMove(slot)}
          >
            <ItemSlot slot={slot} theme={model.config.theme} onSelect={handleSelect} />
          </div>
        ))}
      </div>
    </section>
  )
}
