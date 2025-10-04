
import { Effect, Match, pipe } from 'effect'
import * as RA from 'effect/Array'
import type { JSX } from 'react'
import {
  DomainFailureError,
  InventoryClosed,
  InventoryEventHandler,
  InventoryOpened,
  InventoryPanelModel,
  InventoryGUIEvent,
  InventoryGUIError,
  QuickMove,
  SlotClicked,
  slotIndexToNumber,
} from '../../adt/inventory-adt'
import { ItemSlot } from './item-slot'
import { ensureEffect } from '@shared-kernel/effect'

interface InventoryPanelProps {
  readonly model: InventoryPanelModel
  readonly onEvent: InventoryEventHandler
}

const emit = (handler: InventoryEventHandler, event: InventoryGUIEvent) =>
  pipe(
    ensureEffect<
      void,
      InventoryGUIError,
      never
    >({
      candidate: handler(event),
      onInvalid: () =>
        Effect.fail(
          DomainFailureError({
            message: 'InventoryEventHandler は Effect.Effect を返却する必要があります',
          })
        ),
    }),
    Effect.catchAll((error) => Effect.logError(error)),
    Effect.runFork
  )

const toggleEvent = (model: InventoryPanelModel) =>
  pipe(
    model.isOpen,
    Match.value,
    Match.when(true, () => InventoryClosed({})),
    Match.orElse(() => InventoryOpened({}))
  )

const partitionSlots = (model: InventoryPanelModel) =>
  pipe(
    model.inventory.slots,
    RA.reduce(
      { main: [] as typeof model.inventory.slots, hotbar: [] as typeof model.inventory.slots },
      (accumulator, slot) =>
        pipe(
          slot.section,
          Match.value,
          Match.when('hotbar', () => ({
            main: accumulator.main,
            hotbar: pipe(accumulator.hotbar, RA.append(slot)),
          })),
          Match.orElse(() => ({
            main: pipe(accumulator.main, RA.append(slot)),
            hotbar: accumulator.hotbar,
          }))
        )
    )
  )

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
          role="switch"
          aria-checked={model.isOpen}
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
            <ItemSlot
              slot={slot}
              theme={model.config.theme}
              onSelect={handleSelect}
              onQuickMove={handleQuickMove}
            />
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
          >
            <ItemSlot
              slot={slot}
              theme={model.config.theme}
              onSelect={handleSelect}
              onQuickMove={handleQuickMove}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
