import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { MessageType, PlayerId, WorldId } from '@ts-minecraft/network/domain/schemas'
import type { DroppedItemRemoveMessage, NetworkMessage, ParkedVehicleRemoveMessage, ParkedVehicleUpdateMessage } from '@ts-minecraft/network/domain/schemas'
import { handleDroppedItemMessage, handleParkedVehicleRemove, handleParkedVehicleUpdate } from '@ts-minecraft/network/application/server-handlers'
import { makeGameServer } from '@ts-minecraft/network/application/server-service'
import type { ServerServiceShape } from '@ts-minecraft/network/application/server-service'

const worldId = WorldId.make('overworld')

const makeHarness = async () => {
  const gameServer = await Effect.runPromise(makeGameServer())
  const broadcast = vi.fn(() => Effect.void)
  const sendToPlayer = vi.fn(() => Effect.void)
  const serverService = { broadcast, sendToPlayer } as unknown as ServerServiceShape
  return { services: { gameServer, serverService }, broadcast, sendToPlayer }
}

const itemRemove = (claimer: string): DroppedItemRemoveMessage => ({
  type: MessageType.DroppedItemRemove,
  playerId: PlayerId.make(claimer),
  worldId,
  ownerId: 'alice',
  itemId: 'dropped-item-3',
  timestamp: 1,
})

const vehicleUpdate = (): ParkedVehicleUpdateMessage => ({
  type: MessageType.ParkedVehicleUpdate,
  playerId: PlayerId.make('alice'),
  worldId,
  vehicleId: 'parked-vehicle-1',
  kind: 'boat',
  position: { x: 0, y: 62, z: 0 },
  yaw: 0,
  timestamp: 1,
})

const vehicleRemove = (claimer: string): ParkedVehicleRemoveMessage => ({
  type: MessageType.ParkedVehicleRemove,
  playerId: PlayerId.make(claimer),
  worldId,
  ownerId: 'alice',
  vehicleId: 'parked-vehicle-1',
  timestamp: 2,
})

describe('server claim arbitration (first remove wins)', () => {
  it('the first dropped-item claim broadcasts; the second gets ClaimDenied and no broadcast', async () => {
    const { services, broadcast, sendToPlayer } = await makeHarness()
    await Effect.runPromise(handleDroppedItemMessage(services, itemRemove('bob')))
    expect(broadcast).toHaveBeenCalledTimes(1)

    await Effect.runPromise(handleDroppedItemMessage(services, itemRemove('carol')))
    expect(broadcast).toHaveBeenCalledTimes(1) // not rebroadcast
    expect(sendToPlayer).toHaveBeenCalledTimes(1)
    const [deniedPlayer, denial] = sendToPlayer.mock.calls[0] as unknown as [string, NetworkMessage]
    expect(String(deniedPlayer)).toBe('carol')
    expect(denial).toMatchObject({
      type: MessageType.ClaimDenied,
      target: 'droppedItem',
      ownerId: 'alice',
      itemId: 'dropped-item-3',
    })
  })

  it('a live upsert re-legitimizes an item id for a later claim', async () => {
    const { services, broadcast, sendToPlayer } = await makeHarness()
    await Effect.runPromise(handleDroppedItemMessage(services, itemRemove('bob')))
    await Effect.runPromise(handleDroppedItemMessage(services, {
      type: MessageType.DroppedItemSpawn,
      playerId: PlayerId.make('alice'),
      worldId,
      itemId: 'dropped-item-3',
      itemType: 'DIRT',
      count: 1,
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      timestamp: 3,
    }))
    await Effect.runPromise(handleDroppedItemMessage(services, itemRemove('carol')))
    expect(sendToPlayer).not.toHaveBeenCalled()
    expect(broadcast).toHaveBeenCalledTimes(3)
  })

  it('vehicle claims arbitrate through the live log: second remove is denied', async () => {
    const { services, broadcast, sendToPlayer } = await makeHarness()
    await Effect.runPromise(handleParkedVehicleUpdate(services, vehicleUpdate()))
    await Effect.runPromise(handleParkedVehicleRemove(services, vehicleRemove('bob')))
    expect(broadcast).toHaveBeenCalledTimes(2) // update + winning remove

    await Effect.runPromise(handleParkedVehicleRemove(services, vehicleRemove('carol')))
    expect(broadcast).toHaveBeenCalledTimes(2)
    expect(sendToPlayer).toHaveBeenCalledTimes(1)
    const [deniedPlayer, denial] = sendToPlayer.mock.calls[0] as unknown as [string, NetworkMessage]
    expect(String(deniedPlayer)).toBe('carol')
    expect(denial).toMatchObject({ type: MessageType.ClaimDenied, target: 'parkedVehicle', ownerId: 'alice', itemId: 'parked-vehicle-1' })
  })
})
