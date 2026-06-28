import { describe, it, expect, vi } from 'vitest'
import { Effect, HashMap, MutableRef, Option } from 'effect'
import { aabbFromVoxel } from '@ts-minecraft/world'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import {
  applyInboundBlockEdits,
  applyInboundEntitySnapshots,
  multiplayerStage,
} from '@ts-minecraft/app/frame/stages/multiplayer-stage'
import type {
  LocalEntitySnapshot,
  MultiplayerService,
  RemoteBlockEdit,
  RemoteEntitySnapshot,
} from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { Chunk } from '@ts-minecraft/world'

describe('multiplayerStage', () => {
  it('sends the current position and rotation to the multiplayer service', async () => {
    const sendPositionUpdate = vi.fn(() => Effect.void)
    const multiplayer = { sendPositionUpdate } as unknown as MultiplayerService

    await Effect.runPromise(multiplayerStage(multiplayer, { x: 1, y: 2, z: 3 }, 0.25, -0.5))

    expect(sendPositionUpdate).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 }, { yaw: 0.25, pitch: -0.5 })
  })

  it('ignores send failures so a network hiccup cannot abort the frame', async () => {
    const sendPositionUpdate = vi.fn(() => Effect.fail(new Error('offline')))
    const multiplayer = { sendPositionUpdate } as unknown as MultiplayerService

    await expect(Effect.runPromise(multiplayerStage(multiplayer, { x: 4, y: 5, z: 6 }, 1, 2))).resolves.toBeUndefined()
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
    const multiplayer = { sendPositionUpdate, sendEntitySnapshot } as unknown as MultiplayerService

    await Effect.runPromise(multiplayerStage(multiplayer, { x: 7, y: 8, z: 9 }, 0, 0, snapshots))

    expect(sendPositionUpdate).toHaveBeenCalledWith({ x: 7, y: 8, z: 9 }, { yaw: 0, pitch: 0 })
    expect(sendEntitySnapshot).toHaveBeenCalledTimes(2)
    expect(sendEntitySnapshot).toHaveBeenNthCalledWith(1, snapshots[0])
    expect(sendEntitySnapshot).toHaveBeenNthCalledWith(2, snapshots[1])
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
