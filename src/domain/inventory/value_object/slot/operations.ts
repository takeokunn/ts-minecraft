import { toJsonValue } from '@shared/schema/json'
import { Effect, Match, pipe, Schema } from 'effect'
import { SlotConstraintSchema, SlotIdSchema, SlotSchema } from './schema'
import { AcceptanceResult, Slot, SlotConstraint, SlotError, SlotId, SlotState, SlotType } from './types'

/**
 * SlotId ファクトリー関数
 */
export const createSlotId = (id: number): Effect.Effect<SlotId, SlotError> =>
  pipe(
    Schema.decodeUnknown(SlotIdSchema)(id),
    Effect.mapError(() =>
      SlotError.InvalidSlotId({
        id,
        min: 0,
        max: 35,
      })
    )
  )

/**
 * SlotConstraint ファクトリー関数
 */
export const createSlotConstraint = (
  maxStackSize: number,
  allowedItemTypes: readonly string[],
  isLocked: boolean = false,
  isHotbar: boolean = false
): Effect.Effect<SlotConstraint, SlotError> =>
  pipe(
    Schema.decodeUnknown(SlotConstraintSchema)({
      maxStackSize,
      allowedItemTypes,
      isLocked,
      isHotbar,
    }),
    Effect.mapError(() =>
      SlotError.InvalidConstraint({
        field: 'constraint',
        value: toJsonValue({ maxStackSize, allowedItemTypes, isLocked, isHotbar }),
        expected: 'valid slot constraint',
      })
    )
  )

/**
 * Slot ファクトリー関数
 */
export const createSlot = (
  id: SlotId,
  state: SlotState,
  constraint: SlotConstraint,
  position: { row: number; column: number }
): Effect.Effect<Slot, SlotError> =>
  pipe(
    Schema.decodeUnknown(SlotSchema)({
      id,
      state,
      constraint,
      position,
    }),
    Effect.mapError(() =>
      SlotError.InvalidPosition({
        row: position.row,
        column: position.column,
        expected: 'valid grid position matching slot ID',
      })
    )
  )

/**
 * スロットが空かどうかを判定
 */
export const isEmpty = (slot: Slot): boolean =>
  pipe(
    slot.state,
    Match.value,
    Match.tag('Empty', () => true),
    Match.orElse(() => false)
  )

/**
 * スロットがロックされているかを判定
 */
export const isLocked = (slot: Slot): boolean =>
  slot.constraint.isLocked ||
  pipe(
    slot.state,
    Match.value,
    Match.tag('Locked', () => true),
    Match.tag('Reserved', () => true),
    Match.orElse(() => false)
  )

/**
 * スロットがホットバーかどうかを判定
 */
export const isHotbar = (slot: Slot): boolean => slot.constraint.isHotbar

/**
 * スロットがアイテムを受け入れ可能かを判定
 */
export const canAcceptItem = (
  slot: Slot,
  itemId: string,
  quantity: number
): Effect.Effect<AcceptanceResult, SlotError> =>
  pipe(
    Match.value(slot),
    Match.when(
      isLocked,
      (lockedSlot) =>
        AcceptanceResult.Rejected({
          reason: pipe(
            lockedSlot.state,
            Match.value,
            Match.tag('Locked', (locked) => locked.reason),
            Match.tag('Reserved', (reserved) => `Reserved by ${reserved.reservedBy}`),
            Match.orElse(() => 'Slot is locked')
          ),
        })
    ),
    Match.when(
      (currentSlot) =>
        currentSlot.constraint.allowedItemTypes.length > 0 &&
        !currentSlot.constraint.allowedItemTypes.includes(itemId),
      () =>
        AcceptanceResult.Rejected({
          reason: `Item type '${itemId}' not allowed in this slot`,
        })
    ),
    Match.orElse((currentSlot) =>
      pipe(
        currentSlot.state,
        Match.value,
        Match.tag('Empty', () => {
          const acceptedQuantity = Math.min(quantity, currentSlot.constraint.maxStackSize)
          const rejectedQuantity = quantity - acceptedQuantity

          return pipe(
            Match.value(rejectedQuantity),
            Match.when(
              (amount) => amount > 0,
              (amount) =>
                AcceptanceResult.PartiallyAccepted({
                  acceptedQuantity,
                  rejectedQuantity: amount,
                })
            ),
            Match.orElse(() =>
              AcceptanceResult.Accepted({
                remainingCapacity: currentSlot.constraint.maxStackSize - acceptedQuantity,
              })
            )
          )
        }),
        Match.tag('Occupied', (occupied) =>
          pipe(
            Match.value(occupied),
            Match.when(
              (state) => state.itemId !== itemId,
              (state) =>
                AcceptanceResult.Rejected({
                  reason: `Slot already contains different item: ${state.itemId}`,
                })
            ),
            Match.orElse((state) => {
              const availableSpace = currentSlot.constraint.maxStackSize - state.quantity

              return pipe(
                Match.value(availableSpace),
                Match.when(
                  (space) => space <= 0,
                  () =>
                    AcceptanceResult.Rejected({
                      reason: 'Slot is full',
                    })
                ),
                Match.orElse((space) => {
                  const acceptedQuantity = Math.min(quantity, space)
                  const rejectedQuantity = quantity - acceptedQuantity

                  return pipe(
                    Match.value(rejectedQuantity),
                    Match.when(
                      (amount) => amount > 0,
                      (amount) =>
                        AcceptanceResult.PartiallyAccepted({
                          acceptedQuantity,
                          rejectedQuantity: amount,
                        })
                    ),
                    Match.orElse(() =>
                      AcceptanceResult.Accepted({
                        remainingCapacity: space - acceptedQuantity,
                      })
                    )
                  )
                })
              )
            })
          )
        ),
        Match.orElse(() =>
          AcceptanceResult.Rejected({
            reason: 'Slot is not available',
          })
        ),
        Match.exhaustive
      )
    ),
    Match.exhaustive,
    Effect.succeed
  )

/**
 * スロットにアイテムを追加
 */
export const addItem = (slot: Slot, itemId: string, quantity: number): Effect.Effect<Slot, SlotError> =>
  Effect.gen(function* () {
    const acceptance = yield* canAcceptItem(slot, itemId, quantity)

    return yield* pipe(
      acceptance,
      Match.value,
      Match.tag('Rejected', (rejected) =>
        Effect.fail(
          SlotError.IncompatibleItem({
            slotId: slot.id,
            itemId,
            allowedTypes: slot.constraint.allowedItemTypes,
          })
        )
      ),
      Match.tag('Accepted', (accepted) =>
        Effect.gen(function* () {
          const newSlot = {
            id: slot.id,
            constraint: slot.constraint,
            position: slot.position,
            state: SlotState.Occupied({
              itemId,
              quantity: pipe(
                slot.state,
                Match.value,
                Match.tag('Empty', () => quantity),
                Match.tag('Occupied', (occupied) => occupied.quantity + quantity),
                Match.orElse(() => quantity)
              ),
            }),
          }
          return yield* pipe(
            Schema.decodeUnknown(SlotSchema)(newSlot),
            Effect.mapError(() =>
              SlotError.InvalidConstraint({
                field: 'slot',
                value: toJsonValue(newSlot),
                expected: 'valid Slot object',
              })
            )
          )
        })
      ),
      Match.tag('PartiallyAccepted', (partial) =>
        Effect.gen(function* () {
          const newSlot = {
            id: slot.id,
            constraint: slot.constraint,
            position: slot.position,
            state: SlotState.Occupied({
              itemId,
              quantity: pipe(
                slot.state,
                Match.value,
                Match.tag('Empty', () => partial.acceptedQuantity),
                Match.tag('Occupied', (occupied) => occupied.quantity + partial.acceptedQuantity),
                Match.orElse(() => partial.acceptedQuantity)
              ),
            }),
          }
          return yield* pipe(
            Schema.decodeUnknown(SlotSchema)(newSlot),
            Effect.mapError(() =>
              SlotError.InvalidConstraint({
                field: 'slot',
                value: toJsonValue(newSlot),
                expected: 'valid Slot object',
              })
            )
          )
        })
      ),
      Match.exhaustive,
      Effect.flatten
    )
  })

/**
 * スロットからアイテムを削除
 */
export const removeItem = (
  slot: Slot,
  quantity: number
): Effect.Effect<{ slot: Slot; removedQuantity: number }, SlotError> =>
  pipe(
    slot.state,
    Match.value,
    Match.tag('Empty', () =>
      Effect.succeed({
        slot,
        removedQuantity: 0,
      })
    ),
    Match.tag('Occupied', (occupied) =>
      Effect.gen(function* () {
        const removedQuantity = Math.min(quantity, occupied.quantity)
        const remainingQuantity = occupied.quantity - removedQuantity

        const newState =
          remainingQuantity > 0
            ? SlotState.Occupied({
                itemId: occupied.itemId,
                quantity: remainingQuantity,
              })
            : SlotState.Empty({})

        const newSlot = {
          id: slot.id,
          constraint: slot.constraint,
          position: slot.position,
          state: newState,
        }

        const validatedSlot = yield* pipe(
          Schema.decodeUnknown(SlotSchema)(newSlot),
          Effect.mapError(() =>
            SlotError.InvalidConstraint({
              field: 'slot',
              value: toJsonValue(newSlot),
              expected: 'valid Slot object',
            })
          )
        )

        return {
          slot: validatedSlot,
          removedQuantity,
        }
      })
    ),
    Match.orElse(() =>
      Effect.fail(
        SlotError.SlotLocked({
          slotId: slot.id,
          reason: 'Cannot remove items from locked slot',
        })
      )
    ),
    Match.exhaustive,
    Effect.flatten
  )

/**
 * スロットをクリア
 */
export const clearSlot = (slot: Slot): Effect.Effect<Slot, SlotError> =>
  pipe(
    Match.value(slot),
    Match.when(
      isLocked,
      (lockedSlot) =>
        Effect.fail(
          SlotError.SlotLocked({
            slotId: lockedSlot.id,
            reason: 'Cannot clear locked slot',
          })
        )
    ),
    Match.orElse((unlockedSlot) => {
      const newSlot = {
        id: unlockedSlot.id,
        constraint: unlockedSlot.constraint,
        position: unlockedSlot.position,
        state: SlotState.Empty({}),
      }

      return pipe(
        Schema.decodeUnknown(SlotSchema)(newSlot),
        Effect.mapError(() =>
          SlotError.InvalidConstraint({
            field: 'slot',
            value: toJsonValue(newSlot),
            expected: 'valid Slot object',
          })
        )
      )
    }),
    Match.exhaustive,
    Effect.flatten
  )

/**
 * スロットタイプを取得
 */
export const getSlotType = (slot: Slot): SlotType => {
  return pipe(
    Match.value(slot),
    Match.when((currentSlot) => currentSlot.constraint.isHotbar, () => 'hotbar' as SlotType),
    Match.when((currentSlot) => currentSlot.position.row === 0, () => 'hotbar' as SlotType),
    Match.orElse(() => 'inventory' as SlotType)
  )
}

/**
 * スロット位置からスロットIDを計算
 */
export const positionToSlotId = (row: number, column: number): number => row * 9 + column

/**
 * スロットIDから位置を計算
 */
export const slotIdToPosition = (slotId: SlotId): { row: number; column: number } => ({
  row: Math.floor(slotId / 9),
  column: slotId % 9,
})
