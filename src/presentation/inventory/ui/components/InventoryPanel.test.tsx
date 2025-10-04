
import { describe, expect, it } from '@effect/vitest'
import { fireEvent, render } from '@testing-library/react'
import * as FastCheck from 'effect/FastCheck'
import { Data, Effect, Match, Option, Ref, Schema, pipe } from 'effect'
import { InventoryPanel } from './InventoryPanel'
import {
  InventoryEventHandler,
  InventoryGUIEvent,
  InventoryPanelModel,
  InventoryView,
  SlotIndexSchema,
  SlotTypeSchema,
  defaultInventoryGUIConfig,
  makeInventorySlot,
  parsePlayerId,
  slotGridPosition,
} from '../../adt/inventory-adt'

const createModel = (
  options: {
    readonly sections?: ReadonlyArray<'main' | 'hotbar'>
    readonly isOpen?: boolean
  } = {}
) => {
  const playerId = Effect.runSync(parsePlayerId('player-ui'))
  const slotType = Effect.runSync(Schema.decode(SlotTypeSchema)('normal'))
  const sections = options.sections ?? ['main', 'hotbar']

  const slots = sections.map((section, index) => {
    const slotIndex = Effect.runSync(Schema.decode(SlotIndexSchema)(index))
    const position = Effect.runSync(
      slotGridPosition({ index, columns: 9, spacing: 2, slotSize: 32 })
    )
    return makeInventorySlot({
      index: slotIndex,
      section,
      slotType,
      position,
      item: Option.none(),
      isDisabled: false,
      isHighlighted: false,
    })
  })

  const hotbar = slots
    .filter((slot) => slot.section === 'hotbar')
    .map((slot) => slot.index)

  const selectedSlot = slots[0]?.index ?? Effect.runSync(Schema.decode(SlotIndexSchema)(0))

  const view: InventoryView = {
    playerId,
    slots,
    hotbar,
    selectedSlot,
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
    isOpen: options.isOpen ?? true,
  }
  return model
}

const DomQueryError = Data.tagged<'DomQueryError', { readonly selector: string }>('DomQueryError')

const selectElement = <T extends Element>(root: HTMLElement, selector: string) =>
  pipe(
    Option.fromNullable(root.querySelector<T>(selector)),
    Option.match({
      onSome: (element) => Effect.succeed(element),
      onNone: () => Effect.fail(DomQueryError({ selector })),
    })
  )

const recordHandler = (ref: Ref.Ref<ReadonlyArray<string>>): InventoryEventHandler => (event: InventoryGUIEvent) =>
  Ref.update(ref, (current) => [...current, event._tag])

describe('presentation/inventory/ui/InventoryPanel', () => {
  it.effect('emits events for slot interaction and toggling', () =>
    Effect.sync(() =>
      FastCheck.assert(
        FastCheck.property(FastCheck.boolean(), (initialOpen) => {
          Effect.runSync(
            Effect.gen(function* () {
              const model = createModel({ isOpen: initialOpen })
              const events = yield* Ref.make<ReadonlyArray<string>>([])
              const handler = recordHandler(events)

              const { container, getByRole, unmount } = yield* Effect.sync(() =>
                render(<InventoryPanel model={model} onEvent={handler} />)
              )

              const mainButton = yield* selectElement<HTMLButtonElement>(
                container,
                '[data-slot-section="main"] button'
              )
              yield* Effect.sync(() => fireEvent.click(mainButton))

              const hotbarWrapper = yield* selectElement<HTMLElement>(
                container,
                '[data-slot-section="hotbar"]'
              )
              yield* Effect.sync(() => fireEvent.doubleClick(hotbarWrapper))

              const toggleLabel = pipe(
                initialOpen,
                Match.value,
                Match.when(true, () => 'Close'),
                Match.orElse(() => 'Open')
              )

              yield* Effect.sync(() =>
                fireEvent.click(getByRole('button', { name: toggleLabel }))
              )

              const recorded = yield* Ref.get(events)
              expect(recorded).toContain('SlotClicked')
              expect(recorded).toContain('QuickMove')
              const expectedToggle = pipe(
                initialOpen,
                Match.value,
                Match.when(true, () => 'InventoryClosed'),
                Match.orElse(() => 'InventoryOpened')
              )
              expect(recorded).toContain(expectedToggle)

              yield* Effect.sync(() => unmount())
            })
          )
        }),
        { numRuns: 8 }
      )
    )
  )

  it.effect('partitions slots between main grid and hotbar (property)', () =>
    Effect.sync(() =>
      FastCheck.assert(
        FastCheck.property(
          FastCheck.array(FastCheck.boolean(), { minLength: 1, maxLength: 6 }),
          (flags) => {
            const sections = flags.map((flag) => (flag ? 'hotbar' : 'main'))
            const model = createModel({ sections })
            Effect.runSync(
              Effect.gen(function* () {
                const { container, unmount } = yield* Effect.sync(() =>
                  render(<InventoryPanel model={model} onEvent={() => Effect.unit} />)
                )

                const mainNodes = container.querySelectorAll('[data-slot-section="main"] button')
                const hotbarNodes = container.querySelectorAll('[data-slot-section="hotbar"] button')
                const expectedMain = flags.filter((flag) => !flag).length
                const expectedHotbar = flags.filter((flag) => flag).length
                expect(mainNodes.length).toBe(expectedMain)
                expect(hotbarNodes.length).toBe(expectedHotbar)

                const hotbarGrid = yield* selectElement<HTMLElement>(
                  container,
                  '[data-testid="inventory-hotbar-grid"]'
                )
                const template = hotbarGrid.style.gridTemplateColumns
                const expectedColumns = pipe(
                  expectedHotbar,
                  Match.value,
                  Match.when(0, () => 1),
                  Match.orElse((count) => count)
                )
                expect(template).toContain(`${expectedColumns}`)

                yield* Effect.sync(() => unmount())
              })
            )
          }
        ),
        { numRuns: 24 }
      )
    )
  )
})
