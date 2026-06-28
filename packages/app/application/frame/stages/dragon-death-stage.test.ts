import { describe, it } from '@effect/vitest'
import { Effect, HashMap, MutableRef, Option } from 'effect'
import { expect, vi } from 'vitest'
import type { Chunk } from '@ts-minecraft/world'
import type { DragonDeathEvent } from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-death'
import { DRAGON_EGG_POSITION, RETURN_PORTAL_POSITION } from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-death'
import { dragonDeathStage, type DragonDeathStageRefs, type DragonDeathStageServices } from '@ts-minecraft/app/frame/stages/dragon-death-stage'

const emptyChunk = (cx: number, cz: number): Chunk => ({
  coord: { x: cx, z: cz },
  blocks: new Uint8Array(0),
  fluid: Option.none(),
} as unknown as Chunk)

type Harness = {
  readonly services: DragonDeathStageServices
  readonly refs: DragonDeathStageRefs
  readonly forceSetBlock: ReturnType<typeof vi.fn>
  readonly addXP: ReturnType<typeof vi.fn>
}

const makeHarness = (events: ReadonlyArray<DragonDeathEvent>): Harness => {
  const forceSetBlock = vi.fn(() => Effect.void)
  const addXP = vi.fn((_: number) => Effect.succeed(undefined))
  const dirtyChunksRef = MutableRef.make(HashMap.empty<string, { chunk: Chunk; dirtyAABB: Option.Option<never> }>())
  const services = {
    entityManager: { drainDragonDeathEvents: () => Effect.succeed(events) },
    blockService: { forceSetBlock },
    chunkManagerService: { getChunk: (coord: { x: number; z: number }) => Effect.succeed(emptyChunk(coord.x, coord.z)) },
    // No mending items so XP flows straight to xpService.
    inventoryService: { repairMendingItemsWithXP: (amount: number) => Effect.succeed(amount) },
    equipmentService: { repairMendingItemsWithXP: (amount: number) => Effect.succeed(amount) },
    xpService: { addXP },
  } as unknown as DragonDeathStageServices
  return { services, refs: { dirtyChunksRef } as unknown as DragonDeathStageRefs, forceSetBlock, addXP }
}

describe('dragonDeathStage', () => {
  it('places the dragon egg and marks its chunk dirty', () =>
    Effect.gen(function* () {
      const h = makeHarness([{ type: 'DragonEggSpawn', blockType: 'DRAGON_EGG', position: DRAGON_EGG_POSITION }])
      yield* dragonDeathStage(h.services, h.refs)
      expect(h.forceSetBlock).toHaveBeenCalledWith(DRAGON_EGG_POSITION, 'DRAGON_EGG')
      expect(HashMap.size(MutableRef.get(h.refs.dirtyChunksRef))).toBe(1)
    }).pipe(Effect.runPromise))

  it('activates the return portal block', () =>
    Effect.gen(function* () {
      const h = makeHarness([{ type: 'ReturnPortalActivate', blockType: 'END_PORTAL', position: RETURN_PORTAL_POSITION, emissive: true, canEnter: true }])
      yield* dragonDeathStage(h.services, h.refs)
      expect(h.forceSetBlock).toHaveBeenCalledWith(RETURN_PORTAL_POSITION, 'END_PORTAL')
    }).pipe(Effect.runPromise))

  it('grants floored XP to the player on the XP fountain', () =>
    Effect.gen(function* () {
      const h = makeHarness([{ type: 'XPFountain', amount: 300.9, total: 12000, position: RETURN_PORTAL_POSITION }])
      yield* dragonDeathStage(h.services, h.refs)
      expect(h.addXP).toHaveBeenCalledWith(300)
    }).pipe(Effect.runPromise))

  it('ignores visual-only and completion events (no block / XP effects)', () =>
    Effect.gen(function* () {
      const h = makeHarness([
        { type: 'Dying', liftTowardSky: true, flashes: true, position: RETURN_PORTAL_POSITION },
        { type: 'Exploding', rapidFlashes: true, explodes: true, position: RETURN_PORTAL_POSITION },
        { type: 'Complete', removeDragon: true },
      ])
      yield* dragonDeathStage(h.services, h.refs)
      expect(h.forceSetBlock).not.toHaveBeenCalled()
      expect(h.addXP).not.toHaveBeenCalled()
    }).pipe(Effect.runPromise))

  it('does nothing when no events are queued', () =>
    Effect.gen(function* () {
      const h = makeHarness([])
      yield* dragonDeathStage(h.services, h.refs)
      expect(h.forceSetBlock).not.toHaveBeenCalled()
      expect(h.addXP).not.toHaveBeenCalled()
      expect(HashMap.size(MutableRef.get(h.refs.dirtyChunksRef))).toBe(0)
    }).pipe(Effect.runPromise))
})
