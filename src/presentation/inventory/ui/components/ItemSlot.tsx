import type { JSX } from 'react'

import { Effect, Match, Option, pipe } from 'effect'
import type { InventorySlot, InventoryTheme } from '../../adt/inventory-adt'

export interface ItemSlotVisualStyle {
  readonly backgroundColor: string
  readonly border: string
  readonly opacity: number
}

const backgroundColorOf = (slot: InventorySlot, theme: InventoryTheme): Effect.Effect<string> =>
  pipe(
    slot.visual.isDisabled,
    Match.value,
    Match.when(true, () => Effect.succeed(theme.slotDisabled)),
    Match.orElse(() =>
      pipe(
        slot.visual.isHighlighted,
        Match.value,
        Match.when(true, () => Effect.succeed(theme.slotSelected)),
        Match.orElse(() => Effect.succeed(theme.slotBackground))
      )
    )
  )

const borderOf = (slot: InventorySlot, theme: InventoryTheme): Effect.Effect<string> =>
  pipe(
    slot.visual.isHighlighted,
    Match.value,
    Match.when(true, () => Effect.succeed(`2px solid ${theme.slotHover}`)),
    Match.orElse(() => Effect.succeed(`1px solid ${theme.slotBorder}`))
  )

const opacityOf = (slot: InventorySlot): Effect.Effect<number> =>
  pipe(
    slot.visual.isDisabled,
    Match.value,
    Match.when(true, () => Effect.succeed(0.4)),
    Match.orElse(() => Effect.succeed(1))
  )

export const deriveItemSlotVisualStyle = (
  slot: InventorySlot,
  theme: InventoryTheme
): Effect.Effect<ItemSlotVisualStyle> =>
  Effect.all({
    backgroundColor: backgroundColorOf(slot, theme),
    border: borderOf(slot, theme),
    opacity: opacityOf(slot),
  })

export interface ItemSlotProps {
  readonly slot: InventorySlot
  readonly theme: InventoryTheme
  readonly onSelect: (slot: InventorySlot) => void
}

export const ItemSlot = ({ slot, theme, onSelect }: ItemSlotProps): JSX.Element => {
  const visual = Effect.runSync(deriveItemSlotVisualStyle(slot, theme))
  const handleClick = () => onSelect(slot)

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: visual.backgroundColor,
        border: visual.border,
        cursor: 'pointer',
        opacity: visual.opacity,
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
