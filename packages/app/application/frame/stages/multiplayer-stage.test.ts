import { describe, it, expect, vi } from 'vitest'
import { Effect, HashMap, Ref } from 'effect'
import { applyInboundBlockEdits } from '@ts-minecraft/app/frame/stages/multiplayer-stage'
import type { MultiplayerService, RemoteBlockEdit } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'

describe('applyInboundBlockEdits (T15c)', () => {
  const run = (edits: RemoteBlockEdit[]) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const forceSetBlock = vi.fn(() => Effect.void)
        const getChunk = vi.fn(() => Effect.succeed({ coord: { x: 0, z: 0 }, blocks: new Uint8Array(0) } as never))
        const mp = { drainBlockEdits: Effect.succeed(edits as ReadonlyArray<RemoteBlockEdit>) } as unknown as MultiplayerService
        const services = { blockService: { forceSetBlock }, chunkManagerService: { getChunk } } as never
        const dirtyRef = yield* Ref.make(HashMap.empty<string, unknown>())
        yield* applyInboundBlockEdits(mp, services, dirtyRef as never)
        const dirty = yield* Ref.get(dirtyRef)
        return { forceSetBlock, dirtySize: HashMap.size(dirty) }
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
})
