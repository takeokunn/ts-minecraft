import { describe, it, expect, vi } from 'vitest'
import { Effect, HashMap, MutableRef, Option } from 'effect'
import { aabbFromVoxel } from '@ts-minecraft/world'
import { applyInboundBlockEdits, multiplayerStage } from '@ts-minecraft/app/frame/stages/multiplayer-stage'
import type { MultiplayerService, RemoteBlockEdit } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'

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
})

describe('applyInboundBlockEdits (T15c)', () => {
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
          options.getChunk ?? vi.fn(() => Effect.succeed({ coord: { x: 0, z: 0 }, blocks: new Uint8Array(0) } as never))
        const mp = { drainBlockEdits: Effect.succeed(edits as ReadonlyArray<RemoteBlockEdit>) } as unknown as MultiplayerService
        const services = { blockService: { forceSetBlock }, chunkManagerService: { getChunk } } as never
        const dirtyRef = MutableRef.make(HashMap.empty<string, unknown>())
        yield* applyInboundBlockEdits(mp, services, dirtyRef as never)
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
