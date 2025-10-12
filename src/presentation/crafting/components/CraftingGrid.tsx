import type { JSX } from 'react'

import type { CraftingGridView, CraftingSlotView } from '../types'

interface CraftingGridProps {
  readonly view: CraftingGridView
  readonly onSelectSlot?: (slot: CraftingSlotView) => void
}

const slotKey = (slot: CraftingSlotView) => `${slot.coordinate.x}-${slot.coordinate.y}`

const slotStyle = (slot: CraftingSlotView) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.25rem',
  borderRadius: '10px',
  border: slot.highlighted ? '2px solid #34d399' : '1px solid rgba(148, 163, 184, 0.25)',
  background: 'rgba(15, 23, 42, 0.6)',
  color: '#e2e8f0',
  padding: '0.75rem 0.5rem',
  minWidth: '4rem',
  minHeight: '4rem',
  cursor: 'pointer',
})

export const CraftingGrid = ({ view, onSelectSlot }: CraftingGridProps): JSX.Element => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${view.width}, minmax(4rem, 1fr))`,
      gridTemplateRows: `repeat(${view.height}, minmax(4rem, 1fr))`,
      gap: '0.75rem',
    }}
  >
    {view.slots.map((slot) => (
      <button key={slotKey(slot)} type="button" onClick={() => onSelectSlot?.(slot)} style={slotStyle(slot)}>
        {slot.itemName ? <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{slot.itemName}</span> : null}
        {slot.itemId ? (
          <span style={{ fontSize: '0.7rem', opacity: 0.65 }}>{slot.itemId}</span>
        ) : (
          <span style={{ fontSize: '0.7rem', opacity: 0.35 }}>Empty</span>
        )}
        {slot.quantity ? <span style={{ fontSize: '0.8rem' }}>x{slot.quantity}</span> : null}
      </button>
    ))}
  </div>
)
