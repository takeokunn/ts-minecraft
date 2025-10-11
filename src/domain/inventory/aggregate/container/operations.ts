/**
 * @fileoverview Container集約のドメイン操作
 * コンテナ固有のビジネスロジック実装
 */

import { Clock, DateTime, Effect, Match, Option, pipe, Schema } from 'effect'
import type { ItemId, PlayerId } from '../../types'
import type { ItemStackEntity } from '../item_stack/types'
import { ItemCountSchema, makeUnsafeItemStackId } from '../item_stack/types'
import { addContainerUncommittedEvent, incrementContainerVersion } from './factory'
import type {
  ContainerAggregate,
  ContainerClosedEvent,
  ContainerOpenedEvent,
  ContainerPermission,
  ContainerPermissionGrantedEvent,
  ContainerSlot,
  ContainerSlotIndex,
  ContainerSortedEvent,
  ItemPlacedInContainerEvent,
  ItemRemovedFromContainerEvent,
} from './types'
import { CONTAINER_CONSTANTS, ContainerError, makeUnsafeContainerSlotIndex } from './types'

// ===== Access Control Operations =====

/**
 * コンテナを開く
 */
export const openContainer = (
  aggregate: ContainerAggregate,
  playerId: PlayerId
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    // アクセス権限チェック
    yield* pipe(
      checkAccess(aggregate, playerId, 'view'),
      Effect.filterOrFail(
        (hasAccess) => hasAccess,
        () => ContainerError.accessDenied(aggregate.id, playerId)
      )
    )

    // 視聴者数上限チェック
    yield* pipe(
      aggregate.currentViewers.length,
      Effect.filterOrFail(
        (count) => count < CONTAINER_CONSTANTS.MAX_VIEWERS,
        () => ContainerError.tooManyViewers(aggregate.id)
      )
    )

    // 既に視聴中でない場合のみ追加
    if (!aggregate.currentViewers.includes(playerId)) {
      const now = yield* DateTime.now
      const timestamp = DateTime.formatIso(now)
      const event: ContainerOpenedEvent = {
        type: 'ContainerOpened',
        aggregateId: aggregate.id,
        playerId,
        containerType: aggregate.type,
        position: aggregate.position,
        timestamp,
      }

      const updatedAgg = {
        ...aggregate,
        isOpen: true,
        currentViewers: [...aggregate.currentViewers, playerId],
        lastAccessed: timestamp,
      }
      const versionedAgg = yield* incrementContainerVersion(updatedAgg)
      return addContainerUncommittedEvent(versionedAgg, event)
    }

    return aggregate
  })

/**
 * コンテナを閉じる
 */
export const closeContainer = (
  aggregate: ContainerAggregate,
  playerId: PlayerId,
  sessionStartTime: Date
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    // 視聴者リストから削除
    const updatedViewers = aggregate.currentViewers.filter((id) => id !== playerId)
    const now = yield* Clock.currentTimeMillis
    const sessionDuration = now - sessionStartTime.getTime()
    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)

    const event: ContainerClosedEvent = {
      type: 'ContainerClosed',
      aggregateId: aggregate.id,
      playerId,
      containerType: aggregate.type,
      sessionDuration,
      timestamp,
    }

    const updatedAgg = {
      ...aggregate,
      isOpen: updatedViewers.length > 0,
      currentViewers: updatedViewers,
    }
    const versionedAgg = yield* incrementContainerVersion(updatedAgg)
    return addContainerUncommittedEvent(versionedAgg, event)
  })

/**
 * コンテナにアイテムを配置
 */
export const placeItemInContainer = (
  aggregate: ContainerAggregate,
  playerId: PlayerId,
  slotIndex: ContainerSlotIndex,
  itemStack: ItemStackEntity
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    // アクセス権限チェック
    yield* pipe(
      checkAccess(aggregate, playerId, 'insert'),
      Effect.filterOrFail(
        (hasInsertAccess) => hasInsertAccess,
        () => ContainerError.accessDenied(aggregate.id, playerId)
      )
    )

    // スロットインデックスの検証
    yield* pipe(
      slotIndex,
      Effect.filterOrFail(
        (index) => index >= 0 && index < aggregate.configuration.maxSlots,
        () => ContainerError.invalidSlotIndex(aggregate.id, slotIndex)
      )
    )

    // スロットが空かチェック
    yield* pipe(
      aggregate.slots[slotIndex],
      Effect.filterOrFail(
        (slot) => slot === null,
        () => ContainerError.slotOccupied(aggregate.id, slotIndex)
      )
    )

    // アイテムタイプの制限チェック
    yield* pipe(
      checkItemTypeAllowed(aggregate, itemStack.itemId, slotIndex),
      Effect.filterOrFail(
        (isAllowedItem) => isAllowedItem,
        () => ContainerError.invalidItemType(aggregate.id, itemStack.itemId)
      )
    )

    // 新しいスロットを作成
    const newSlot: ContainerSlot = {
      itemStack,
      locked: false,
      metadata: {},
    }

    const updatedSlots = [...aggregate.slots]
    updatedSlots[slotIndex] = newSlot

    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)
    const event: ItemPlacedInContainerEvent = {
      type: 'ItemPlacedInContainer',
      aggregateId: aggregate.id,
      playerId,
      slotIndex,
      itemId: itemStack.itemId,
      quantity: itemStack.count,
      itemStackId: itemStack.id,
      timestamp,
    }

    const updatedAgg = { ...aggregate, slots: updatedSlots }
    const versionedAgg = yield* incrementContainerVersion(updatedAgg)
    return addContainerUncommittedEvent(versionedAgg, event)
  })

/**
 * コンテナからアイテムを取り出し
 */
export const removeItemFromContainer = (
  aggregate: ContainerAggregate,
  playerId: PlayerId,
  slotIndex: ContainerSlotIndex,
  quantity?: number,
  reason: 'extracted' | 'consumed' | 'hopper' | 'automation' = 'extracted'
): Effect.Effect<
  { readonly updatedAggregate: ContainerAggregate; readonly removedItemStack: Option.Option<ItemStackEntity> },
  ContainerError
> =>
  Effect.gen(function* () {
    // アクセス権限チェック
    yield* pipe(
      checkAccess(aggregate, playerId, 'extract'),
      Effect.filterOrFail(
        (hasExtractAccess) => hasExtractAccess,
        () => ContainerError.accessDenied(aggregate.id, playerId)
      )
    )

    // スロットインデックスの検証
    yield* pipe(
      slotIndex,
      Effect.filterOrFail(
        (index) => index >= 0 && index < aggregate.configuration.maxSlots,
        () => ContainerError.invalidSlotIndex(aggregate.id, slotIndex)
      )
    )

    const slot = aggregate.slots[slotIndex]

    // スロットにアイテムが存在するかチェックし、検証済みデータを取得
    const validatedSlot = yield* pipe(
      slot,
      Option.fromNullable,
      Option.flatMap((s) => (s.itemStack ? Option.some({ slot: s, itemStack: s.itemStack }) : Option.none())),
      Effect.fromOption(() => ContainerError.slotEmpty(aggregate.id, slotIndex))
    )

    const removeQuantity = quantity ?? validatedSlot.itemStack.count

    // 数量の検証
    yield* pipe(
      removeQuantity,
      Effect.filterOrFail(
        (qty) => qty <= validatedSlot.itemStack.count,
        () =>
          ContainerError.make({
            reason: 'INVALID_SLOT_INDEX',
            message: `数量不足: ${removeQuantity} > ${validatedSlot.itemStack.count}`,
            containerId: aggregate.id,
            slotIndex,
          })
      )
    )

    const updatedSlots = [...aggregate.slots]
    let removedItemStack: Option.Option<ItemStackEntity> = Option.none()

    if (removeQuantity === validatedSlot.itemStack.count) {
      // 完全に削除
      updatedSlots[slotIndex] = null
      removedItemStack = Option.some(validatedSlot.itemStack)
    } else {
      // 一部削除
      const newCount = validatedSlot.itemStack.count - removeQuantity
      const updatedItemStack: ItemStackEntity = {
        ...validatedSlot.itemStack,
        count: Schema.make(ItemCountSchema)(newCount),
      }
      updatedSlots[slotIndex] = { ...validatedSlot.slot, itemStack: updatedItemStack }

      // 削除されたアイテムスタックを作成（簡略化）
      const now = yield* Clock.currentTimeMillis
      const removedStack: ItemStackEntity = {
        ...validatedSlot.itemStack,
        count: Schema.make(ItemCountSchema)(removeQuantity),
        id: makeUnsafeItemStackId(`stack_removed_${now}`),
      }
      removedItemStack = Option.some(removedStack)
    }

    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)
    const event: ItemRemovedFromContainerEvent = {
      type: 'ItemRemovedFromContainer',
      aggregateId: aggregate.id,
      playerId,
      slotIndex,
      itemId: validatedSlot.itemStack.itemId,
      quantity: removeQuantity,
      itemStackId: validatedSlot.itemStack.id,
      timestamp,
      reason,
    }

    const baseAgg = { ...aggregate, slots: updatedSlots }
    const versionedAgg = yield* incrementContainerVersion(baseAgg)
    const updatedAggregate = addContainerUncommittedEvent(versionedAgg, event)

    return { updatedAggregate, removedItemStack }
  })

/**
 * コンテナ内のアイテムをソート
 */
export const sortContainer = (
  aggregate: ContainerAggregate,
  playerId: PlayerId,
  sortType: 'alphabetical' | 'quantity' | 'type' | 'custom' = 'type'
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    // アクセス権限チェック
    yield* pipe(
      checkAccess(aggregate, playerId, 'modify'),
      Effect.filterOrFail(
        (hasModifyAccess) => hasModifyAccess,
        () => ContainerError.accessDenied(aggregate.id, playerId)
      )
    )

    // 自動ソートが無効の場合はエラー
    yield* pipe(
      aggregate.configuration.autoSort,
      Effect.filterOrFail(
        (autoSort) => autoSort,
        () =>
          ContainerError.make({
            reason: 'INVALID_CONFIGURATION',
            message: 'このコンテナは自動ソートが無効です',
            containerId: aggregate.id,
          })
      )
    )

    // アイテムがあるスロットを取得（型安全に）
    const itemSlots = aggregate.slots
      .map((slot, index) => ({ slot, index }))
      .filter(
        (item): item is { slot: NonNullable<typeof item.slot> & { itemStack: ItemStackEntity }; index: number } =>
          item.slot !== null && item.slot.itemStack !== undefined
      )

    // ソートロジック
    const sortedSlots = [...itemSlots].sort((a, b) => {
      const itemA = a.slot.itemStack
      const itemB = b.slot.itemStack

      return pipe(
        Match.value(sortType),
        Match.when('alphabetical', () => itemA.itemId.localeCompare(itemB.itemId)),
        Match.when('quantity', () => itemB.count - itemA.count),
        Match.when('type', () => itemA.itemId.localeCompare(itemB.itemId)),
        Match.orElse(() => 0)
      )
    })

    // 新しいスロット配列を作成
    const newSlots: Array<ContainerSlot> = Array(aggregate.configuration.maxSlots).fill(null)
    sortedSlots.forEach(({ slot }, index) => {
      if (index < aggregate.configuration.maxSlots) {
        newSlots[index] = slot
      }
    })

    const affectedSlots = sortedSlots.map((_, index) => makeUnsafeContainerSlotIndex(index))

    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)
    const event: ContainerSortedEvent = {
      type: 'ContainerSorted',
      aggregateId: aggregate.id,
      playerId,
      sortType,
      affectedSlots,
      timestamp,
    }

    const updatedAgg = { ...aggregate, slots: newSlots }
    const versionedAgg = yield* incrementContainerVersion(updatedAgg)
    return addContainerUncommittedEvent(versionedAgg, event)
  })

/**
 * コンテナの権限を付与
 */
export const grantPermission = (
  aggregate: ContainerAggregate,
  ownerId: PlayerId,
  targetPlayerId: PlayerId,
  permission: Omit<ContainerPermission, 'playerId'>
): Effect.Effect<ContainerAggregate, ContainerError> =>
  Effect.gen(function* () {
    // オーナーかチェック
    yield* pipe(
      aggregate.ownerId,
      Effect.filterOrFail(
        (id) => id === ownerId,
        () => ContainerError.accessDenied(aggregate.id, ownerId)
      )
    )

    const newPermission: ContainerPermission = {
      ...permission,
      playerId: targetPlayerId,
    }

    // 既存の権限を削除して新しい権限を追加
    const updatedPermissions = [...aggregate.permissions.filter((p) => p.playerId !== targetPlayerId), newPermission]

    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)
    const event: ContainerPermissionGrantedEvent = {
      type: 'ContainerPermissionGranted',
      aggregateId: aggregate.id,
      ownerId,
      grantedTo: targetPlayerId,
      permission: newPermission,
      timestamp,
    }

    const updatedAgg = { ...aggregate, permissions: updatedPermissions }
    const versionedAgg = yield* incrementContainerVersion(updatedAgg)
    return addContainerUncommittedEvent(versionedAgg, event)
  })

// ===== Helper Functions =====

/**
 * アクセス権限をチェック
 */
const checkAccess = (
  aggregate: ContainerAggregate,
  playerId: PlayerId,
  accessType: 'view' | 'insert' | 'extract' | 'modify'
): Effect.Effect<boolean, ContainerError> =>
  Effect.gen(function* () {
    // オーナーは常にアクセス可能
    if (aggregate.ownerId === playerId) {
      return true
    }

    // パブリックアクセスレベルの場合
    if (aggregate.accessLevel === 'public') {
      return true
    }

    // 個別権限をチェック
    const permission = aggregate.permissions.find((p) => p.playerId === playerId)
    if (!permission) {
      return false
    }

    // 権限の有効期限チェック
    if (permission.expiresAt) {
      const now = yield* DateTime.now
      const expiresAt = DateTime.unsafeMake(permission.expiresAt)
      if (now > expiresAt) {
        return false
      }
    }

    // アクセスタイプ別のチェック
    return pipe(
      Match.value(accessType),
      Match.when('view', () => permission.canView),
      Match.when('insert', () => permission.canInsert),
      Match.when('extract', () => permission.canExtract),
      Match.when('modify', () => permission.canModify),
      Match.orElse(() => false)
    )
  })

/**
 * アイテムタイプが許可されているかチェック
 */
const checkItemTypeAllowed = (
  aggregate: ContainerAggregate,
  itemId: ItemId,
  slotIndex: ContainerSlotIndex
): Effect.Effect<boolean, ContainerError> =>
  Effect.gen(function* () {
    const config = aggregate.configuration

    // 制限されたアイテムタイプをチェック
    if (config.restrictedItemTypes?.includes(itemId)) {
      return false
    }

    // 許可されたアイテムタイプをチェック
    if (config.allowedItemTypes && !config.allowedItemTypes.includes(itemId)) {
      return false
    }

    // スロット固有のフィルターをチェック
    if (config.slotFilters?.[slotIndex]) {
      const allowedForSlot = config.slotFilters[slotIndex]
      if (!allowedForSlot.includes(itemId)) {
        return false
      }
    }

    return true
  })

// ===== Query Operations =====

/**
 * 空きスロットの数を取得
 */
export const getEmptySlotCount = (aggregate: ContainerAggregate): number =>
  aggregate.slots.filter((slot) => slot === null).length

/**
 * コンテナが満杯かチェック
 */
export const isContainerFull = (aggregate: ContainerAggregate): boolean =>
  aggregate.slots.every((slot) => slot !== null)

/**
 * コンテナが空かチェック
 */
export const isContainerEmpty = (aggregate: ContainerAggregate): boolean =>
  aggregate.slots.every((slot) => slot === null)

/**
 * 指定されたアイテムが存在するスロットを検索
 */
export const findItemSlots = (aggregate: ContainerAggregate, itemId: ItemId): ReadonlyArray<ContainerSlotIndex> =>
  pipe(
    aggregate.slots,
    ReadonlyArray.filterMapWithIndex((i, slot) =>
      slot?.itemStack?.itemId === itemId ? Option.some(makeUnsafeContainerSlotIndex(i)) : Option.none()
    )
  )

/**
 * 指定されたアイテムの合計数量を取得
 */
export const getItemCount = (aggregate: ContainerAggregate, itemId: ItemId): number =>
  aggregate.slots.reduce((total, slot) => {
    if (slot?.itemStack?.itemId === itemId) {
      return total + slot.itemStack.count
    }
    return total
  }, 0)

/**
 * プレイヤーがコンテナを視聴中かチェック
 */
export const isPlayerViewing = (aggregate: ContainerAggregate, playerId: PlayerId): boolean =>
  aggregate.currentViewers.includes(playerId)

/**
 * コンテナが開いているかチェック
 */
export const isContainerOpen = (aggregate: ContainerAggregate): boolean =>
  aggregate.isOpen && aggregate.currentViewers.length > 0
