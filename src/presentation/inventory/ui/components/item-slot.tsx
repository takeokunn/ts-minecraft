import type { JSX } from 'react'

import { Match, Option, pipe } from 'effect'
import type { InventorySlot, InventoryTheme } from '../../adt/inventory-adt'

export interface ItemSlotProps {
  readonly slot: InventorySlot
  readonly theme: InventoryTheme
  readonly onSelect: (slot: InventorySlot) => void
  readonly onQuickMove?: (slot: InventorySlot) => void
}

export const ItemSlot = ({ slot, theme, onSelect, onQuickMove }: ItemSlotProps): JSX.Element => {
  const background = pipe(
    slot.visual.isDisabled,
    Match.value,
    Match.when(true, () => theme.slotDisabled),
    Match.orElse(() =>
      pipe(
        slot.visual.isHighlighted,
        Match.value,
        Match.when(true, () => theme.slotSelected),
        Match.orElse(() => theme.slotBackground)
      )
    )
  )

  const border = pipe(
    slot.visual.isHighlighted,
    Match.value,
    Match.when(true, () => `2px solid ${theme.slotHover}`),
    Match.orElse(() => `1px solid ${theme.slotBorder}`)
  )

  const handleClick = () => onSelect(slot)
  const handleDoubleClick = () =>
    pipe(
      onQuickMove,
      Option.fromNullable,
      Option.match({
        onNone: () => undefined,
        onSome: (handler) => handler(slot),
      })
    )

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
        border,
        cursor: 'pointer',
        opacity: pipe(
          slot.visual.isDisabled,
          Match.value,
          Match.when(true, () => 0.4),
          Match.orElse(() => 1)
        ),
      }}
    >
      {pipe(
        slot.item,
        Option.match({
          onNone: () => null,
          onSome: (item) => (
            <span
              style={{
                color: theme.itemCountColor,
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {item.count}
            </span>
          ),
        })
      )}
    </button>
  )
}
