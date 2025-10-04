import { Effect, Layer } from 'effect'
import { InventoryService } from '@mc/bc-inventory/domain/inventory-service'
import {
  InventoryUiService,
  InventoryUiError,
  ItemStackDTO,
  PlayerIdDTO,
  toInventoryDTO,
  toItemStackDTO,
  toPlayerId,
  fromDomainError,
} from './inventory-ui-service'

const mapDomainItemArray = (
  items: ReadonlyArray<unknown>
): ReadonlyArray<ItemStackDTO> =>
  items
    .map((item) => toItemStackDTO(item as any))
    .filter((value): value is ItemStackDTO => value !== null)

export const InventoryUiServiceLive = Layer.effect(
  InventoryUiService,
  Effect.gen(function* () {
    const service = yield* InventoryService

    const wrap = <A>(effect: Effect.Effect<A>): Effect.Effect<A, InventoryUiError> =>
      effect.pipe(Effect.mapError(fromDomainError))

    const getInventory = (playerId: PlayerIdDTO) =>
      wrap(service.getInventory(toPlayerId(playerId)).pipe(Effect.map(toInventoryDTO)))

    const getSlotItem = (playerId: PlayerIdDTO, slotIndex: number) =>
      wrap(
        service
          .getSlotItem(toPlayerId(playerId), slotIndex)
          .pipe(Effect.map(toItemStackDTO))
      )

    const setSelectedSlot = (playerId: PlayerIdDTO, hotbarIndex: number) =>
      wrap(service.setSelectedSlot(toPlayerId(playerId), hotbarIndex))

    const moveItem = (
      playerId: PlayerIdDTO,
      fromSlot: number,
      toSlot: number,
      amount?: number
    ) => wrap(service.moveItem(toPlayerId(playerId), fromSlot, toSlot, amount))

    const swapItems = (playerId: PlayerIdDTO, firstSlot: number, secondSlot: number) =>
      wrap(service.swapItems(toPlayerId(playerId), firstSlot, secondSlot))

    const mergeStacks = (playerId: PlayerIdDTO, sourceSlot: number, targetSlot: number) =>
      wrap(service.mergeStacks(toPlayerId(playerId), sourceSlot, targetSlot))

    const splitStack = (
      playerId: PlayerIdDTO,
      sourceSlot: number,
      targetSlot: number,
      amount: number
    ) => wrap(service.splitStack(toPlayerId(playerId), sourceSlot, targetSlot, amount))

    const transferToHotbar = (
      playerId: PlayerIdDTO,
      slotIndex: number,
      hotbarIndex: number
    ) => wrap(service.transferToHotbar(toPlayerId(playerId), slotIndex, hotbarIndex))

    const dropItem = (playerId: PlayerIdDTO, slotIndex: number, amount?: number) =>
      wrap(
        service
          .dropItem(toPlayerId(playerId), slotIndex, amount)
          .pipe(Effect.map(toItemStackDTO))
      )

    const dropAllItems = (playerId: PlayerIdDTO) =>
      wrap(
        service
          .dropAllItems(toPlayerId(playerId))
          .pipe(Effect.map(mapDomainItemArray))
      )

    return InventoryUiService.of({
      getInventory,
      getSlotItem,
      setSelectedSlot,
      moveItem,
      swapItems,
      mergeStacks,
      splitStack,
      transferToHotbar,
      dropItem,
      dropAllItems,
    })
  })
)
