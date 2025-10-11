import type { JSX } from 'react'

import { Effect, Match, Option, pipe } from 'effect'
import type { InventorySlot, InventoryTheme } from '../../adt'

export interface ItemSlotVisualStyle {
  readonly backgroundColor: string
  readonly border: string
  readonly opacity: number
}

const backgroundColorOfSync = (slot: InventorySlot, theme: InventoryTheme): string =>
  pipe(
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

const borderOfSync = (slot: InventorySlot, theme: InventoryTheme): string =>
  pipe(
    slot.visual.isHighlighted,
    Match.value,
    Match.when(true, () => `2px solid ${theme.slotHover}`),
    Match.orElse(() => `1px solid ${theme.slotBorder}`)
  )

const opacityOfSync = (slot: InventorySlot): number =>
  pipe(
    slot.visual.isDisabled,
    Match.value,
    Match.when(true, () => 0.4),
    Match.orElse(() => 1)
  )

export const deriveItemSlotVisualStyleSync = (slot: InventorySlot, theme: InventoryTheme): ItemSlotVisualStyle => ({
  backgroundColor: backgroundColorOfSync(slot, theme),
  border: borderOfSync(slot, theme),
  opacity: opacityOfSync(slot),
})

const backgroundColorOf = (slot: InventorySlot, theme: InventoryTheme): Effect.Effect<string> =>
  Effect.succeed(backgroundColorOfSync(slot, theme))

const borderOf = (slot: InventorySlot, theme: InventoryTheme): Effect.Effect<string> =>
  Effect.succeed(borderOfSync(slot, theme))

const opacityOf = (slot: InventorySlot): Effect.Effect<number> => Effect.succeed(opacityOfSync(slot))

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
  const visual = deriveItemSlotVisualStyleSync(slot, theme)
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
