import { describe, it, expect, vi } from 'vitest'
import { Effect, HashMap, MutableRef, Option } from 'effect'
import { aabbFromVoxel } from '@ts-minecraft/world'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import {
  applyInboundBlockEdits,
  applyInboundContainerUpdates,
  applyInboundDroppedItems,
  applyInboundEntityDamages,
  applyInboundParkedVehicles,
  applyInboundEntitySnapshots,
  broadcastChestOnClose,
  multiplayerStage,
  resetChestSyncStateForTest,
  resetDroppedItemSyncStateForTest,
  resetParkedVehicleSyncStateForTest,
  syncDroppedItems,
  syncParkedVehicles,
} from '@ts-minecraft/app/frame/stages/multiplayer-stage'
import type {
  LocalEntitySnapshot,
  MultiplayerService,
  RemoteBlockEdit,
  RemoteContainerUpdate,
  RemoteEntitySnapshot,
} from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { Chunk } from '@ts-minecraft/world'

describe('multiplayerStage', () => {
  const makeStageHarness = (mpOverrides: Record<string, unknown> = {}) => {
    const removeEntity = vi.fn(() => Effect.succeed(true))
    const services = { entityManager: { removeEntity } } as unknown as Pick<FrameHandlerServices, 'entityManager'>
    const refs = {
      lastBroadcastEntitySnapshotsRef: MutableRef.make<ReadonlyMap<string, LocalEntitySnapshot>>(new Map()),
    } as Pick<FrameStageRefs, 'lastBroadcastEntitySnapshotsRef'>
    const multiplayer = {
      isEntityAuthority: vi.fn(() => Effect.succeed(true)),
      ...mpOverrides,
    } as unknown as MultiplayerService
    return { multiplayer, services, refs, removeEntity }
  }

  it('sends the current position and rotation to the multiplayer service', async () => {
    const sendPositionUpdate = vi.fn(() => Effect.void)
    const { multiplayer, services, refs } = makeStageHarness({ sendPositionUpdate })

    await Effect.runPromise(multiplayerStage(multiplayer, services, refs, { x: 1, y: 2, z: 3 }, 0.25, -0.5))

    expect(sendPositionUpdate).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 }, { yaw: 0.25, pitch: -0.5 })
  })

  it('ignores send failures so a network hiccup cannot abort the frame', async () => {
    const sendPositionUpdate = vi.fn(() => Effect.fail(new Error('offline')))
    const { multiplayer, services, refs } = makeStageHarness({ sendPositionUpdate })

    await expect(Effect.runPromise(multiplayerStage(multiplayer, services, refs, { x: 4, y: 5, z: 6 }, 1, 2))).resolves.toBeUndefined()
    expect(sendPositionUpdate).toHaveBeenCalledTimes(1)
  })

  it('sends local entity snapshots without letting failures abort the frame', async () => {
    const sendPositionUpdate = vi.fn(() => Effect.void)
    const sendEntitySnapshot = vi.fn((snapshot: LocalEntitySnapshot) =>
      snapshot.entityId === 'entity-fail' ? Effect.fail(new Error('offline')) : Effect.void,
    )
    const snapshots: ReadonlyArray<LocalEntitySnapshot> = [
      { entityId: 'entity-ok', entityType: 'ZOMBIE', position: { x: 1, y: 64, z: 2 }, health: 10, alive: true },
      { entityId: 'entity-fail', entityType: 'SKELETON', position: { x: 3, y: 64, z: 4 }, health: 0, alive: false },
    ]
    const { multiplayer, services, refs } = makeStageHarness({ sendPositionUpdate, sendEntitySnapshot })

    await Effect.runPromise(multiplayerStage(multiplayer, services, refs, { x: 7, y: 8, z: 9 }, 0, 0, snapshots))

    expect(sendPositionUpdate).toHaveBeenCalledWith({ x: 7, y: 8, z: 9 }, { yaw: 0, pitch: 0 })
    expect(sendEntitySnapshot).toHaveBeenCalledTimes(2)
    expect(sendEntitySnapshot).toHaveBeenNthCalledWith(1, snapshots[0])
    expect(sendEntitySnapshot).toHaveBeenNthCalledWith(2, snapshots[1])
  })

  it('broadcasts a final alive:false snapshot for entities that vanished since the last frame', async () => {
    const sendPositionUpdate = vi.fn(() => Effect.void)
    const sendEntitySnapshot = vi.fn(() => Effect.void)
    const { multiplayer, services, refs } = makeStageHarness({ sendPositionUpdate, sendEntitySnapshot })
    const killed: LocalEntitySnapshot = {
      entityId: 'entity-dead', entityType: 'ZOMBIE', position: { x: 5, y: 64, z: 5 }, health: 4, alive: true,
    }
    MutableRef.set(refs.lastBroadcastEntitySnapshotsRef, new Map([[killed.entityId, killed]]))

    await Effect.runPromise(multiplayerStage(multiplayer, services, refs, { x: 0, y: 0, z: 0 }, 0, 0, []))

    expect(sendEntitySnapshot).toHaveBeenCalledTimes(1)
    expect(sendEntitySnapshot).toHaveBeenCalledWith({ ...killed, health: 0, alive: false })
    expect(MutableRef.get(refs.lastBroadcastEntitySnapshotsRef).size).toBe(0)
  })

  it('as a non-host: sends no snapshots and removes locally simulated mobs', async () => {
    const sendPositionUpdate = vi.fn(() => Effect.void)
    const sendEntitySnapshot = vi.fn(() => Effect.void)
    const { multiplayer, services, refs, removeEntity } = makeStageHarness({
      sendPositionUpdate,
      sendEntitySnapshot,
      isEntityAuthority: vi.fn(() => Effect.succeed(false)),
    })
    const snapshots: ReadonlyArray<LocalEntitySnapshot> = [
      { entityId: 'entity-1', entityType: 'ZOMBIE', position: { x: 1, y: 64, z: 2 }, health: 10, alive: true },
    ]
    MutableRef.set(refs.lastBroadcastEntitySnapshotsRef, new Map([['stale', snapshots[0]!]]))

    await Effect.runPromise(multiplayerStage(multiplayer, services, refs, { x: 0, y: 0, z: 0 }, 0, 0, snapshots))

    expect(sendPositionUpdate).toHaveBeenCalledTimes(1)
    expect(sendEntitySnapshot).not.toHaveBeenCalled()
    expect(removeEntity).toHaveBeenCalledWith(EntityId.make('entity-1'))
    expect(MutableRef.get(refs.lastBroadcastEntitySnapshotsRef).size).toBe(0)
  })
})

describe('applyInboundEntityDamages', () => {
  it('applies relayed knockback then damage to the host entity', async () => {
    const applyKnockback = vi.fn(() => Effect.void)
    const applyDamage = vi.fn(() => Effect.succeed(Option.none()))
    const mp = {
      drainEntityDamages: Effect.succeed([
        { attackerId: 'player-b', entityId: 'entity-7', damage: 6, knockback: { x: 3, y: 4.2, z: 0 } },
      ]),
    } as unknown as MultiplayerService
    const services = { entityManager: { applyKnockback, applyDamage } } as unknown as Pick<FrameHandlerServices, 'entityManager'>

    await Effect.runPromise(applyInboundEntityDamages(mp, services))

    expect(applyKnockback).toHaveBeenCalledWith(EntityId.make('entity-7'), { x: 3, y: 4.2, z: 0 })
    expect(applyDamage).toHaveBeenCalledWith(EntityId.make('entity-7'), 6)
  })

  it('keeps applying hits after one fails', async () => {
    const applyKnockback = vi.fn(() => Effect.void)
    const applyDamage = vi.fn()
      .mockReturnValueOnce(Effect.fail(new Error('missing entity')))
      .mockReturnValueOnce(Effect.succeed(Option.none()))
    const mp = {
      drainEntityDamages: Effect.succeed([
        { attackerId: 'player-b', entityId: 'entity-a', damage: 2, knockback: { x: 0, y: 4.2, z: 5 } },
        { attackerId: 'player-b', entityId: 'entity-b', damage: 3, knockback: { x: 5, y: 4.2, z: 0 } },
      ]),
    } as unknown as MultiplayerService
    const services = { entityManager: { applyKnockback, applyDamage } } as unknown as Pick<FrameHandlerServices, 'entityManager'>

    await expect(Effect.runPromise(applyInboundEntityDamages(mp, services))).resolves.toBeUndefined()
    expect(applyDamage).toHaveBeenCalledTimes(2)
  })
})

describe('applyInboundEntitySnapshots', () => {
  type MultiplayerEntityServices = Pick<FrameHandlerServices, 'entityManager'>

  const snapshot = (overrides: Partial<RemoteEntitySnapshot> = {}): RemoteEntitySnapshot => ({
    entityId: 'entity-remote-1',
    entityType: EntityType.Cow,
    position: { x: 1, y: 64, z: 2 },
    health: 8,
    alive: true,
    playerId: 'player-b',
    worldId: 'overworld',
    timestamp: 123,
    ...overrides,
  })

  const run = (
    snapshots: ReadonlyArray<RemoteEntitySnapshot>,
    applyEntitySnapshot = vi.fn(() => Effect.succeed('updated' as const)),
  ) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const mp = { drainEntitySnapshots: Effect.succeed(snapshots) } as unknown as MultiplayerService
        const services = { entityManager: { applyEntitySnapshot } } as unknown as MultiplayerEntityServices
        yield* applyInboundEntitySnapshots(mp, services)
        return { applyEntitySnapshot }
      }),
    )

  it('applies remote entity snapshots with a namespaced entity id', async () => {
    const applyEntitySnapshot = vi.fn(() => Effect.succeed('updated' as const))

    await run([snapshot()], applyEntitySnapshot)

    expect(applyEntitySnapshot).toHaveBeenCalledWith({
      entityId: EntityId.make('remote:player-b:entity-remote-1'),
      entityType: EntityType.Cow,
      position: { x: 1, y: 64, z: 2 },
      health: 8,
      alive: true,
    })
  })

  it('skips remote entity types that are not active mobs', async () => {
    const applyEntitySnapshot = vi.fn(() => Effect.succeed('updated' as const))

    await run([snapshot({ entityType: EntityType.Shulker })], applyEntitySnapshot)

    expect(applyEntitySnapshot).not.toHaveBeenCalled()
  })

  it('keeps applying snapshots after an entity write fails', async () => {
    const applyEntitySnapshot = vi.fn()
      .mockReturnValueOnce(Effect.fail(new Error('entity write failed')))
      .mockReturnValueOnce(Effect.succeed('updated' as const))

    await expect(run([
      snapshot({ entityId: 'entity-a' }),
      snapshot({ entityId: 'entity-b' }),
    ], applyEntitySnapshot)).resolves.toBeDefined()

    expect(applyEntitySnapshot).toHaveBeenCalledTimes(2)
  })
})

describe('applyInboundBlockEdits (T15c)', () => {
  type MultiplayerStageServices = Pick<FrameHandlerServices, 'blockService' | 'chunkManagerService'>

  const run = (
    edits: RemoteBlockEdit[],
    options: {
      readonly forceSetBlock?: ReturnType<typeof vi.fn>
      readonly getChunk?: ReturnType<typeof vi.fn>
    } = {},
  ) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const forceSetBlock = options.forceSetBlock ?? vi.fn(() => Effect.void)
        const getChunk =
          options.getChunk ?? vi.fn(() => Effect.succeed({ coord: { x: 0, z: 0 }, blocks: new Uint8Array(0) } as Chunk))
        const mp = { drainBlockEdits: Effect.succeed(edits as ReadonlyArray<RemoteBlockEdit>) } as unknown as MultiplayerService
        const services: MultiplayerStageServices = { blockService: { forceSetBlock }, chunkManagerService: { getChunk } }
        const dirtyRef = MutableRef.make(HashMap.empty<string, unknown>())
        yield* applyInboundBlockEdits(mp, services, dirtyRef as FrameStageRefs['dirtyChunksRef'])
        const dirty = MutableRef.get(dirtyRef)
        return { forceSetBlock, getChunk, dirty, dirtySize: HashMap.size(dirty) }
      }),
    )

  it('applies a remote place as forceSetBlock(pos, blockType) and marks the chunk dirty', async () => {
    const { forceSetBlock, dirtySize } = await run([{ kind: 'place', x: 1, y: 2, z: 3, blockType: 'STONE' }])
    expect(forceSetBlock).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 }, 'STONE')
    expect(dirtySize).toBe(1)
  })

  it('applies a remote break as forceSetBlock(pos, AIR)', async () => {
    const { forceSetBlock } = await run([{ kind: 'break', x: 5, y: 6, z: 7 }])
    expect(forceSetBlock).toHaveBeenCalledWith({ x: 5, y: 6, z: 7 }, 'AIR')
  })

  it('skips an edit with an invalid block type (never mutates the world)', async () => {
    const { forceSetBlock, dirtySize } = await run([{ kind: 'place', x: 0, y: 0, z: 0, blockType: 'NOT_A_BLOCK' }])
    expect(forceSetBlock).not.toHaveBeenCalled()
    expect(dirtySize).toBe(0)
  })

  it('normalizes negative world coordinates when marking the edited chunk dirty', async () => {
    const { dirty, getChunk } = await run([{ kind: 'place', x: -1, y: 9, z: -17, blockType: 'STONE' }])

    expect(getChunk).toHaveBeenCalledWith({ x: -1, z: -2 })
    const dirtyEntry = Option.getOrThrow(HashMap.get(dirty, '-1,-2')) as {
      readonly dirtyAABB: Option.Option<unknown>
    }
    expect(Option.getOrThrow(dirtyEntry.dirtyAABB)).toEqual(aabbFromVoxel({ lx: 15, y: 9, lz: 15 }))
  })

  it('keeps draining edits after a failed world write', async () => {
    const forceSetBlock = vi.fn((pos: { readonly x: number }) =>
      pos.x === 1 ? Effect.fail(new Error('write failed')) : Effect.void,
    )

    const { dirtySize } = await run(
      [
        { kind: 'place', x: 1, y: 2, z: 3, blockType: 'STONE' },
        { kind: 'place', x: 4, y: 5, z: 6, blockType: 'DIRT' },
      ],
      { forceSetBlock },
    )

    expect(forceSetBlock).toHaveBeenCalledTimes(2)
    expect(dirtySize).toBe(1)
  })
})

describe('broadcastChestOnClose', () => {
  const makeChestHarness = (options: {
    readonly isOpen: boolean
    readonly selected: Option.Option<{ x: number; y: number; z: number }>
    readonly chestAt?: Option.Option<{ position: { x: number; y: number; z: number }; slots: ReadonlyArray<Option.Option<{ itemType: string; count: number; durability: number | null }>> }>
  }) => {
    const sendContainerUpdate = vi.fn(() => Effect.void)
    const mp = { sendContainerUpdate } as unknown as MultiplayerService
    const services = {
      inventoryRenderer: { isOpen: () => Effect.succeed(options.isOpen) },
      chestService: {
        getState: () => Effect.succeed({ chests: HashMap.empty(), selectedChestPosition: options.selected }),
        getChestStateAt: vi.fn(() => Effect.succeed(options.chestAt ?? Option.none())),
      },
    } as unknown as Pick<FrameHandlerServices, 'chestService' | 'inventoryRenderer'>
    return { mp, services, sendContainerUpdate }
  }

  it('broadcasts the chest state on the frame the UI closes', async () => {
    resetChestSyncStateForTest()
    const pos = { x: 3, y: 64, z: 5 }
    const open = makeChestHarness({ isOpen: true, selected: Option.some(pos) })
    const closed = makeChestHarness({
      isOpen: false,
      selected: Option.none(),
      chestAt: Option.some({
        position: pos,
        slots: [Option.some({ itemType: 'DIAMOND', count: 2, durability: null }), Option.none()],
      }),
    })
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* broadcastChestOnClose(open.mp, open.services)          // remembers the open chest
        yield* broadcastChestOnClose(closed.mp, closed.services)      // close edge → broadcast
        yield* broadcastChestOnClose(closed.mp, closed.services)      // no re-broadcast
      }),
    )
    expect(open.sendContainerUpdate).not.toHaveBeenCalled()
    expect(closed.sendContainerUpdate).toHaveBeenCalledTimes(1)
    expect(closed.sendContainerUpdate).toHaveBeenCalledWith(pos, [
      { itemType: 'DIAMOND', count: 2, durability: null },
      null,
    ])
  })

  it('sends nothing when the closed chest no longer exists locally', async () => {
    resetChestSyncStateForTest()
    const pos = { x: 1, y: 60, z: 1 }
    const open = makeChestHarness({ isOpen: true, selected: Option.some(pos) })
    const closed = makeChestHarness({ isOpen: false, selected: Option.none(), chestAt: Option.none() })
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* broadcastChestOnClose(open.mp, open.services)
        yield* broadcastChestOnClose(closed.mp, closed.services)
      }),
    )
    expect(closed.sendContainerUpdate).not.toHaveBeenCalled()
  })

  it('does nothing when the UI was never open on a chest', async () => {
    resetChestSyncStateForTest()
    const closed = makeChestHarness({ isOpen: false, selected: Option.none() })
    await Effect.runPromise(broadcastChestOnClose(closed.mp, closed.services))
    expect(closed.sendContainerUpdate).not.toHaveBeenCalled()
  })
})

describe('applyInboundContainerUpdates', () => {
  const run = (updates: ReadonlyArray<RemoteContainerUpdate>) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const applyRemoteChestState = vi.fn(() => Effect.void)
        const mp = { drainContainerUpdates: Effect.succeed(updates) } as unknown as MultiplayerService
        const services = { chestService: { applyRemoteChestState } } as unknown as Pick<FrameHandlerServices, 'chestService'>
        yield* applyInboundContainerUpdates(mp, services)
        return applyRemoteChestState
      }),
    )

  it('applies a valid remote chest snapshot wholesale', async () => {
    const apply = await run([
      { x: 3, y: 64, z: 5, slots: [{ itemType: 'DIAMOND', count: 2, durability: null }, null] },
    ])
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith({
      position: { x: 3, y: 64, z: 5 },
      slots: [Option.some({ itemType: 'DIAMOND', count: 2, durability: null }), Option.none()],
    })
  })

  it('skips the whole chest when any slot carries an unknown item or invalid count', async () => {
    const applyBadItem = await run([
      { x: 0, y: 0, z: 0, slots: [{ itemType: 'NOT_AN_ITEM', count: 1, durability: null }] },
    ])
    expect(applyBadItem).not.toHaveBeenCalled()
    const applyBadCount = await run([
      { x: 0, y: 0, z: 0, slots: [{ itemType: 'DIAMOND', count: 999, durability: null }] },
    ])
    expect(applyBadCount).not.toHaveBeenCalled()
  })
})

describe('dropped-item sync', () => {
  type Item = {
    id: string
    itemType: string
    count: number
    position: { x: number; y: number; z: number }
    velocity: { x: number; y: number; z: number }
  }
  const item = (id: string, count = 1, itemType = 'DIRT'): Item => ({
    id,
    itemType,
    count,
    position: { x: 1, y: 64, z: 1 },
    velocity: { x: 0, y: 0, z: 0 },
  })

  const makeSyncHarness = (items: ReadonlyArray<Item>, localPlayerId: string | null = 'me') => {
    const sendDroppedItemSpawn = vi.fn(() => Effect.void)
    const sendDroppedItemRemove = vi.fn(() => Effect.void)
    const mp = {
      getLocalPlayerId: () => Effect.succeed(localPlayerId),
      sendDroppedItemSpawn,
      sendDroppedItemRemove,
    } as unknown as MultiplayerService
    const services = {
      droppedItemService: { getAll: () => Effect.succeed(items) },
    } as unknown as Pick<FrameHandlerServices, 'droppedItemService'>
    return { mp, services, sendDroppedItemSpawn, sendDroppedItemRemove }
  }

  it('broadcasts new local items once and count changes as upserts', async () => {
    resetDroppedItemSyncStateForTest()
    const first = makeSyncHarness([item('dropped-item-1', 2)])
    await Effect.runPromise(syncDroppedItems(first.mp, first.services))
    expect(first.sendDroppedItemSpawn).toHaveBeenCalledTimes(1)
    expect(first.sendDroppedItemSpawn).toHaveBeenCalledWith({
      itemId: 'dropped-item-1',
      itemType: 'DIRT',
      count: 2,
      position: { x: 1, y: 64, z: 1 },
      velocity: { x: 0, y: 0, z: 0 },
    })

    const unchanged = makeSyncHarness([item('dropped-item-1', 2)])
    await Effect.runPromise(syncDroppedItems(unchanged.mp, unchanged.services))
    expect(unchanged.sendDroppedItemSpawn).not.toHaveBeenCalled()

    const merged = makeSyncHarness([item('dropped-item-1', 5)])
    await Effect.runPromise(syncDroppedItems(merged.mp, merged.services))
    expect(merged.sendDroppedItemSpawn).toHaveBeenCalledTimes(1)
  })

  it('broadcasts removal when a local item vanishes (collected or expired)', async () => {
    resetDroppedItemSyncStateForTest()
    const withItem = makeSyncHarness([item('dropped-item-7')])
    await Effect.runPromise(syncDroppedItems(withItem.mp, withItem.services))
    const empty = makeSyncHarness([])
    await Effect.runPromise(syncDroppedItems(empty.mp, empty.services))
    expect(empty.sendDroppedItemRemove).toHaveBeenCalledWith('me', 'dropped-item-7')
  })

  it('a collected mirror broadcasts a removal addressed to the ORIGINAL owner', async () => {
    resetDroppedItemSyncStateForTest()
    const withMirror = makeSyncHarness([item('remote:alice:dropped-item-3')])
    await Effect.runPromise(syncDroppedItems(withMirror.mp, withMirror.services))
    expect(withMirror.sendDroppedItemSpawn).not.toHaveBeenCalled() // mirrors never rebroadcast
    const collected = makeSyncHarness([])
    await Effect.runPromise(syncDroppedItems(collected.mp, collected.services))
    expect(collected.sendDroppedItemRemove).toHaveBeenCalledWith('alice', 'dropped-item-3')
  })

  it('does nothing before the local identity is assigned', async () => {
    resetDroppedItemSyncStateForTest()
    const harness = makeSyncHarness([item('dropped-item-1')], null)
    await Effect.runPromise(syncDroppedItems(harness.mp, harness.services))
    expect(harness.sendDroppedItemSpawn).not.toHaveBeenCalled()
  })

  it('applies inbound spawns as noMerge mirrors and skips invalid items', async () => {
    resetDroppedItemSyncStateForTest()
    const spawn = vi.fn(() => Effect.succeed({} as never))
    const removeById = vi.fn(() => Effect.succeed(true))
    const mp = {
      getLocalPlayerId: () => Effect.succeed('me'),
      drainDroppedItemSpawns: Effect.succeed([
        { ownerId: 'alice', itemId: 'dropped-item-3', itemType: 'DIAMOND', count: 2, position: { x: 1, y: 64, z: 1 }, velocity: { x: 0, y: 0, z: 0 } },
        { ownerId: 'alice', itemId: 'dropped-item-4', itemType: 'NOT_AN_ITEM', count: 1, position: { x: 1, y: 64, z: 1 }, velocity: { x: 0, y: 0, z: 0 } },
      ]),
      drainDroppedItemRemoves: Effect.succeed([]),
    } as unknown as MultiplayerService
    const services = { droppedItemService: { spawn, removeById } } as unknown as Pick<FrameHandlerServices, 'droppedItemService'>
    await Effect.runPromise(applyInboundDroppedItems(mp, services))
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledWith({
      id: 'remote:alice:dropped-item-3',
      noMerge: true,
      itemType: 'DIAMOND',
      count: 2,
      position: { x: 1, y: 64, z: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      pickupDelayTicks: 10,
    })
  })

  it('routes inbound removals to the original for own items and to the mirror otherwise', async () => {
    resetDroppedItemSyncStateForTest()
    const removeById = vi.fn(() => Effect.succeed(true))
    const mp = {
      getLocalPlayerId: () => Effect.succeed('me'),
      drainDroppedItemSpawns: Effect.succeed([]),
      drainDroppedItemRemoves: Effect.succeed([
        { ownerId: 'me', itemId: 'dropped-item-9' },        // peer collected OUR item
        { ownerId: 'alice', itemId: 'dropped-item-3' },      // owner removed theirs
      ]),
    } as unknown as MultiplayerService
    const services = { droppedItemService: { spawn: vi.fn(), removeById } } as unknown as Pick<FrameHandlerServices, 'droppedItemService'>
    await Effect.runPromise(applyInboundDroppedItems(mp, services))
    expect(removeById).toHaveBeenCalledWith('dropped-item-9')
    expect(removeById).toHaveBeenCalledWith('remote:alice:dropped-item-3')
  })
})

describe('parked-vehicle sync', () => {
  type Vehicle = { id: string; kind: 'boat' | 'minecart'; position: { x: number; y: number; z: number }; yaw: number }
  const boat = (id: string, x = 0): Vehicle => ({ id, kind: 'boat', position: { x, y: 62, z: 0 }, yaw: 0.5 })

  const makeSyncHarness = (vehicles: ReadonlyArray<Vehicle>, localPlayerId: string | null = 'me') => {
    const sendParkedVehicleUpdate = vi.fn(() => Effect.void)
    const sendParkedVehicleRemove = vi.fn(() => Effect.void)
    const mp = {
      getLocalPlayerId: () => Effect.succeed(localPlayerId),
      sendParkedVehicleUpdate,
      sendParkedVehicleRemove,
    } as unknown as MultiplayerService
    const services = {
      parkedVehicleService: { getAll: () => Effect.succeed(vehicles) },
    } as unknown as Pick<FrameHandlerServices, 'parkedVehicleService'>
    return { mp, services, sendParkedVehicleUpdate, sendParkedVehicleRemove }
  }

  it('broadcasts new local parks once and re-broadcasts on position change', async () => {
    resetParkedVehicleSyncStateForTest()
    const first = makeSyncHarness([boat('parked-vehicle-1')])
    await Effect.runPromise(syncParkedVehicles(first.mp, first.services))
    expect(first.sendParkedVehicleUpdate).toHaveBeenCalledTimes(1)
    expect(first.sendParkedVehicleUpdate).toHaveBeenCalledWith({
      vehicleId: 'parked-vehicle-1',
      kind: 'boat',
      position: { x: 0, y: 62, z: 0 },
      yaw: 0.5,
    })
    const unchanged = makeSyncHarness([boat('parked-vehicle-1')])
    await Effect.runPromise(syncParkedVehicles(unchanged.mp, unchanged.services))
    expect(unchanged.sendParkedVehicleUpdate).not.toHaveBeenCalled()
    const moved = makeSyncHarness([boat('parked-vehicle-1', 4)])
    await Effect.runPromise(syncParkedVehicles(moved.mp, moved.services))
    expect(moved.sendParkedVehicleUpdate).toHaveBeenCalledTimes(1)
  })

  it('a claimed mirror emits a removal addressed to the original owner (mount round-trip)', async () => {
    resetParkedVehicleSyncStateForTest()
    const withMirror = makeSyncHarness([boat('remote:alice:parked-vehicle-3')])
    await Effect.runPromise(syncParkedVehicles(withMirror.mp, withMirror.services))
    expect(withMirror.sendParkedVehicleUpdate).not.toHaveBeenCalled() // mirrors never rebroadcast
    const claimed = makeSyncHarness([])
    await Effect.runPromise(syncParkedVehicles(claimed.mp, claimed.services))
    expect(claimed.sendParkedVehicleRemove).toHaveBeenCalledWith('alice', 'parked-vehicle-3')
  })

  it('applies inbound updates as mirror upserts and routes removals by ownership', async () => {
    resetParkedVehicleSyncStateForTest()
    const parkWithId = vi.fn(() => Effect.void)
    const removeById = vi.fn(() => Effect.succeed(true))
    const mp = {
      getLocalPlayerId: () => Effect.succeed('me'),
      drainParkedVehicleUpdates: Effect.succeed([
        { ownerId: 'alice', vehicleId: 'parked-vehicle-3', kind: 'minecart', position: { x: 2, y: 64, z: 2 }, yaw: 1 },
      ]),
      drainParkedVehicleRemoves: Effect.succeed([
        { ownerId: 'me', vehicleId: 'parked-vehicle-9' },
        { ownerId: 'alice', vehicleId: 'parked-vehicle-3' },
      ]),
    } as unknown as MultiplayerService
    const services = { parkedVehicleService: { parkWithId, removeById } } as unknown as Pick<FrameHandlerServices, 'parkedVehicleService'>
    await Effect.runPromise(applyInboundParkedVehicles(mp, services))
    expect(parkWithId).toHaveBeenCalledWith({
      id: 'remote:alice:parked-vehicle-3',
      kind: 'minecart',
      position: { x: 2, y: 64, z: 2 },
      yaw: 1,
    })
    expect(removeById).toHaveBeenCalledWith('parked-vehicle-9')
    expect(removeById).toHaveBeenCalledWith('remote:alice:parked-vehicle-3')
  })
})
