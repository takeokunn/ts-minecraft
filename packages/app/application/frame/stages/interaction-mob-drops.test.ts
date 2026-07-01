import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect, vi } from 'vitest'
import { spawnMobDrop, spawnMobXpOrb } from '@ts-minecraft/app/frame/stages/interaction-mob-drops'

const pos = (x: number, y: number, z: number) => ({ x, y, z })
const entity = (y: number) => ({ position: pos(0, y, 0) })
const entityAt = (x: number, y: number, z: number) => ({ position: pos(x, y, z) })

// ─── spawnMobDrop ─────────────────────────────────────────────────────────────
describe('spawnMobDrop', () => {
  it.effect('skips spawn entirely when count is 0', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobDrop({ droppedItemService: { spawn } }, entity(64), { blockType: 'DIRT', count: 0 })
      expect(spawn).not.toHaveBeenCalled()
    }),
  )

  it.effect('skips spawn when the count override is explicitly 0', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobDrop({ droppedItemService: { spawn } }, entity(64), { blockType: 'DIRT', count: 5 }, 0)
      expect(spawn).not.toHaveBeenCalled()
    }),
  )

  it.effect('spawns at entity.y + 0.5 so the item floats above the mob feet', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobDrop({ droppedItemService: { spawn } }, entity(64), { blockType: 'GRASS', count: 1 })
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({
        position: expect.objectContaining({ y: 64.5 }),
      }))
    }),
  )

  it.effect('preserves entity x and z coordinates in the spawn position', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobDrop({ droppedItemService: { spawn } }, entityAt(7, 64, -3), { blockType: 'STONE', count: 1 })
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({
        position: expect.objectContaining({ x: 7, z: -3 }),
      }))
    }),
  )

  it.effect('uses drop.count when no count override is given', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobDrop({ droppedItemService: { spawn } }, entity(0), { blockType: 'STONE', count: 3 })
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ count: 3 }))
    }),
  )

  it.effect('honours the count override over drop.count', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobDrop({ droppedItemService: { spawn } }, entity(0), { blockType: 'STONE', count: 5 }, 2)
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ count: 2 }))
    }),
  )

  it.effect('passes drop.blockType as itemType to the spawn call', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobDrop({ droppedItemService: { spawn } }, entity(0), { blockType: 'BONE', count: 1 })
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'BONE' }))
    }),
  )

  it.effect('launches the item with a slight upward velocity', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobDrop({ droppedItemService: { spawn } }, entity(0), { blockType: 'DIRT', count: 1 })
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({
        velocity: expect.objectContaining({ y: expect.any(Number) }),
      }))
      const { velocity } = (spawn.mock.calls[0] as [{ velocity: { y: number } }])[0]
      expect(velocity.y).toBeGreaterThan(0)
    }),
  )
})

// ─── spawnMobXpOrb ────────────────────────────────────────────────────────────
describe('spawnMobXpOrb', () => {
  it.effect('skips spawn entirely when amount is 0', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobXpOrb({ droppedXpOrbService: { spawn } }, entity(64), 0)
      expect(spawn).not.toHaveBeenCalled()
    }),
  )

  it.effect('spawns at entity.y + 0.5 so the orb floats above the mob feet', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobXpOrb({ droppedXpOrbService: { spawn } }, entity(64), 5)
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({
        position: expect.objectContaining({ y: 64.5 }),
      }))
    }),
  )

  it.effect('passes the xp amount to the spawn call', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobXpOrb({ droppedXpOrbService: { spawn } }, entity(0), 12)
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ amount: 12 }))
    }),
  )

  it.effect('preserves entity x and z in the spawn position', () =>
    Effect.gen(function* () {
      const spawn = vi.fn(() => Effect.succeed({} as never))
      yield* spawnMobXpOrb({ droppedXpOrbService: { spawn } }, entityAt(-4, 20, 9), 1)
      expect(spawn).toHaveBeenCalledWith(expect.objectContaining({
        position: expect.objectContaining({ x: -4, z: 9 }),
      }))
    }),
  )
})
