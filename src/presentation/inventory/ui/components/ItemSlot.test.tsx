import { describe, expect, it } from '@effect/vitest'
import { fireEvent, render } from '@testing-library/react'
import { Data, Effect, Match, Option, Ref, Schema, pipe } from 'effect'
import * as FastCheck from 'effect/FastCheck'
import {
  SlotIndexSchema,
  SlotTypeSchema,
  makeInventorySlot,
  slotGridPosition,
  slotIndexToNumber,
} from '../../adt/inventory-adt'
import { ItemSlot, deriveItemSlotVisualStyle } from './ItemSlot'

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

const makeSlot = (options?: { readonly isDisabled?: boolean; readonly isHighlighted?: boolean }) =>
  Effect.gen(function* () {
    const slotIndex = yield* Schema.decode(SlotIndexSchema)(0)
    const slotType = yield* Schema.decode(SlotTypeSchema)('normal')
    const position = yield* slotGridPosition({ index: 0, columns: 9, spacing: 2, slotSize: 32 })
    return makeInventorySlot({
      index: slotIndex,
      section: 'main',
      slotType,
      position,
      item: Option.none(),
      isDisabled: options?.isDisabled ?? false,
      isHighlighted: options?.isHighlighted ?? false,
    })
  })

const DomQueryError = Data.tagged<'DomQueryError', { readonly selector: string }>('DomQueryError')

const requireButton = (root: HTMLElement, selector: string) =>
  pipe(
    Option.fromNullable(root.querySelector<HTMLButtonElement>(selector)),
    Option.match({
      onSome: (element) => Effect.succeed(element),
      onNone: () => Effect.fail(DomQueryError({ selector })),
    })
  )

describe('presentation/inventory/ui/ItemSlot', () => {
  it.effect('アイテム選択イベントがEffect経由で発火する', () =>
    Effect.gen(function* () {
      const slot = yield* makeSlot({ isHighlighted: true })
      const theme = makeTheme()
      const selections = yield* Ref.make<ReadonlyArray<number>>([])
      const recordSelection = (index: number) => Ref.update(selections, (current) => [...current, index])

      const { container, unmount } = yield* Effect.sync(() =>
        render(
          <ItemSlot
            slot={slot}
            theme={theme}
            onSelect={(current) => Effect.runSync(recordSelection(slotIndexToNumber(current.index)))}
          />
        )
      )

      const button = yield* requireButton(container, 'button')
      yield* Effect.sync(() => fireEvent.click(button))
      const recorded = yield* Ref.get(selections)
      expect(recorded).toStrictEqual([slotIndexToNumber(slot.index)])
      yield* Effect.sync(() => unmount())
    })
  )

  it('スタイル決定が視覚状態の優先順位を保持する (property)', () =>
    Effect.sync(() =>
      FastCheck.assert(
        FastCheck.property(FastCheck.boolean(), FastCheck.boolean(), (disabled, highlighted) => {
          Effect.runSync(
            Effect.gen(function* () {
              const slot = yield* makeSlot({ isDisabled: disabled, isHighlighted: highlighted })
              const theme = makeTheme()
              const visual = yield* deriveItemSlotVisualStyle(slot, theme)

              const expectedBackground = pipe(
                disabled,
                Match.value,
                Match.when(true, () => theme.slotDisabled),
                Match.orElse(() =>
                  pipe(
                    highlighted,
                    Match.value,
                    Match.when(true, () => theme.slotSelected),
                    Match.orElse(() => theme.slotBackground)
                  )
                )
              )

              const expectedBorder = pipe(
                highlighted,
                Match.value,
                Match.when(true, () => `2px solid ${theme.slotHover}`),
                Match.orElse(() => `1px solid ${theme.slotBorder}`)
              )

              const expectedOpacity = pipe(
                disabled,
                Match.value,
                Match.when(true, () => 0.4),
                Match.orElse(() => 1)
              )

              expect(visual.backgroundColor).toBe(expectedBackground)
              expect(visual.border).toBe(expectedBorder)
              expect(visual.opacity).toBe(expectedOpacity)
            })
          )
        }),
        { numRuns: 64 }
      )
    ))
})
